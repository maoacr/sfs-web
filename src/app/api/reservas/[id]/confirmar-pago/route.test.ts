// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  reservaFindFirst: vi.fn(),
  insertEnPagos: vi.fn(),
  updateDeReservas: vi.fn(),
  notificarReserva: vi.fn(),
}));

vi.mock("@/lib/auth-api", async () => {
  const real = await vi.importActual<typeof import("@/lib/auth-api")>("@/lib/auth-api");
  return { ...real, getAuthUser: h.getAuthUser };
});

const tx = {
  insert: () => ({ values: async (v: Record<string, unknown>) => h.insertEnPagos(v) }),
  update: () => ({
    set: (v: Record<string, unknown>) => {
      h.updateDeReservas(v);
      return { where: async () => undefined };
    },
  }),
};

vi.mock("@sfs/db", () => ({
  db: {
    query: { reservas: { findFirst: h.reservaFindFirst } },
    transaction: async (cb: (t: typeof tx) => unknown) => cb(tx),
  },
  reservas: { id: "id", tenantId: "tenant_id" },
  pagos: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  and: (...p: unknown[]) => ({ and: p }),
  eq: (c: unknown, v: unknown) => ({ eq: [c, v] }),
}));

vi.mock("@/lib/event-listeners", () => ({ notificarReserva: h.notificarReserva }));

import { POST } from "./route";

const DUENO = "11111111-1111-4111-8111-111111111111";
const JUGADOR = "22222222-2222-4222-8222-222222222222";
const RESERVA = "33333333-3333-4333-8333-333333333333";

let ip = 0;
function peticion(cuerpo: Record<string, unknown>) {
  ip += 1;
  return new NextRequest(`http://localhost/api/reservas/${RESERVA}/confirmar-pago`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.5.0.${ip}`,
      "x-csrf-token": "token-csrf",
      cookie: "csrf_token=token-csrf",
    },
    body: JSON.stringify(cuerpo),
  });
}

const params = { params: Promise.resolve({ id: RESERVA }) };

function reserva(over: Record<string, unknown> = {}) {
  return {
    id: RESERVA,
    tenantId: DUENO,
    playerId: JUGADOR,
    estado: "PAGO_PARCIAL",
    montoTotal: "160000.00",
    montoPagado: "80000.00",
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.getAuthUser.mockResolvedValue({ sub: DUENO, email: "d@sfs.test", role: "OWNER" });
  h.reservaFindFirst.mockResolvedValue(reserva());
  h.notificarReserva.mockResolvedValue(undefined);
});

describe("POST /api/reservas/:id/confirmar-pago", () => {
  it("registra el cobro en efectivo con canal PRESENCIAL", async () => {
    const res = await POST(peticion({ metodo: "EFECTIVO" }), params);

    expect(res.status).toBe(200);
    const pago = h.insertEnPagos.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(pago.canal).toBe("PRESENCIAL");
    expect(pago.metodo).toBe("EFECTIVO");
    expect(pago.monto).toBe("80000.00");
  });

  it("guarda la entidad cuando el cobro fue por transferencia", async () => {
    await POST(peticion({ metodo: "TRANSFERENCIA", entidad: "NEQUI" }), params);

    const pago = h.insertEnPagos.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(pago.entidad).toBe("NEQUI");
  });

  it("deja registrar un abono parcial y la reserva queda con saldo", async () => {
    await POST(peticion({ metodo: "EFECTIVO", monto: 30000 }), params);

    const reservaActualizada = h.updateDeReservas.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(reservaActualizada.montoPagado).toBe("110000.00");
    expect(reservaActualizada.saldoPendiente).toBe("50000.00");
    expect(reservaActualizada.estado).toBe("PAGO_PARCIAL");
  });

  it("deja cobrar una reserva de un partido que YA SE JUGÓ", async () => {
    // El dueño marcó el partido como completado y quedó saldo. Antes esto
    // devolvía 400 y la deuda no se podía registrar por ningún camino: el
    // jugador quedaba bloqueado para siempre sin forma de saldar.
    h.reservaFindFirst.mockResolvedValue(reserva({ estado: "COMPLETADA" }));

    const res = await POST(peticion({ metodo: "EFECTIVO" }), params);

    expect(res.status).toBe(200);
    expect(h.insertEnPagos).toHaveBeenCalled();
  });

  it("un partido jugado sigue jugado después de cobrarlo", async () => {
    h.reservaFindFirst.mockResolvedValue(reserva({ estado: "COMPLETADA" }));

    await POST(peticion({ metodo: "EFECTIVO" }), params);

    const reservaActualizada = h.updateDeReservas.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(reservaActualizada.estado).toBe("COMPLETADA");
    expect(reservaActualizada.saldoPendiente).toBe("0.00");
  });

  it("una reserva sin saldo no se puede volver a cobrar", async () => {
    h.reservaFindFirst.mockResolvedValue(reserva({ montoPagado: "160000.00", estado: "CONFIRMADA" }));

    const res = await POST(peticion({ metodo: "EFECTIVO" }), params);

    expect(res.status).toBe(400);
    expect(h.insertEnPagos).not.toHaveBeenCalled();
  });

  it("no se cobra una reserva cancelada", async () => {
    h.reservaFindFirst.mockResolvedValue(reserva({ estado: "CANCELADA" }));

    const res = await POST(peticion({ metodo: "EFECTIVO" }), params);

    expect(res.status).toBe(400);
    expect(h.insertEnPagos).not.toHaveBeenCalled();
  });

  it("no se cobra una reserva expirada", async () => {
    h.reservaFindFirst.mockResolvedValue(reserva({ estado: "EXPIRADA" }));

    const res = await POST(peticion({ metodo: "EFECTIVO" }), params);

    expect(res.status).toBe(400);
  });

  it("no deja cobrar más que el saldo", async () => {
    const res = await POST(peticion({ metodo: "EFECTIVO", monto: 999999 }), params);

    expect(res.status).toBe(400);
    expect(h.insertEnPagos).not.toHaveBeenCalled();
  });

  it("sólo el dueño de la reserva puede registrar el cobro", async () => {
    h.reservaFindFirst.mockResolvedValue(undefined);

    const res = await POST(peticion({ metodo: "EFECTIVO" }), params);

    expect(res.status).toBe(404);
  });
});
