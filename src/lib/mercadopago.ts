import { MercadoPagoConfig, Payment, PaymentRefund } from "mercadopago";
import crypto from "crypto";

/**
 * MercadoPago wrapper — Split Payments 1:N + Webhook verification.
 *
 * Configuración desde variables de entorno:
 * - MP_ACCESS_TOKEN: token de acceso (producción o sandbox)
 * - MP_WEBHOOK_SECRET: secreto para verificar webhooks
 * - MP_PUBLIC_KEY: clave pública (frontend)
 */

// ─── Config ──────────────────────────────────────────────────────────────────

const accessToken = process.env.MP_ACCESS_TOKEN || "";
const webhookSecret = process.env.MP_WEBHOOK_SECRET || "";

const mp = accessToken ? new MercadoPagoConfig({ accessToken }) : null;

// IDs de receptor — el dueño es dinámico, la plataforma es fija
const PLATFORM_RECEIVER_ID = "sfs-platform";

// ─── Split API (vía fetch — el SDK no expone splits nativamente) ─────────────

const MP_API = "https://api.mercadopago.com";

interface SplitResult {
  splitId: string;
  checkoutUrl: string;
}

/**
 * Crea un split de pago 1:N entre el dueño (85%) y SFS (15%).
 * Retorna el ID del split y la URL de checkout.
 */
export async function createSplit(
  reservaId: string,
  monto: number,
  payerEmail: string,
  ownerReceiverId: string
): Promise<SplitResult> {
  const totalAmount = monto.toFixed(2);
  const ownerAmount = (monto * 0.85).toFixed(2);
  const platformAmount = (monto * 0.15).toFixed(2);

  const body = {
    id: `RES-${reservaId}-${Date.now()}`,
    type: "online",
    total_amount: totalAmount,
    config: {
      online: {
        transaction_security: {
          validation: "always",
          liability_shift: "required",
        },
      },
      split_rules: {
        amount_type: "FIXED",
      },
    },
    splits: [
      {
        receiver_id: ownerReceiverId,
        receiver_type: "owner",
        amount: ownerAmount,
        description: "Pago al dueño de la cancha",
      },
      {
        receiver_id: PLATFORM_RECEIVER_ID,
        receiver_type: "partner",
        amount: platformAmount,
        description: "Comisión SFS",
      },
    ],
    external_reference: reservaId,
    payer: {
      email: payerEmail,
    },
    processing_mode: "automatic",
    capture_mode: "automatic_async",
  };

  const response = await fetch(`${MP_API}/v1/splits`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`MP Split error: ${response.status} — ${err}`);
  }

  const data = await response.json();

  // El checkout URL viene en la respuesta o se construye
  const splitId = data.id;
  const checkoutUrl = `https://www.mercadopago.com.co/checkout/v1/redirect?preference-id=${splitId}`;

  return { splitId, checkoutUrl };
}

// ─── Checkout Pro (fallback sin split) ──────────────────────────────────────

/**
 * Crea un preference simple de Checkout Pro (sin split).
 * Fallback cuando el dueño no tiene cuenta MP configurada.
 */
export async function createCheckoutPreference(
  reservaId: string,
  monto: number,
  payerEmail: string
): Promise<{ preferenceId: string; checkoutUrl: string }> {
  const body = {
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
    payer: { email: payerEmail },
    external_reference: reservaId,
    back_urls: {
      success: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/player/reservas`,
      failure: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/player/buscar`,
      pending: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/player/reservas`,
    },
    auto_return: "approved",
  };

  const response = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("[MP] Preference error:", response.status, err);
    throw new Error(`MP Preference: ${response.status} — ${err}`);
  }

  const data = await response.json();

  return {
    preferenceId: data.id,
    checkoutUrl: data.init_point || data.sandbox_init_point,
  };
}

// ─── Webhook Verification ────────────────────────────────────────────────────

/**
 * Verifica la firma HMAC del webhook de MercadoPago.
 * MP envía el header x-signature con formato: ts={timestamp},v1={hmac}
 */
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

/**
 * Parsea el header x-signature de MP y verifica.
 */
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

/**
 * Obtiene el estado de un pago por su ID de MercadoPago.
 */
export async function getPayment(mpPaymentId: string) {
  if (!mp) throw new Error("MercadoPago no configurado");

  const payment = new Payment(mp);
  return payment.get({ id: mpPaymentId });
}

/**
 * Reembolsa un pago total o parcialmente.
 */
export async function refundPayment(mpPaymentId: string, amount?: number) {
  if (!mp) throw new Error("MercadoPago no configurado");

  const refund = new PaymentRefund(mp);
  const body: Record<string, unknown> = { payment_id: mpPaymentId };
  if (amount) body.amount = amount;

  return refund.create({ payment_id: mpPaymentId, body });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Devuelve true si MercadoPago está configurado.
 */
export function isMercadoPagoConfigured(): boolean {
  return !!accessToken;
}
