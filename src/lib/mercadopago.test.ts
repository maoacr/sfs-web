import { describe, it, expect, vi, afterEach } from "vitest";
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

describe("verifyWebhookRequest con varias claves", () => {
  const ts = "1704908010";
  const requestId = "bb56a2f1-6aae-46ac-982e-9dcd3581d08e";
  const dataId = "123456789";
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;

  const PRUEBA = "clave-modo-prueba";
  const PRODUCTIVO = "clave-modo-productivo";

  function verificar(secret: string, firmadaCon: string) {
    return verifyWebhookRequest({
      dataId,
      requestId,
      signatureHeader: `ts=${ts},v1=${firmar(manifest, firmadaCon)}`,
      secret,
    });
  }

  it("acepta la firma hecha con la primera clave de la lista", () => {
    expect(verificar(`${PRUEBA},${PRODUCTIVO}`, PRUEBA)).toBe(true);
  });

  it("acepta la firma hecha con la segunda clave de la lista", () => {
    expect(verificar(`${PRUEBA},${PRODUCTIVO}`, PRODUCTIVO)).toBe(true);
  });

  it("rechaza una firma hecha con una clave que no está en la lista", () => {
    expect(verificar(`${PRUEBA},${PRODUCTIVO}`, "clave-ajena")).toBe(false);
  });

  it("tolera espacios y saltos alrededor de las comas", () => {
    expect(verificar(`  ${PRUEBA} ,\n ${PRODUCTIVO}  `, PRODUCTIVO)).toBe(true);
  });

  it("ignora las entradas vacías sin volverse permisivo", () => {
    expect(verificar(`${PRUEBA},,`, PRUEBA)).toBe(true);
    expect(verificar(`${PRUEBA},,`, "clave-ajena")).toBe(false);
  });

  it("trata una lista sin claves reales como secret no configurado", () => {
    expect(
      verifyWebhookRequest({ dataId, requestId, signatureHeader: null, secret: " , , " })
    ).toBe(true);
  });

  it("sigue rechazando header nulo cuando hay claves configuradas", () => {
    expect(
      verifyWebhookRequest({
        dataId,
        requestId,
        signatureHeader: null,
        secret: `${PRUEBA},${PRODUCTIVO}`,
      })
    ).toBe(false);
  });
});

describe("createCheckoutPreference", () => {
  interface PreferenceArgs {
    body: {
      auto_return?: string;
      back_urls: { success: string; failure: string; pending: string };
      notification_url: string;
    };
  }

  const crear = vi.fn(async (_args: PreferenceArgs) => ({
    id: "pref-1",
    init_point: "https://mp/checkout",
    sandbox_init_point: "https://mp/sandbox",
  }));

  function bodyDeLaPreference() {
    const llamada = crear.mock.calls[0];
    if (!llamada) throw new Error("No se creó ninguna preference");
    return llamada[0].body;
  }

  async function importarConToken(token: string, appUrl = "https://sfs.example.com") {
    vi.resetModules();
    crear.mockClear();
    vi.stubEnv("MP_ACCESS_TOKEN", token);
    vi.stubEnv("APP_URL", appUrl);
    vi.doMock("mercadopago", () => ({
      default: class {},
      Preference: class {
        create = crear;
      },
      Payment: class {},
      PaymentRefund: class {},
    }));
    return import("@/lib/mercadopago");
  }

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("mercadopago");
  });

  const params = { pagoId: "pago-1", reservaId: "reserva-1", monto: 80000 };

  it("manda auto_return para que MP devuelva al jugador al sitio", async () => {
    const { createCheckoutPreference } = await importarConToken("TEST-abc");
    await createCheckoutPreference(params);

    expect(crear).toHaveBeenCalledTimes(1);
    expect(bodyDeLaPreference().auto_return).toBe("approved");
  });

  it("omite auto_return cuando APP_URL no es pública", async () => {
    // MercadoPago rechaza la preference entera con "back_url.success must be
    // defined" —que no significa que falte, sino que no le sirve—. Sin
    // auto_return el pago funciona igual, sólo queda el botón "Volver al
    // sitio". Perder el redirect es mucho mejor que no poder cobrar en local.
    const { createCheckoutPreference } = await importarConToken("TEST-abc", "http://localhost:3000");
    await createCheckoutPreference(params);

    expect(bodyDeLaPreference().auto_return).toBeUndefined();
  });

  it("sigue mandando las back_urls aunque omita auto_return", async () => {
    const { createCheckoutPreference } = await importarConToken("TEST-abc", "http://localhost:3000");
    await createCheckoutPreference(params);

    expect(bodyDeLaPreference().back_urls.success).toBe("http://localhost:3000/player/reservas");
  });

  it("manda auto_return con una URL pública de túnel", async () => {
    const { createCheckoutPreference } = await importarConToken("TEST-abc", "https://algo.trycloudflare.com");
    await createCheckoutPreference(params);

    expect(bodyDeLaPreference().auto_return).toBe("approved");
  });

  it("apunta back_urls y notification_url a APP_URL", async () => {
    const { createCheckoutPreference } = await importarConToken("TEST-abc");
    await createCheckoutPreference(params);

    const { back_urls, notification_url } = bodyDeLaPreference();
    expect(back_urls.success).toBe("https://sfs.example.com/player/reservas");
    expect(notification_url).toBe("https://sfs.example.com/api/webhooks/mercadopago");
  });

  it("usa el sandbox_init_point con credenciales TEST-", async () => {
    const { createCheckoutPreference } = await importarConToken("TEST-abc");
    const { checkoutUrl } = await createCheckoutPreference(params);
    expect(checkoutUrl).toBe("https://mp/sandbox");
  });

  it("usa el init_point con credenciales APP_USR-", async () => {
    const { createCheckoutPreference } = await importarConToken("APP_USR-abc");
    const { checkoutUrl } = await createCheckoutPreference(params);
    expect(checkoutUrl).toBe("https://mp/checkout");
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
