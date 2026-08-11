import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { apiHandler } from "@/lib/api-handler";
import { crearPagoSchema, type CrearPagoInput } from "@/lib/schemas";
import { createSplit, createCheckoutPreference, isMercadoPagoConfigured } from "@/lib/mercadopago";
import { calcularPrecio, usarPromocion } from "@/lib/pricing";
import { RATE_LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/reservas/:id/pagar
 *
 * Inicia el pago de una reserva existente. Crea un split en MercadoPago y
 * retorna la URL de checkout. El monto debe ser al menos el 50% del total.
 */
export const POST = apiHandler<CrearPagoInput>(
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

    // Extraer reservaId de la URL
    const id = request.url.split("/reservas/")[1]?.split("/")[0];
    if (!id) {
      return NextResponse.json({ error: "ID de reserva requerido" }, { status: 400 });
    }

    // ─── 1. Buscar reserva ─────────────────────────────────────────────

    const reserva = await prisma.reserva.findFirst({
      where: { id, playerId: user.sub },
      include: {
        cancha: {
          include: { complejo: true },
        },
      },
    });

    if (!reserva) {
      return NextResponse.json(
        { error: "Reserva no encontrada" },
        { status: 404 }
      );
    }

    if (reserva.estado === "CANCELADA" || reserva.estado === "COMPLETADA") {
      return NextResponse.json(
        { error: "Esta reserva ya no acepta pagos" },
        { status: 400 }
      );
    }

    // ─── 2. Validar monto mínimo (50%) ──────────────────────────────────

    const montoTotal = Number(reserva.montoTotal);
    const montoPagado = Number(reserva.montoPagado);
    const montoMinimo = Math.round(montoTotal * 0.5);
    const maximoPermitido = montoTotal - montoPagado;

    if (monto < montoMinimo && reserva.estado === "PENDIENTE_PAGO") {
      return NextResponse.json(
        { error: `El pago mínimo es del 50% (${montoMinimo.toLocaleString("es-CO")} COP)` },
        { status: 400 }
      );
    }

    if (monto > maximoPermitido) {
      return NextResponse.json(
        { error: `El monto excede el saldo pendiente (${maximoPermitido.toLocaleString("es-CO")} COP)` },
        { status: 400 }
      );
    }

    // ─── 3. Usar promoción si aplica ────────────────────────────────────

    // La promoción ya fue validada al crear la reserva (en el precio)
    // Si el monto total incluye descuento, no necesitamos re-aplicarla

    // ─── 4. Crear split en MP ───────────────────────────────────────────

    const ownerReceiverId = reserva.cancha.tenantId; // owner = tenant
    // Try split first, fallback to simple preference
    let split: { splitId?: string; checkoutUrl: string };
    let isSplit = true;

    try {
      split = await createSplit(reserva.id, monto, user.email, ownerReceiverId);
    } catch (splitError: any) {
      console.warn("[MP] Split falló, usando preference:", splitError.message?.slice(0, 100));
      try {
        split = await createCheckoutPreference(reserva.id, monto, user.email);
        isSplit = false;
      } catch (prefError: any) {
        console.error("[MP] Preference también falló:", prefError);
        return NextResponse.json(
          { error: `MP Error: ${prefError.message?.slice(0, 200) || "Error desconocido"}` },
          { status: 502 }
        );
      }
    }

    // ─── 5. Registrar pago pendiente ────────────────────────────────────

    await prisma.pago.create({
      data: {
        reservaId: reserva.id,
        userId: user.sub,
        monto,
        estadoPago: "PENDIENTE",
        mpSplitId: isSplit ? split.splitId : null,
        mpPaymentId: !isSplit ? split.splitId : null, // preference usa preferenceId como reference
      },
    });

    return NextResponse.json({
      reservaId: reserva.id,
      monto,
      checkoutUrl: split.checkoutUrl,
      tipo: isSplit ? "split" : "preference",
    });
  },
  {
    requireAuth: true,
    requireCsrf: false,
    bodySchema: crearPagoSchema,
    rateLimit: RATE_LIMITS.STRICT,
  }
);
