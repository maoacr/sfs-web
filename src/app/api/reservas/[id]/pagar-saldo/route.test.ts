// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  reservaFindFirst: vi.fn(),
  iniciarPagoMp: vi.fn(),
}));

vi.mock("@/lib/auth-api", async () => {
  const real = await vi.importActual<typeof import("@/lib/auth-api")>("@/lib/auth-api");
  return { ...real, getAuthUser: h.getAuthUser };
});

vi.mock("@sfs/db", () => ({
  db: { query: { reservas: { findFirst: h.reservaFindFirst } } },
  reservas: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({ eq: (c: unknown, v: unknown) => ({ eq: [c, v] }) }));
vi.mock("@/lib/mercadopago", () => ({ isMercadoPagoConfigured: () => true }));
vi.mock("@/lib/pagos", () => ({ iniciarPagoMp: h.iniciarPagoMp }));

import { POST } from "./route";

const JUGADOR = "22222222-2222-4222-8222-222222222222";
const RESERVA = "33333333-3333-4333-8333-333333333333";

let ip = 0;
function peticion(cuerpo: Record<string, unknown>) {
  ip += 1;
  return new NextRequest(`http://localhost/api/reservas/${RESERVA}/pagar-saldo`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.7.0.${ip}`,
      "x-csrf-token": "token-csrf",
      cookie: "csrf_token=token-csrf",
    },
    body: JSON.stringify(cuerpo),
  });
}

function reserva(over: Record<string, unknown> = {}) {
  return {
    id: RESERVA,
    playerId: JUGADOR,
    estado: "PAGO_PARCIAL",
    saldoPendiente: "80000.00",
    partido: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.getAuthUser.mockResolvedValue({ sub: JUGADOR, email: "j@sfs.test", role: "PLAYER" });
  h.reservaFindFirst.mockResolvedValue(reserva());
  h.iniciarPagoMp.mockResolvedValue({ pagoId: "pago-1", checkoutUrl: "https://mp/checkout" });
});

describe("POST /api/reservas/:id/pagar-saldo", () => {
  it("sin monto cobra todo el saldo que la reserva tiene en ese momento", async () => {
    const res = await POST(peticion({}), { params: Promise.resolve({ id: RESERVA }) });

    expect(res.status).toBe(200);
    expect(h.iniciarPagoMp).toHaveBeenCalledWith(expect.objectContaining({ monto: 80000 }));
  });

  it("ignora un saldo viejo del cliente y usa el de la base", async () => {
    // El cliente cree que son 80.000, pero un compañero ya abonó parte.
    h.reservaFindFirst.mockResolvedValue(reserva({ saldoPendiente: "30000.00" }));

    await POST(peticion({}), { params: Promise.resolve({ id: RESERVA }) });

    expect(h.iniciarPagoMp).toHaveBeenCalledWith(expect.objectContaining({ monto: 30000 }));
  });

  it("acepta un abono parcial explícito", async () => {
    await POST(peticion({ monto: 20000 }), { params: Promise.resolve({ id: RESERVA }) });

    expect(h.iniciarPagoMp).toHaveBeenCalledWith(expect.objectContaining({ monto: 20000 }));
  });

  it("no deja cobrar más que el saldo", async () => {
    const res = await POST(peticion({ monto: 200000 }), { params: Promise.resolve({ id: RESERVA }) });

    expect(res.status).toBe(400);
    expect(h.iniciarPagoMp).not.toHaveBeenCalled();
  });

  it("no cobra nada si la reserva ya no debe", async () => {
    h.reservaFindFirst.mockResolvedValue(reserva({ saldoPendiente: "0.00" }));

    const res = await POST(peticion({}), { params: Promise.resolve({ id: RESERVA }) });

    expect(res.status).toBe(400);
    expect(h.iniciarPagoMp).not.toHaveBeenCalled();
  });

  it("sólo el titular o un jugador del partido pueden pagar", async () => {
    h.getAuthUser.mockResolvedValue({ sub: "otro-usuario", email: "x@sfs.test", role: "PLAYER" });

    const res = await POST(peticion({}), { params: Promise.resolve({ id: RESERVA }) });

    expect(res.status).toBe(403);
    expect(h.iniciarPagoMp).not.toHaveBeenCalled();
  });
});
