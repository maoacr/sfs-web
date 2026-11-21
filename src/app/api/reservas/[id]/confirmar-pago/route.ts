import { NextResponse } from "next/server";
import { db, reservas, pagos, type Pago } from "@sfs/db";
import { and, eq } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import { confirmarPagoSchema } from "@/lib/schemas";
import { notificarReserva } from "@/lib/event-listeners";

type ConfirmarPagoBody = { metodo?: Pago["metodo"]; entidad?: string; monto?: number };

/**
 * POST /api/reservas/:id/confirmar-pago
 *
 * El dueño confirma que recibió el pago en efectivo/Nequi/transferencia.
 * Registra el pago por el saldo restante y marca la reserva como CONFIRMADA.
 */
export const POST = apiHandler<ConfirmarPagoBody>(
  async (request, ctx, { body }) => {
    const user = ctx.user!;

    const { id } = ctx.params;

    const reserva = await db.query.reservas.findFirst({
      where: and(eq(reservas.id, id), eq(reservas.tenantId, user.sub)),
    });

    if (!reserva) {
      return NextResponse.json({ error: "Reserva no encontrada o no te pertenece" }, { status: 404 });
    }

    // Sobre una reserva muerta no se cobra nada.
    if (reserva.estado === "CANCELADA" || reserva.estado === "EXPIRADA") {
      return NextResponse.json({ error: "No se puede cobrar una reserva cancelada" }, { status: 400 });
    }

    const metodo = body?.metodo ?? "EFECTIVO";
    const montoTotal = Number(reserva.montoTotal);
    const yaPagado = Number(reserva.montoPagado);
    const saldo = montoTotal - yaPagado;

    // Lo que habilita el cobro es que haya saldo, no en qué punto del partido
    // estemos. Antes esto se preguntaba por el estado, y como COMPLETADA se
    // trataba igual que CONFIRMADA, marcar un partido como jugado dejaba la
    // deuda sin forma de registrarse por ningún camino: el jugador quedaba
    // bloqueado para siempre. "Se jugó" y "se pagó" son preguntas distintas.
    if (saldo <= 0) {
      return NextResponse.json({ error: "Esta reserva no tiene saldo pendiente" }, { status: 400 });
    }

    // Sin monto, el dueño está cobrando todo lo que falta.
    const nuevoPago = body?.monto ?? saldo;

    if (nuevoPago > saldo) {
      return NextResponse.json(
        { error: `El monto excede el saldo pendiente (${saldo.toLocaleString("es-CO")} COP)` },
        { status: 400 }
      );
    }

    const pagadoTotal = yaPagado + nuevoPago;
    const saldoNuevo = montoTotal - pagadoTotal;

    await db.transaction(async (tx) => {
      await tx.insert(pagos).values({
        reservaId: reserva.id,
        userId: reserva.playerId,
        monto: nuevoPago.toFixed(2),
        estadoPago: "APROBADO",
        // Lo cobró el dueño en el complejo: no pasó por la app ni por MP.
        canal: "PRESENCIAL",
        metodo,
        entidad: body?.entidad ?? null,
        mpMetadata: { confirmadoPor: user.sub },
      });
      await tx
        .update(reservas)
        .set({
          montoPagado: pagadoTotal.toFixed(2),
          saldoPendiente: saldoNuevo.toFixed(2),
          // Cobrar no "des-juega" un partido: si ya estaba COMPLETADA se
          // queda así. Sólo cambia el eje del dinero.
          estado:
            saldoNuevo > 0
              ? "PAGO_PARCIAL"
              : reserva.estado === "COMPLETADA"
                ? "COMPLETADA"
                : "CONFIRMADA",
        })
        .where(eq(reservas.id, reserva.id));
    });

    await notificarReserva(
      reserva.id,
      saldoNuevo > 0 ? "PAGO_PARCIAL_RECIBIDO" : "RESERVA_CONFIRMADA"
    );

    return NextResponse.json({
      reservaId: reserva.id,
      estado:
        saldoNuevo > 0
          ? "PAGO_PARCIAL"
          : reserva.estado === "COMPLETADA"
            ? "COMPLETADA"
            : "CONFIRMADA",
      metodo,
      entidad: body?.entidad ?? null,
      montoConfirmado: nuevoPago,
      saldoPendiente: saldoNuevo,
    });
  },
  {
    requireAuth: true,
    requiredRole: "OWNER",
    bodySchema: confirmarPagoSchema,
  }
);
