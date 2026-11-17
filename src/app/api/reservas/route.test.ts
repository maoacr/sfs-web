// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  saldoPendienteDe: vi.fn(),
  getAuthUser: vi.fn(),
  canchaFindFirst: vi.fn(),
  reservaFindFirst: vi.fn(),
  insertEnPagos: vi.fn(),
  insertEnReservas: vi.fn(),
}));

vi.mock("@/lib/saldo", () => ({ saldoPendienteDe: h.saldoPendienteDe }));

vi.mock("@/lib/auth-api", async () => {
  const real = await vi.importActual<typeof import("@/lib/auth-api")>("@/lib/auth-api");
  return { ...real, getAuthUser: h.getAuthUser };
});

const tx = {
  insert: (tabla: { _nombre: string }) => ({
    values: (valores: Record<string, unknown>) => {
      const registrar = tabla._nombre === "pagos" ? h.insertEnPagos : h.insertEnReservas;
      registrar(valores);
      return { returning: async () => [{ id: "reserva-nueva", ...valores }] };
    },
  }),
};

vi.mock("@sfs/db", () => ({
  db: {
    query: {
      canchas: { findFirst: h.canchaFindFirst },
      reservas: { findFirst: h.reservaFindFirst },
      tarifas: { findFirst: vi.fn(async () => undefined) },
    },
    transaction: async (cb: (t: typeof tx) => unknown) => cb(tx),
  },
  pagos: { _nombre: "pagos" },
  reservas: { _nombre: "reservas", playerId: "player_id", estado: "estado", saldoPendiente: "saldo_pendiente", id: "id", canchaId: "cancha_id", slotInicio: "slot_inicio", slotFin: "slot_fin", tenantId: "tenant_id" },
  canchas: { id: "id", deletedAt: "deleted_at" },
  slotConfigs: { diaSemana: "dia_semana" },
  estadoReservaEnum: { enumValues: ["PENDIENTE_PAGO", "PAGO_PARCIAL", "CONFIRMADA"] },
}));

vi.mock("@/lib/ttl", () => ({ liberarReservasExpiradas: vi.fn(async () => undefined) }));
vi.mock("@/lib/disponibilidad", () => ({
  diaSemanaDeFecha: () => 1,
  turnoDentroDeHorario: () => true,
}));
vi.mock("@/lib/consultas", () => ({
  reservasDelDiaLocal: () => [],
  reservaOcupaElTurno: () => ({}),
}));
vi.mock("@/lib/pricing", () => ({
  calcularPrecio: async () => ({ success: true, data: { precioFinal: 160000, promocionAplicada: null } }),
  usarPromocion: vi.fn(),
}));
vi.mock("@/lib/event-listeners", () => ({ notificarReserva: vi.fn(async () => undefined) }));

import { POST } from "./route";

const DUENO = "11111111-1111-4111-8111-111111111111";
const JUGADOR = "22222222-2222-4222-8222-222222222222";
const CANCHA = "33333333-3333-4333-8333-333333333333";

let ip = 0;
function peticion(cuerpo: Record<string, unknown>) {
  ip += 1;
  return new NextRequest("http://localhost/api/reservas", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.9.0.${ip}`,
      "x-csrf-token": "token-csrf",
      cookie: "csrf_token=token-csrf",
    },
    body: JSON.stringify({ canchaId: CANCHA, fecha: "2026-12-01", hora: "20:00", ...cuerpo }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.saldoPendienteDe.mockResolvedValue(0);
  h.getAuthUser.mockResolvedValue({ sub: JUGADOR, email: "j@sfs.test", role: "PLAYER" });
  // La cancha no existe: alcanza para probar que la request pasó la puerta del saldo.
  h.canchaFindFirst.mockResolvedValue(undefined);
});

describe("POST /api/reservas — bloqueo por saldo pendiente", () => {
  it("bloquea al jugador que debe plata", async () => {
    h.saldoPendienteDe.mockResolvedValue(80000);

    const res = await POST(peticion({}));

    expect(res.status).toBe(403);
    expect((await res.json()).saldoPendiente).toBe(80000);
  });

  it("deja pasar al jugador que no debe nada", async () => {
    const res = await POST(peticion({}));

    expect(res.status).not.toBe(403);
    expect(h.saldoPendienteDe).toHaveBeenCalledWith(JUGADOR);
  });

  it("mira el saldo DEL JUGADOR cuando el dueño reserva a su nombre", async () => {
    h.getAuthUser.mockResolvedValue({ sub: DUENO, email: "d@sfs.test", role: "OWNER" });

    await POST(peticion({ playerId: JUGADOR }));

    expect(h.saldoPendienteDe).toHaveBeenCalledWith(JUGADOR);
    expect(h.saldoPendienteDe).not.toHaveBeenCalledWith(DUENO);
  });

  it("el dueño tampoco puede agendarle a alguien con saldo", async () => {
    h.getAuthUser.mockResolvedValue({ sub: DUENO, email: "d@sfs.test", role: "OWNER" });
    h.saldoPendienteDe.mockResolvedValue(50000);

    const res = await POST(peticion({ playerId: JUGADOR }));

    expect(res.status).toBe(403);
  });

  it("al dueño le habla del jugador, no de él", async () => {
    h.getAuthUser.mockResolvedValue({ sub: DUENO, email: "d@sfs.test", role: "OWNER" });
    h.saldoPendienteDe.mockResolvedValue(50000);

    const res = await POST(peticion({ playerId: JUGADOR }));

    expect((await res.json()).error).toMatch(/jugador/i);
  });

  it("el dueño que reserva para sí mismo se mide con su propio saldo", async () => {
    h.getAuthUser.mockResolvedValue({ sub: DUENO, email: "d@sfs.test", role: "OWNER" });

    await POST(peticion({}));

    expect(h.saldoPendienteDe).toHaveBeenCalledWith(DUENO);
  });
});

describe("POST /api/reservas — el dueño agenda y cobra en el mostrador", () => {
  beforeEach(() => {
    h.getAuthUser.mockResolvedValue({ sub: DUENO, email: "d@sfs.test", role: "OWNER" });
    h.canchaFindFirst.mockResolvedValue({
      id: CANCHA, tenantId: DUENO, duracionSlotMinutos: 60,
      complejo: { zonaHoraria: "America/Bogota" }, slots: [{ diaSemana: 1 }],
    });
    h.reservaFindFirst.mockResolvedValue(undefined);
  });

  it("deja fila en pagos: la plata que cobra el dueño no puede ser invisible", async () => {
    await POST(peticion({ playerId: JUGADOR }));

    expect(h.insertEnPagos).toHaveBeenCalledTimes(1);
    const pago = h.insertEnPagos.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(pago.canal).toBe("PRESENCIAL");
    expect(pago.metodo).toBe("EFECTIVO");
    expect(pago.monto).toBe("160000.00");
    expect(pago.userId).toBe(JUGADOR);
  });

  it("guarda el método y la entidad que informó el dueño", async () => {
    await POST(peticion({ playerId: JUGADOR, metodo: "TRANSFERENCIA", entidad: "NEQUI" }));

    const pago = h.insertEnPagos.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(pago.metodo).toBe("TRANSFERENCIA");
    expect(pago.entidad).toBe("NEQUI");
  });

  it("un cobro parcial deja la reserva con saldo", async () => {
    await POST(peticion({ playerId: JUGADOR, montoPagado: 80000 }));

    const reserva = h.insertEnReservas.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(reserva.montoPagado).toBe("80000.00");
    expect(reserva.saldoPendiente).toBe("80000.00");
    expect(reserva.estado).toBe("PAGO_PARCIAL");

    const pago = h.insertEnPagos.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(pago.monto).toBe("80000.00");
  });

  it("sin monto se asume que cobró todo y la reserva queda confirmada", async () => {
    await POST(peticion({ playerId: JUGADOR }));

    const reserva = h.insertEnReservas.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(reserva.saldoPendiente).toBe("0.00");
    expect(reserva.estado).toBe("CONFIRMADA");
  });

  it("el jugador que reserva por la app no genera fila de pago todavía", async () => {
    h.getAuthUser.mockResolvedValue({ sub: JUGADOR, email: "j@sfs.test", role: "PLAYER" });

    await POST(peticion({}));

    expect(h.insertEnPagos).not.toHaveBeenCalled();
    const reserva = h.insertEnReservas.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(reserva.estado).toBe("PENDIENTE_PAGO");
  });
});
