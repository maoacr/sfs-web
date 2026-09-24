import MercadoPago, { Preference, Payment, PaymentRefund } from "mercadopago";
import crypto from "crypto";
import type { Pago } from "@sfs/db";

/**
 * MercadoPago wrapper — Checkout Pro Preferences + Webhook verification.
 *
 * Variables de entorno:
 * - MP_ACCESS_TOKEN: token de acceso (TEST-xxx para sandbox, APP_USR-xxx para prod)
 * - MP_WEBHOOK_SECRET: clave secreta de webhooks del panel de MP
 */

const accessToken = process.env.MP_ACCESS_TOKEN || "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function mpClient() {
  if (!accessToken) throw new Error("MP_ACCESS_TOKEN no configurado");
  return new MercadoPago({ accessToken, options: { timeout: 5000 } });
}

// ─── Preference (Checkout Pro) ───────────────────────────────────────────────

/**
 * Crea un Checkout Pro preference para un pago ya registrado.
 * `external_reference` es el id del Pago: el webhook lo usa para encontrarlo.
 * No se envía payer.email — en sandbox, un email que no es de un test user
 * causa rechazo.
 */
export async function createCheckoutPreference(params: {
  pagoId: string;
  reservaId: string;
  monto: number;
}): Promise<{ preferenceId: string; checkoutUrl: string }> {
  const preference = new Preference(mpClient());

  const result = await preference.create({
    body: {
      items: [
        {
          id: params.reservaId,
          title: "Reserva de cancha SFS",
          description: `Reserva #${params.reservaId.slice(0, 8)}`,
          quantity: 1,
          unit_price: Number(params.monto.toFixed(2)),
          currency_id: "COP",
        },
      ],
      external_reference: params.pagoId,
      metadata: { reserva_id: params.reservaId },
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
    checkoutUrl: accessToken.startsWith("TEST-")
      ? result.sandbox_init_point!
      : result.init_point!,
  };
}

// ─── Webhook Verification ────────────────────────────────────────────────────

/**
 * Valida el header x-signature de MP. El manifest firmado es
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, omitiendo las partes
 * que MP no envía. Un data.id alfanumérico se firma en minúsculas.
 */
export function verifyWebhookRequest({
  dataId,
  requestId,
  signatureHeader,
  secret = process.env.MP_WEBHOOK_SECRET || "",
}: {
  dataId: string;
  requestId: string | null;
  signatureHeader: string | null;
  secret?: string;
}): boolean {
  if (!secret) {
    console.warn("[MP] MP_WEBHOOK_SECRET no configurado — aceptando sin verificar");
    return true;
  }
  if (!signatureHeader) return false;

  const partes = new Map(
    signatureHeader.split(",").map((p) => {
      const [k, ...v] = p.trim().split("=");
      return [k, v.join("=")] as const;
    })
  );
  const ts = partes.get("ts");
  const v1 = partes.get("v1");
  if (!ts || !v1) return false;

  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest =
    `id:${id};` + (requestId ? `request-id:${requestId};` : "") + `ts:${ts};`;

  const esperado = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  return (
    esperado.length === v1.length &&
    crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(v1))
  );
}

// ─── Payment Operations ──────────────────────────────────────────────────────

export function estadoPagoDesdeMp(status: string | undefined): Pago["estadoPago"] {
  switch (status) {
    case "approved":
      return "APROBADO";
    case "rejected":
    case "cancelled":
      return "RECHAZADO";
    case "refunded":
    case "charged_back":
      return "REEMBOLSADO";
    default:
      return "PENDIENTE";
  }
}

export async function getPayment(mpPaymentId: string) {
  return new Payment(mpClient()).get({ id: mpPaymentId });
}

export async function refundPayment(mpPaymentId: string, amount?: number) {
  return new PaymentRefund(mpClient()).create({
    payment_id: mpPaymentId,
    body: amount ? { amount } : {},
  });
}

export function isMercadoPagoConfigured(): boolean {
  return !!accessToken;
}
