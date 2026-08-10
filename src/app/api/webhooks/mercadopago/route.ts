import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { verifyWebhookRequest, getPayment } from "@/lib/mercadopago";
import { notificarCambioReserva } from "@/lib/event-listeners";

/**
 * POST /api/webhooks/mercadopago
 *
 * Recibe notificaciones de MercadoPago cuando un pago se procesa.
 * Verifica firma HMAC, consulta el estado del pago a MP, y actualiza
 * la reserva y el pago en la base de datos.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const signatureHeader = request.headers.get("x-signature");

    // ─── 1. Verificar HMAC ────────────────────────────────────────────────

    const dataId = body.data?.id;
    if (!dataId) {
      return NextResponse.json({ error: "Falta data.id" }, { status: 400 });
    }

    if (!verifyWebhookRequest(dataId, signatureHeader)) {
      return NextResponse.json(
        { error: "Firma inválida" },
        { status: 401 }
      );
    }

    // ─── 2. Solo procesar payment.created ─────────────────────────────────

    const action = body.action;
    if (action !== "payment.created" && action !== "payment.updated") {
      return NextResponse.json({ ok: true, skipped: action });
    }

    // ─── 3. Consultar pago a MP (doble verificación) ──────────────────────

    let mpPayment;
    try {
      mpPayment = await getPayment(dataId);
    } catch {
      return NextResponse.json(
        { error: "No se pudo consultar el pago" },
        { status: 502 }
      );
    }

    const paymentStatus = mpPayment.status;
    const externalReference = mpPayment.external_reference; // reservaId
    const mpPaymentId = String(mpPayment.id);
    const monto = Number(mpPayment.transaction_amount || 0);

    if (!externalReference) {
      return NextResponse.json(
        { error: "Falta external_reference en el pago" },
        { status: 400 }
      );
    }

    // ─── 4. Buscar la reserva ─────────────────────────────────────────────

    const reserva = await prisma.reserva.findUnique({
      where: { id: externalReference },
    });

    if (!reserva) {
      return NextResponse.json(
        { error: "Reserva no encontrada" },
        { status: 404 }
      );
    }

    // ─── 5. Buscar o crear el Pago asociado al split ──────────────────────

    const splitId = (mpPayment as any).order?.id || (mpPayment as any).merchant_order_id;

    let pago = await prisma.pago.findFirst({
      where: { mpSplitId: String(splitId) },
    });

    if (!pago && mpPayment.status === "approved") {
      // Crear pago si no existe (webhook puede llegar antes que nuestro registro)
      pago = await prisma.pago.create({
        data: {
          reservaId: reserva.id,
          userId: reserva.playerId,
          monto,
          estadoPago: "APROBADO",
          mpSplitId: String(splitId),
          mpPaymentId,
          mpMetadata: mpPayment as any,
        },
      });
    } else if (pago) {
      // Actualizar pago existente
      pago = await prisma.pago.update({
        where: { id: pago.id },
        data: {
          mpPaymentId,
          estadoPago:
            paymentStatus === "approved"
              ? "APROBADO"
              : paymentStatus === "rejected"
                ? "RECHAZADO"
                : "PENDIENTE",
          mpMetadata: mpPayment as any,
        },
      });
    }

    if (!pago || paymentStatus !== "approved") {
      return NextResponse.json({
        ok: true,
        status: paymentStatus,
        reservaId: reserva.id,
      });
    }

    // ─── 6. Actualizar reserva ────────────────────────────────────────────

    const nuevoMontoPagado = Number(reserva.montoPagado) + monto;
    const montoTotal = Number(reserva.montoTotal);

    if (nuevoMontoPagado >= montoTotal) {
      // Reserva completamente pagada
      await prisma.reserva.update({
        where: { id: reserva.id },
        data: {
          montoPagado: nuevoMontoPagado,
          saldoPendiente: 0,
          estado: "CONFIRMADA",
        },
      });

      // Notificar
      const reservaActualizada = await prisma.reserva.findUnique({
        where: { id: reserva.id },
        include: {
          cancha: { include: { complejo: true } },
          player: { select: { id: true, primerNombre: true, apellidos: true, email: true } },
          tenant: { select: { id: true, email: true } },
        },
      });

      if (reservaActualizada) {
        const r = reservaActualizada;
        await notificarCambioReserva({
          tipo: "RESERVA_CONFIRMADA",
          reservaId: r.id,
          canchaNombre: r.cancha.nombre,
          complejoNombre: r.cancha.complejo.nombre,
          slotInicio: r.slotInicio,
          slotFin: r.slotFin,
          playerId: r.playerId,
          playerNombre: `${r.player.primerNombre} ${r.player.apellidos || ""}`.trim(),
          playerEmail: r.player.email,
          tenantId: r.tenantId,
          tenantEmail: r.tenant.email,
        });
      }
    } else {
      // Pago parcial
      const saldo = montoTotal - nuevoMontoPagado;
      await prisma.reserva.update({
        where: { id: reserva.id },
        data: {
          montoPagado: nuevoMontoPagado,
          saldoPendiente: saldo,
          estado: "PAGO_PARCIAL",
        },
      });

      // Notificar pago parcial
      const reservaActualizada = await prisma.reserva.findUnique({
        where: { id: reserva.id },
        include: {
          cancha: { include: { complejo: true } },
          player: { select: { id: true, primerNombre: true, apellidos: true, email: true } },
          tenant: { select: { id: true, email: true } },
        },
      });

      if (reservaActualizada) {
        const r = reservaActualizada;
        await notificarCambioReserva({
          tipo: "RESERVA_PAGO_PARCIAL",
          reservaId: r.id,
          canchaNombre: r.cancha.nombre,
          complejoNombre: r.cancha.complejo.nombre,
          slotInicio: r.slotInicio,
          slotFin: r.slotFin,
          playerId: r.playerId,
          playerNombre: `${r.player.primerNombre} ${r.player.apellidos || ""}`.trim(),
          playerEmail: r.player.email,
          tenantId: r.tenantId,
          tenantEmail: r.tenant.email,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      reservaId: reserva.id,
      nuevoEstado: nuevoMontoPagado >= montoTotal ? "CONFIRMADA" : "PAGO_PARCIAL",
    });
  } catch (error) {
    console.error("[MP Webhook] Error:", error);
    // Siempre retornar 200 para que MP no reintente
    return NextResponse.json(
      { error: "Error interno", ok: false },
      { status: 200 }
    );
  }
}
