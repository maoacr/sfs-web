// @vitest-environment node
//
// El camino por donde entra la plata. Si este endpoint falla en silencio, el
// jugador paga y la reserva nunca se confirma: cobrado y sin cancha.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  verifyWebhookRequest: vi.fn(),
  getPayment: vi.fn(),
  refundPayment: vi.fn(),
  registrarPagoMp: vi.fn(),
  notificarReserva: vi.fn(),
  valoresDelUpdate: vi.fn(),
}));

vi.mock("@/lib/mercadopago", () => ({
  verifyWebhookRequest: mocks.verifyWebhookRequest,
  getPayment: mocks.getPayment,
  refundPayment: mocks.refundPayment,
}));

vi.mock("@/lib/pagos", () => ({ registrarPagoMp: mocks.registrarPagoMp }));
vi.mock("@/lib/event-listeners", () => ({ notificarReserva: mocks.notificarReserva }));

vi.mock("@sfs/db", () => ({
  db: {
    update: () => ({
      set: (valores: Record<string, unknown>) => {
        mocks.valoresDelUpdate(valores);
        return { where: async () => undefined };
      },
    }),
  },
  pagos: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({ eq: (columna: unknown, valor: unknown) => ({ eq: [columna, valor] }) }));

import { POST } from "./route";

const PAGO_MP = "1234567890";
const RESERVA = "33333333-3333-4333-8333-333333333333";

function aviso(cuerpo: Record<string, unknown> = {}, query = `?data.id=${PAGO_MP}`): NextRequest {
  return new NextRequest(`http://localhost/api/webhooks/mercadopago${query}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": "req-1",
      "x-signature": "ts=1,v1=abc",
    },
    body: JSON.stringify({ type: "payment", data: { id: PAGO_MP }, ...cuerpo }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.verifyWebhookRequest.mockReturnValue(true);
  mocks.getPayment.mockResolvedValue({ id: PAGO_MP, status: "approved" });
  mocks.registrarPagoMp.mockResolvedValue({
    tipo: "aplicado",
    reservaId: RESERVA,
    estado: "CONFIRMADA",
  });
  mocks.notificarReserva.mockResolvedValue(undefined);
  mocks.refundPayment.mockResolvedValue(undefined);
});

describe("POST /api/webhooks/mercadopago — seguridad", () => {
  it("rechaza con 401 una firma inválida y NO toca la reserva", async () => {
    mocks.verifyWebhookRequest.mockReturnValue(false);

    const response = await POST(aviso());

    expect(response.status).toBe(401);
    expect(mocks.getPayment).not.toHaveBeenCalled();
    expect(mocks.registrarPagoMp).not.toHaveBeenCalled();
  });

  it("rechaza con 400 un aviso sin data.id", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/webhooks/mercadopago", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "payment" }),
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.registrarPagoMp).not.toHaveBeenCalled();
  });

  it("verifica la firma con el data.id que vino en el aviso", async () => {
    await POST(aviso());

    expect(mocks.verifyWebhookRequest).toHaveBeenCalledWith({
      dataId: PAGO_MP,
      requestId: "req-1",
      signatureHeader: "ts=1,v1=abc",
    });
  });
});

describe("POST /api/webhooks/mercadopago — la plata entrando", () => {
  it("confirma la reserva y avisa cuando el pago cubre el total", async () => {
    const response = await POST(aviso());

    expect(response.status).toBe(200);
    expect(mocks.registrarPagoMp).toHaveBeenCalledWith({ id: PAGO_MP, status: "approved" });
    expect(mocks.notificarReserva).toHaveBeenCalledWith(RESERVA, "RESERVA_CONFIRMADA");
  });

  it("avisa de pago parcial cuando queda saldo, no de confirmada", async () => {
    mocks.registrarPagoMp.mockResolvedValue({
      tipo: "aplicado",
      reservaId: RESERVA,
      estado: "PAGO_PARCIAL",
    });

    await POST(aviso());

    expect(mocks.notificarReserva).toHaveBeenCalledWith(RESERVA, "PAGO_PARCIAL_RECIBIDO");
  });

  it("ignora los avisos que no son de pago sin tocar nada", async () => {
    const response = await POST(aviso({ type: "merchant_order" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, skipped: "merchant_order" });
    expect(mocks.registrarPagoMp).not.toHaveBeenCalled();
  });

  it("devuelve 500 si falla la consulta a MP, para que MP reintente", async () => {
    mocks.getPayment.mockRejectedValue(new Error("MP caído"));

    const response = await POST(aviso());

    expect(response.status).toBe(500);
  });

  it("no rompe el webhook si falla el envío de la notificación", async () => {
    mocks.notificarReserva.mockRejectedValue(new Error("Resend caído"));

    const response = await POST(aviso());

    // El pago YA se registró: devolver error haría que MP reintente y el
    // jugador quedaría esperando por un email, no por su reserva.
    expect(response.status).toBe(200);
  });
});

describe("POST /api/webhooks/mercadopago — reembolsos", () => {
  it("reembolsa y marca el pago como REEMBOLSADO", async () => {
    mocks.registrarPagoMp.mockResolvedValue({
      tipo: "reembolsar",
      mpPaymentId: PAGO_MP,
      pagoId: "pago-1",
    });

    const response = await POST(aviso());

    expect(mocks.refundPayment).toHaveBeenCalledWith(PAGO_MP);
    expect(mocks.valoresDelUpdate).toHaveBeenCalledWith({ estadoPago: "REEMBOLSADO" });
    expect(response.status).toBe(200);
  });

  it("no marca REEMBOLSADO si el reembolso falló: queda para revisión manual", async () => {
    mocks.registrarPagoMp.mockResolvedValue({
      tipo: "reembolsar",
      mpPaymentId: PAGO_MP,
      pagoId: "pago-1",
    });
    mocks.refundPayment.mockRejectedValue(new Error("MP rechazó el reembolso"));

    const response = await POST(aviso());

    expect(mocks.valoresDelUpdate).not.toHaveBeenCalled();
    // 200 a propósito: un reintento de MP vería el pago ya procesado y no
    // volvería a intentar el reembolso.
    expect(response.status).toBe(200);
  });

  it("no notifica al jugador cuando el pago se reembolsa", async () => {
    mocks.registrarPagoMp.mockResolvedValue({
      tipo: "reembolsar",
      mpPaymentId: PAGO_MP,
      pagoId: "pago-1",
    });

    await POST(aviso());

    expect(mocks.notificarReserva).not.toHaveBeenCalled();
  });
});
