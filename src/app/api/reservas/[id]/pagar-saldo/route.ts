import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { apiHandler } from "@/lib/api-handler";
import { pagarSaldoSchema, type PagarSaldoInput } from "@/lib/schemas";
import { createSplit, isMercadoPagoConfigured } from "@/lib/mercadopago";
import { RATE_LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/reservas/:id/pagar-saldo
 *
 * Paga el saldo pendiente de una reserva en estado PAGO_PARCIAL.
 * Cualquier jugador del partido asociado puede pagar.
 */
export const POST = apiHandler<PagarSaldoInput>(
  async (request, ctx, { body }) => {
    if (!isMercadoPagoConfigured()) {
      return NextResponse.json(
        { error: "MercadoPago no está configurado" },
        { status: 503 }
      );
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

    // ─── 1. Buscar reserva ─────────────────────────────────────────────

    const reserva = await prisma.reserva.findFirst({
      where: { id },
      include: {
        cancha: { include: { complejo: true } },
        partido: { include: { jugadores: true } },
      },
    });

    if (!reserva) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }

    // Verificar que el usuario es el player o un jugador del partido
    const esPlayer = reserva.playerId === user.sub;
    const esJugadorPartido = reserva.partido?.jugadores.some(
      (j) => j.userId === user.sub
    );

    if (!esPlayer && !esJugadorPartido) {
      return NextResponse.json(
        { error: "No tenés permiso para pagar esta reserva" },
        { status: 403 }
      );
    }

    if (reserva.estado !== "PAGO_PARCIAL") {
      return NextResponse.json(
        { error: "Esta reserva no tiene saldo pendiente" },
        { status: 400 }
      );
    }

    // ─── 2. Validar monto ──────────────────────────────────────────────

    const saldoPendiente = Number(reserva.saldoPendiente);

    if (monto <= 0) {
      return NextResponse.json(
        { error: "El monto debe ser mayor a 0" },
        { status: 400 }
      );
    }

    if (monto > saldoPendiente) {
      return NextResponse.json(
        { error: `El monto excede el saldo pendiente (${saldoPendiente.toLocaleString("es-CO")} COP)` },
        { status: 400 }
      );
    }

    // ─── 3. Crear split en MP ───────────────────────────────────────────

    const ownerReceiverId = reserva.cancha.tenantId;
    let split: { splitId: string; checkoutUrl: string };

    try {
      split = await createSplit(reserva.id, monto, user.email, ownerReceiverId);
    } catch (error: any) {
      console.error("[MP] Error creando split:", error);
      return NextResponse.json(
        { error: "Error al crear el pago. Intenta de nuevo." },
        { status: 502 }
      );
    }

    // ─── 4. Registrar pago pendiente ────────────────────────────────────

    await prisma.pago.create({
      data: {
        reservaId: reserva.id,
        userId: user.sub,
        monto,
        estadoPago: "PENDIENTE",
        mpSplitId: split.splitId,
      },
    });

    return NextResponse.json({
      reservaId: reserva.id,
      monto,
      pagadoPor: user.sub,
      checkoutUrl: split.checkoutUrl,
    });
  },
  {
    requireAuth: true,
    requireCsrf: false,
    bodySchema: pagarSaldoSchema,
    rateLimit: RATE_LIMITS.STRICT,
  }
);
