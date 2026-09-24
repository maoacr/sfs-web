import { NextRequest, NextResponse } from "next/server";
import { db, pagos } from "@sfs/db";
import { eq } from "drizzle-orm";
import { verifyWebhookRequest, getPayment, refundPayment } from "@/lib/mercadopago";
import { registrarPagoMp } from "@/lib/pagos";
import { notificarReserva } from "@/lib/event-listeners";

/**
 * POST /api/webhooks/mercadopago
 *
 * Verifica la firma, consulta el pago a MP y lo aplica a su Pago/Reserva.
 * Los errores devuelven 500 para que MP reintente; el registro es idempotente.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const dataId = request.nextUrl.searchParams.get("data.id") ?? body?.data?.id;

  if (!dataId) {
    return NextResponse.json({ error: "Falta data.id" }, { status: 400 });
  }

  const firmaValida = verifyWebhookRequest({
    dataId: String(dataId),
    requestId: request.headers.get("x-request-id"),
    signatureHeader: request.headers.get("x-signature"),
  });
  if (!firmaValida) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  const tipo = body?.type ?? request.nextUrl.searchParams.get("type");
  if (tipo !== "payment") {
    return NextResponse.json({ ok: true, skipped: tipo });
  }

  try {
    const mpPayment = await getPayment(String(dataId));
    const resultado = await registrarPagoMp(mpPayment);

    if (resultado.tipo === "reembolsar") {
      try {
        await refundPayment(resultado.mpPaymentId);
        await db
          .update(pagos)
          .set({ estadoPago: "REEMBOLSADO" })
          .where(eq(pagos.id, resultado.pagoId));
      } catch (error) {
        // Un reintento de MP ya vería el pago como procesado: requiere reembolso manual.
        console.error(`[MP Webhook] Reembolso manual requerido para pago ${resultado.pagoId}:`, error);
      }
    }

    if (resultado.tipo === "aplicado") {
      await notificarReserva(
        resultado.reservaId,
        resultado.estado === "CONFIRMADA" ? "RESERVA_CONFIRMADA" : "PAGO_PARCIAL_RECIBIDO"
      ).catch((error) => console.error("[MP Webhook] Error notificando:", error));
    }

    return NextResponse.json({ ok: true, resultado });
  } catch (error) {
    console.error("[MP Webhook] Error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
