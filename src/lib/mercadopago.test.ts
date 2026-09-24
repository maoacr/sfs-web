import { describe, it, expect } from "vitest";
import crypto from "crypto";
import {
  verifyWebhookRequest,
  estadoPagoDesdeMp,
  isMercadoPagoConfigured,
} from "@/lib/mercadopago";

const SECRET = "test-secret-123";

function firmar(manifest: string, secret = SECRET) {
  return crypto.createHmac("sha256", secret).update(manifest).digest("hex");
}

describe("verifyWebhookRequest", () => {
  const ts = "1704908010";
  const requestId = "bb56a2f1-6aae-46ac-982e-9dcd3581d08e";
  const dataId = "123456789";

  it("acepta la firma construida con id, request-id y ts", () => {
    const v1 = firmar(`id:${dataId};request-id:${requestId};ts:${ts};`);
    expect(
      verifyWebhookRequest({ dataId, requestId, signatureHeader: `ts=${ts},v1=${v1}`, secret: SECRET })
    ).toBe(true);
  });

  it("rechaza una firma que omite el request-id", () => {
    const v1 = firmar(`id:${dataId};ts:${ts};`);
    expect(
      verifyWebhookRequest({ dataId, requestId, signatureHeader: `ts=${ts},v1=${v1}`, secret: SECRET })
    ).toBe(false);
  });

  it("omite el request-id del manifest cuando MP no lo envía", () => {
    const v1 = firmar(`id:${dataId};ts:${ts};`);
    expect(
      verifyWebhookRequest({ dataId, requestId: null, signatureHeader: `ts=${ts},v1=${v1}`, secret: SECRET })
    ).toBe(true);
  });

  it("usa el data.id en minúsculas cuando es alfanumérico", () => {
    const v1 = firmar(`id:abc123;request-id:${requestId};ts:${ts};`);
    expect(
      verifyWebhookRequest({ dataId: "ABC123", requestId, signatureHeader: `ts=${ts},v1=${v1}`, secret: SECRET })
    ).toBe(true);
  });

  it("rechaza una firma de otro largo sin lanzar excepción", () => {
    expect(
      verifyWebhookRequest({ dataId, requestId, signatureHeader: `ts=${ts},v1=abc`, secret: SECRET })
    ).toBe(false);
  });

  it("rechaza header nulo o mal formado cuando hay secret", () => {
    expect(verifyWebhookRequest({ dataId, requestId, signatureHeader: null, secret: SECRET })).toBe(false);
    expect(verifyWebhookRequest({ dataId, requestId, signatureHeader: "garbage", secret: SECRET })).toBe(false);
  });

  it("acepta sin verificar cuando no hay secret configurado", () => {
    expect(verifyWebhookRequest({ dataId, requestId, signatureHeader: null, secret: "" })).toBe(true);
  });
});

describe("estadoPagoDesdeMp", () => {
  it.each([
    ["approved", "APROBADO"],
    ["rejected", "RECHAZADO"],
    ["cancelled", "RECHAZADO"],
    ["refunded", "REEMBOLSADO"],
    ["charged_back", "REEMBOLSADO"],
    ["pending", "PENDIENTE"],
    ["in_process", "PENDIENTE"],
    [undefined, "PENDIENTE"],
  ])("%s → %s", (status, esperado) => {
    expect(estadoPagoDesdeMp(status)).toBe(esperado);
  });
});

describe("isMercadoPagoConfigured", () => {
  it("retorna un boolean", () => {
    expect(typeof isMercadoPagoConfigured()).toBe("boolean");
  });
});
