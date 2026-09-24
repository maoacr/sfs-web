import { NextResponse } from "next/server";
import { db, reservas } from "@sfs/db";
import { and, eq } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import { crearPagoSchema, type CrearPagoInput } from "@/lib/schemas";
import { isMercadoPagoConfigured } from "@/lib/mercadopago";
import { iniciarPagoMp } from "@/lib/pagos";
import { RATE_LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/reservas/:id/pagar
 *
 * Inicia el pago de una reserva existente y retorna la URL de checkout de MP.
 * Si la reserva está pendiente, el monto debe ser al menos el 50% del total.
 */
export const POST = apiHandler<CrearPagoInput>(
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
      where: and(eq(reservas.id, id), eq(reservas.playerId, user.sub)),
    });

    if (!reserva) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }

    if (reserva.estado !== "PENDIENTE_PAGO" && reserva.estado !== "PAGO_PARCIAL") {
      return NextResponse.json({ error: "Esta reserva ya no acepta pagos" }, { status: 400 });
    }

    const montoTotal = Number(reserva.montoTotal);
    const montoMinimo = Math.round(montoTotal * 0.5);
    const maximoPermitido = montoTotal - Number(reserva.montoPagado);

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

    try {
      const { checkoutUrl } = await iniciarPagoMp({ reservaId: reserva.id, userId: user.sub, monto });
      return NextResponse.json({ reservaId: reserva.id, monto, checkoutUrl, tipo: "preference" });
    } catch (error) {
      console.error("[MP] Error creando preference:", error);
      const mensaje = error instanceof Error ? error.message.slice(0, 200) : "Error desconocido";
      return NextResponse.json({ error: `MP Error: ${mensaje}` }, { status: 502 });
    }
  },
  {
    requireAuth: true,
    bodySchema: crearPagoSchema,
    rateLimit: RATE_LIMITS.STRICT,
  }
);
