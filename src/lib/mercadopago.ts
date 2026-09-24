import MercadoPago, { Preference, Payment, PaymentRefund } from "mercadopago";
import crypto from "crypto";

/**
 * MercadoPago wrapper — Checkout Pro Preferences + Webhook verification.
 *
 * Configuración desde variables de entorno:
 * - MP_ACCESS_TOKEN: token de acceso (TEST-xxx para sandbox, APP_USR-xxx para prod)
 * - MP_WEBHOOK_SECRET: secreto para verificar webhooks
 */

// ─── Config ──────────────────────────────────────────────────────────────────

const accessToken = process.env.MP_ACCESS_TOKEN || "";
const webhookSecret = process.env.MP_WEBHOOK_SECRET || "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// ─── Preference (Checkout Pro) ───────────────────────────────────────────────

/**
 * Crea un Checkout Pro preference y retorna la URL de pago.
 * No se envía payer.email — MP checkout le pide al comprador que se loguee.
 * En sandbox, enviar un email que no es de un test user causa rechazo.
 */
export async function createCheckoutPreference(
  reservaId: string,
  monto: number,
  _payerEmail: string
): Promise<{ preferenceId: string; checkoutUrl: string }> {
  if (!accessToken) {
    throw new Error("MP_ACCESS_TOKEN no configurado en .env");
  }

  const client = new MercadoPago({ accessToken, options: { timeout: 5000 } });
  const preference = new Preference(client);

  const result = await preference.create({
    body: {
      items: [
        {
          id: reservaId,
          title: "Reserva de cancha SFS",
          description: `Reserva #${reservaId.slice(0, 8)}`,
          quantity: 1,
          unit_price: Number(monto.toFixed(2)),
          currency_id: "COP",
        },
      ],
      external_reference: reservaId,
      back_urls: {
        success: `${APP_URL}/player/reservas`,
        failure: `${APP_URL}/player/buscar`,
        pending: `${APP_URL}/player/reservas`,
      },
      notification_url: `${APP_URL}/api/webhooks/mercadopago`,
    },
  });

  return {
    preferenceId: result.id!,
    checkoutUrl: process.env.NODE_ENV === "production" 
      ? result.init_point! 
      : result.sandbox_init_point!,
  };
}

// ─── Split (fallback — mismo comportamiento) ─────────────────────────────────

/**
 * Por ahora, mismo que createCheckoutPreference — el split se implementa
 * cuando los dueños tengan cuentas MP con receiver_id numérico.
 */
export async function createSplit(
  reservaId: string,
  monto: number,
  payerEmail: string,
  _ownerReceiverId: string
): Promise<{ splitId: string; checkoutUrl: string }> {
  const result = await createCheckoutPreference(reservaId, monto, payerEmail);
  return { splitId: result.preferenceId, checkoutUrl: result.checkoutUrl };
}

// ─── Webhook Verification ────────────────────────────────────────────────────

export function verifyWebhookSignature(
  dataId: string,
  ts: string,
  signature: string
): boolean {
  if (!webhookSecret) {
    console.warn("[MP] Webhook secret no configurado — aceptando sin verificar");
    return true;
  }

  const payload = `id:${dataId};ts:${ts};`;
  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
}

export function verifyWebhookRequest(
  dataId: string,
  signatureHeader: string | null
): boolean {
  if (!signatureHeader) return false;
  const parts = signatureHeader.split(",");
  const ts = parts.find((p) => p.startsWith("ts="))?.split("=")[1];
  const sig = parts.find((p) => p.startsWith("v1="))?.split("=")[1];
  if (!ts || !sig) return false;
  return verifyWebhookSignature(dataId, ts, sig);
}

// ─── Payment Operations ──────────────────────────────────────────────────────

export async function getPayment(mpPaymentId: string) {
  if (!accessToken) throw new Error("MP no configurado");
  const client = new MercadoPago({ accessToken, options: { timeout: 5000 } });
  const payment = new Payment(client);
  return payment.get({ id: mpPaymentId });
}

export async function refundPayment(mpPaymentId: string, amount?: number) {
  if (!accessToken) throw new Error("MP no configurado");
  const client = new MercadoPago({ accessToken, options: { timeout: 5000 } });
  const refund = new PaymentRefund(client);
  const body: Record<string, unknown> = { payment_id: mpPaymentId };
  if (amount) body.amount = amount;
  return refund.create({ payment_id: mpPaymentId, body });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isMercadoPagoConfigured(): boolean {
  return !!accessToken;
}
