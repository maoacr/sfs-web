import { NextResponse } from "next/server";
import { db, reservas } from "@sfs/db";
import { eq } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import { pagarSaldoSchema, type PagarSaldoInput } from "@/lib/schemas";
import { isMercadoPagoConfigured } from "@/lib/mercadopago";
import { iniciarPagoMp } from "@/lib/pagos";
import { RATE_LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/reservas/:id/pagar-saldo
 *
 * Paga el saldo pendiente de una reserva en estado PAGO_PARCIAL.
 * Puede pagar el titular de la reserva o cualquier jugador del partido asociado.
 */
export const POST = apiHandler<PagarSaldoInput>(
  async (request, ctx, { body }) => {
    if (!isMercadoPagoConfigured()) {
      return NextResponse.json({ error: "MercadoPago no está configurado" }, { status: 503 });
    }
    if (!body) {
      return NextResponse.json({ error: "Datos requeridos" }, { status: 400 });
    }

    const user = ctx.user!;
    const { monto } = body;

    const id = request.url.split("/reservas/")[1]?.split("/")[0];
    if (!id) {
      return NextResponse.json({ error: "ID de reserva requerido" }, { status: 400 });
    }

    const reserva = await db.query.reservas.findFirst({
      where: eq(reservas.id, id),
      with: { partido: { with: { jugadores: { columns: { userId: true } } } } },
    });

    if (!reserva) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }

    const esPlayer = reserva.playerId === user.sub;
    const esJugadorPartido = reserva.partido?.jugadores.some((j) => j.userId === user.sub) ?? false;

    if (!esPlayer && !esJugadorPartido) {
      return NextResponse.json({ error: "No tenés permiso para pagar esta reserva" }, { status: 403 });
    }

    if (reserva.estado !== "PAGO_PARCIAL") {
      return NextResponse.json({ error: "Esta reserva no tiene saldo pendiente" }, { status: 400 });
    }

    const saldoPendiente = Number(reserva.saldoPendiente);
    if (monto > saldoPendiente) {
      return NextResponse.json(
        { error: `El monto excede el saldo pendiente (${saldoPendiente.toLocaleString("es-CO")} COP)` },
        { status: 400 }
      );
    }

    try {
      const { checkoutUrl } = await iniciarPagoMp({ reservaId: reserva.id, userId: user.sub, monto });
      return NextResponse.json({ reservaId: reserva.id, monto, pagadoPor: user.sub, checkoutUrl });
    } catch (error) {
      console.error("[MP] Error creando preference:", error);
      return NextResponse.json({ error: "Error al crear el pago. Intenta de nuevo." }, { status: 502 });
    }
  },
  {
    requireAuth: true,
    bodySchema: pagarSaldoSchema,
    rateLimit: RATE_LIMITS.STRICT,
  }
);
