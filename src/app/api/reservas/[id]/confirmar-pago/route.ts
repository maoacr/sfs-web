import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { apiHandler } from "@/lib/api-handler";
import { confirmarPagoSchema } from "@/lib/schemas";
import { notificarCambioReserva } from "@/lib/event-listeners";

type ConfirmarPagoBody = { metodo: "efectivo" | "nequi" | "transferencia" };

/**
 * POST /api/reservas/:id/confirmar-pago
 *
 * El dueño confirma que recibió el pago en efectivo/Nequi/transferencia.
 * Marca la reserva como CONFIRMADA y el saldo como 0.
 * Solo el dueño del complejo puede usar este endpoint.
 */
export const POST = apiHandler<ConfirmarPagoBody>(
  async (request, ctx, { body }) => {
    const user = ctx.user!;

    if (user.role !== "OWNER") {
      return NextResponse.json(
        { error: "Solo los dueños pueden confirmar pagos" },
        { status: 403 }
      );
    }

    const id = request.url.split("/reservas/")[1]?.split("/")[0];
    if (!id) {
      return NextResponse.json({ error: "ID de reserva requerido" }, { status: 400 });
    }

    // ─── 1. Buscar reserva (solo del dueño) ─────────────────────────────

    const reserva = await prisma.reserva.findFirst({
      where: { id, tenantId: user.sub },
      include: {
        cancha: { include: { complejo: true } },
        player: { select: { id: true, primerNombre: true, apellidos: true, email: true } },
      },
    });

    if (!reserva) {
      return NextResponse.json(
        { error: "Reserva no encontrada o no te pertenece" },
        { status: 404 }
      );
    }

    if (reserva.estado === "CONFIRMADA" || reserva.estado === "COMPLETADA") {
      return NextResponse.json(
        { error: "Esta reserva ya está confirmada" },
        { status: 400 }
      );
    }

    if (reserva.estado === "CANCELADA") {
      return NextResponse.json(
        { error: "No se puede confirmar una reserva cancelada" },
        { status: 400 }
      );
    }

    const metodo = body?.metodo || "efectivo";
    const saldoPendiente = Number(reserva.saldoPendiente);
    const montoPagado = Number(reserva.montoPagado);
    const nuevoPago = saldoPendiente > 0 ? saldoPendiente : Number(reserva.montoTotal) - montoPagado;

    // ─── 2. Registrar pago y actualizar reserva ─────────────────────────

    await prisma.$transaction([
      prisma.pago.create({
        data: {
          reservaId: reserva.id,
          userId: reserva.playerId,
          monto: nuevoPago,
          estadoPago: "APROBADO",
          mpMetadata: { metodo, confirmadoPor: user.sub },
        },
      }),
      prisma.reserva.update({
        where: { id: reserva.id },
        data: {
          montoPagado: Number(reserva.montoTotal),
          saldoPendiente: 0,
          estado: "CONFIRMADA",
        },
      }),
    ]);

    // ─── 3. Notificar ──────────────────────────────────────────────────

    await notificarCambioReserva({
      tipo: "RESERVA_CONFIRMADA",
      reservaId: reserva.id,
      canchaNombre: reserva.cancha.nombre,
      complejoNombre: reserva.cancha.complejo.nombre,
      slotInicio: reserva.slotInicio,
      slotFin: reserva.slotFin,
      playerId: reserva.playerId,
      playerNombre: `${reserva.player.primerNombre} ${reserva.player.apellidos || ""}`.trim(),
      playerEmail: reserva.player.email,
      tenantId: reserva.tenantId,
      tenantEmail: user.email,
    });

    return NextResponse.json({
      reservaId: reserva.id,
      estado: "CONFIRMADA",
      metodo,
      montoConfirmado: nuevoPago,
    });
  },
  {
    requireAuth: true,
    requiredRole: "OWNER",
    bodySchema: confirmarPagoSchema,
  }
);
