import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { apiHandler } from "@/lib/api-handler";
import { cancelarReservaSchema } from "@/lib/schemas";
import { refundPayment, isMercadoPagoConfigured } from "@/lib/mercadopago";
import { notificarCambioReserva } from "@/lib/event-listeners";

type CancelarBody = { motivo?: string };

/**
 * PATCH /api/reservas/:id/cancelar
 *
 * Cancela una reserva aplicando la política de cancelación del complejo:
 * - Si cancela antes del plazo → reembolso 100%
 * - Si cancela después del plazo → penalización configurada
 * - El dueño puede cancelar cualquier reserva de su complejo (reembolso 100%)
 */
export const PATCH = apiHandler<CancelarBody>(
  async (request, ctx, { body }) => {
    const user = ctx.user!;

    const id = request.url.split("/reservas/")[1]?.split("/")[0];
    if (!id) {
      return NextResponse.json({ error: "ID de reserva requerido" }, { status: 400 });
    }

    // ─── 1. Buscar reserva ─────────────────────────────────────────────

    const reserva = await prisma.reserva.findUnique({
      where: { id },
      include: {
        cancha: { include: { complejo: true } },
        player: { select: { id: true, primerNombre: true, apellidos: true, email: true } },
        tenant: { select: { id: true, email: true } },
        pagos: {
          where: { estadoPago: "APROBADO", mpPaymentId: { not: null } },
        },
      },
    });

    if (!reserva) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }

    // ─── 2. Verificar permisos ─────────────────────────────────────────

    const esJugador = reserva.playerId === user.sub;
    const esDueno = reserva.tenantId === user.sub && user.role === "OWNER";

    if (!esJugador && !esDueno) {
      return NextResponse.json(
        { error: "No tenés permiso para cancelar esta reserva" },
        { status: 403 }
      );
    }

    if (reserva.estado === "CANCELADA" || reserva.estado === "COMPLETADA") {
      return NextResponse.json(
        { error: "Esta reserva ya no se puede cancelar" },
        { status: 400 }
      );
    }

    // ─── 3. Calcular política de cancelación ───────────────────────────

    const complejo = reserva.cancha.complejo;
    const plazoHoras = complejo.plazoCancelacionHoras || 24;
    const penalizacion = complejo.penalizacionPorcentaje || 0;

    const ahora = new Date();
    const slotInicio = new Date(reserva.slotInicio);
    const horasHastaReserva =
      (slotInicio.getTime() - ahora.getTime()) / (1000 * 60 * 60);

    let porcentajeReembolso = 100;

    if (!esDueno && horasHastaReserva < plazoHoras && penalizacion > 0) {
      porcentajeReembolso = 100 - penalizacion;
    }

    const motivo = body?.motivo || (esDueno ? "Cancelado por el dueño" : "Cancelado por el jugador");

    // ─── 4. Reembolsar pagos MP ────────────────────────────────────────

    const reembolsos: { pagoId: string; monto: number; resultado: string }[] = [];

    if (isMercadoPagoConfigured() && porcentajeReembolso > 0) {
      for (const pago of reserva.pagos) {
        if (pago.mpPaymentId) {
          const montoReembolso = Math.round(
            Number(pago.monto) * (porcentajeReembolso / 100)
          );
          try {
            if (porcentajeReembolso === 100) {
              await refundPayment(pago.mpPaymentId);
            } else {
              await refundPayment(pago.mpPaymentId, montoReembolso);
            }
            await prisma.pago.update({
              where: { id: pago.id },
              data: {
                estadoPago: porcentajeReembolso === 100 ? "REEMBOLSADO" : "APROBADO",
                mpMetadata: {
                  ...((pago.mpMetadata as any) || {}),
                  reembolso: { monto: montoReembolso, porcentaje: porcentajeReembolso, motivo },
                },
              },
            });
            reembolsos.push({ pagoId: pago.id, monto: montoReembolso, resultado: "ok" });
          } catch (err) {
            console.error(`[Cancelar] Error reembolsando pago ${pago.id}:`, err);
            reembolsos.push({ pagoId: pago.id, monto: montoReembolso, resultado: "error" });
          }
        }
      }
    }

    // ─── 5. Cancelar reserva ───────────────────────────────────────────

    await prisma.reserva.update({
      where: { id: reserva.id },
      data: {
        estado: "CANCELADA",
        saldoPendiente: 0,
      },
    });

    // ─── 6. Notificar ─────────────────────────────────────────────────

    await notificarCambioReserva({
      tipo: "RESERVA_CANCELADA",
      reservaId: reserva.id,
      canchaNombre: reserva.cancha.nombre,
      complejoNombre: reserva.cancha.complejo.nombre,
      slotInicio: reserva.slotInicio,
      slotFin: reserva.slotFin,
      playerId: reserva.playerId,
      playerNombre: `${reserva.player.primerNombre} ${reserva.player.apellidos || ""}`.trim(),
      playerEmail: reserva.player.email,
      tenantId: reserva.tenantId,
      tenantEmail: reserva.tenant.email,
    });

    return NextResponse.json({
      reservaId: reserva.id,
      estado: "CANCELADA",
      porcentajeReembolso,
      reembolsos,
      motivo,
    });
  },
  {
    requireAuth: true,
    bodySchema: cancelarReservaSchema,
  }
);
