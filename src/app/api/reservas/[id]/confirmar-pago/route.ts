import { NextResponse } from "next/server";
import { db, reservas, pagos } from "@sfs/db";
import { and, eq } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import { confirmarPagoSchema } from "@/lib/schemas";
import { notificarReserva } from "@/lib/event-listeners";

type ConfirmarPagoBody = { metodo: "efectivo" | "nequi" | "transferencia" };

/**
 * POST /api/reservas/:id/confirmar-pago
 *
 * El dueño confirma que recibió el pago en efectivo/Nequi/transferencia.
 * Registra el pago por el saldo restante y marca la reserva como CONFIRMADA.
 */
export const POST = apiHandler<ConfirmarPagoBody>(
  async (request, ctx, { body }) => {
    const user = ctx.user!;

    const id = request.url.split("/reservas/")[1]?.split("/")[0];
    if (!id) {
      return NextResponse.json({ error: "ID de reserva requerido" }, { status: 400 });
    }

    const reserva = await db.query.reservas.findFirst({
      where: and(eq(reservas.id, id), eq(reservas.tenantId, user.sub)),
    });

    if (!reserva) {
      return NextResponse.json({ error: "Reserva no encontrada o no te pertenece" }, { status: 404 });
    }

    if (reserva.estado === "CONFIRMADA" || reserva.estado === "COMPLETADA") {
      return NextResponse.json({ error: "Esta reserva ya está confirmada" }, { status: 400 });
    }

    if (reserva.estado === "CANCELADA" || reserva.estado === "EXPIRADA") {
      return NextResponse.json({ error: "No se puede confirmar una reserva cancelada" }, { status: 400 });
    }

    const metodo = body?.metodo || "efectivo";
    const montoTotal = Number(reserva.montoTotal);
    const nuevoPago = montoTotal - Number(reserva.montoPagado);

    await db.transaction(async (tx) => {
      await tx.insert(pagos).values({
        reservaId: reserva.id,
        userId: reserva.playerId,
        monto: nuevoPago.toFixed(2),
        estadoPago: "APROBADO",
        mpMetadata: { metodo, confirmadoPor: user.sub },
      });
      await tx
        .update(reservas)
        .set({ montoPagado: montoTotal.toFixed(2), saldoPendiente: "0.00", estado: "CONFIRMADA" })
        .where(eq(reservas.id, reserva.id));
    });

    await notificarReserva(reserva.id, "RESERVA_CONFIRMADA");

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
