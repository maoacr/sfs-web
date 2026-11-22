// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  saldoPendienteDe: vi.fn(),
  getAuthUser: vi.fn(),
  canchaFindFirst: vi.fn(),
  reservaFindFirst: vi.fn(),
  reservaFindMany: vi.fn(),
  insertEnPagos: vi.fn(),
  insertEnReservas: vi.fn(),
  liberarTurnoVencido: vi.fn(async () => []),
  notificarReserva: vi.fn(async () => undefined),
}));

vi.mock("drizzle-orm", () => ({
  and: (...p: unknown[]) => ({ and: p }),
  eq: (c: unknown, v: unknown) => ({ eq: [c, v] }),
  gt: (c: unknown, v: unknown) => ({ gt: [c, v] }),
  lt: (c: unknown, v: unknown) => ({ lt: [c, v] }),
  isNull: (c: unknown) => ({ isNull: c }),
  inArray: (c: unknown, v: unknown) => ({ inArray: [c, v] }),
  notInArray: (c: unknown, v: unknown) => ({ notInArray: [c, v] }),
  asc: (c: unknown) => ({ asc: c }),
  desc: (c: unknown) => ({ desc: c }),
}));

vi.mock("@/lib/saldo", () => ({ saldoPendienteDe: mocks.saldoPendienteDe }));

vi.mock("@/lib/auth-api", async () => {
  const real = await vi.importActual<typeof import("@/lib/auth-api")>("@/lib/auth-api");
  return { ...real, getAuthUser: mocks.getAuthUser };
});

const tx = {
  insert: (tabla: { _nombre: string }) => ({
    values: (valores: Record<string, unknown>) => {
      const registrar = tabla._nombre === "pagos" ? mocks.insertEnPagos : mocks.insertEnReservas;
      registrar(valores);
      return { returning: async () => [{ id: "reserva-nueva", ...valores }] };
    },
  }),
};

vi.mock("@sfs/db", () => ({
  db: {
    query: {
      canchas: { findFirst: mocks.canchaFindFirst },
      reservas: { findFirst: mocks.reservaFindFirst, findMany: mocks.reservaFindMany },
      tarifas: { findFirst: vi.fn(async () => undefined) },
    },
    transaction: async (cb: (t: typeof tx) => unknown) => cb(tx),
  },
  pagos: { _nombre: "pagos" },
  reservas: { _nombre: "reservas", playerId: "player_id", estado: "estado", saldoPendiente: "saldo_pendiente", id: "id", canchaId: "cancha_id", slotInicio: "slot_inicio", slotFin: "slot_fin", tenantId: "tenant_id", createdAt: "created_at" },
  pagosTabla: { createdAt: "created_at" },
  canchas: { id: "id", deletedAt: "deleted_at" },
  slotConfigs: { diaSemana: "dia_semana" },
  estadoReservaEnum: { enumValues: ["PENDIENTE_PAGO", "PAGO_PARCIAL", "CONFIRMADA"] },
}));

vi.mock("@/lib/ttl", () => ({
  liberarReservasExpiradas: vi.fn(async () => undefined),
  liberarTurnoVencido: mocks.liberarTurnoVencido,
}));
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
vi.mock("@/lib/event-listeners", () => ({ notificarReserva: mocks.notificarReserva }));

import { GET, POST } from "./route";
import { CONSTRAINT_SIN_DOBLE_BOOKING } from "@/lib/errores-db";

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
  mocks.saldoPendienteDe.mockResolvedValue(0);
  mocks.liberarTurnoVencido.mockResolvedValue([]);
  mocks.getAuthUser.mockResolvedValue({ sub: JUGADOR, email: "j@sfs.test", role: "PLAYER" });
  // La cancha no existe: alcanza para probar que la request pasó la puerta del saldo.
  mocks.canchaFindFirst.mockResolvedValue(undefined);
});

describe("POST /api/reservas — bloqueo por saldo pendiente", () => {
  it("bloquea al jugador que debe plata", async () => {
    mocks.saldoPendienteDe.mockResolvedValue(80000);

    const res = await POST(peticion({}));

    expect(res.status).toBe(403);
    expect((await res.json()).saldoPendiente).toBe(80000);
  });

  it("deja pasar al jugador que no debe nada", async () => {
    const res = await POST(peticion({}));

    expect(res.status).not.toBe(403);
    expect(mocks.saldoPendienteDe).toHaveBeenCalledWith(JUGADOR);
  });

  it("mira el saldo DEL JUGADOR cuando el dueño reserva a su nombre", async () => {
    mocks.getAuthUser.mockResolvedValue({ sub: DUENO, email: "d@sfs.test", role: "OWNER" });

    await POST(peticion({ playerId: JUGADOR }));

    expect(mocks.saldoPendienteDe).toHaveBeenCalledWith(JUGADOR);
    expect(mocks.saldoPendienteDe).not.toHaveBeenCalledWith(DUENO);
  });

  it("el dueño tampoco puede agendarle a alguien con saldo", async () => {
    mocks.getAuthUser.mockResolvedValue({ sub: DUENO, email: "d@sfs.test", role: "OWNER" });
    mocks.saldoPendienteDe.mockResolvedValue(50000);

    const res = await POST(peticion({ playerId: JUGADOR }));

    expect(res.status).toBe(403);
  });

  it("al dueño le habla del jugador, no de él", async () => {
    mocks.getAuthUser.mockResolvedValue({ sub: DUENO, email: "d@sfs.test", role: "OWNER" });
    mocks.saldoPendienteDe.mockResolvedValue(50000);

    const res = await POST(peticion({ playerId: JUGADOR }));

    expect((await res.json()).error).toMatch(/jugador/i);
  });

  it("el dueño que reserva para sí mismo se mide con su propio saldo", async () => {
    mocks.getAuthUser.mockResolvedValue({ sub: DUENO, email: "d@sfs.test", role: "OWNER" });

    await POST(peticion({}));

    expect(mocks.saldoPendienteDe).toHaveBeenCalledWith(DUENO);
  });
});

describe("POST /api/reservas — el dueño agenda y cobra en el mostrador", () => {
  beforeEach(() => {
    mocks.getAuthUser.mockResolvedValue({ sub: DUENO, email: "d@sfs.test", role: "OWNER" });
    mocks.canchaFindFirst.mockResolvedValue({
      id: CANCHA, tenantId: DUENO, duracionSlotMinutos: 60,
      complejo: { zonaHoraria: "America/Bogota" }, slots: [{ diaSemana: 1 }],
    });
    mocks.reservaFindFirst.mockResolvedValue(undefined);
  });

  it("deja fila en pagos: la plata que cobra el dueño no puede ser invisible", async () => {
    await POST(peticion({ playerId: JUGADOR }));

    expect(mocks.insertEnPagos).toHaveBeenCalledTimes(1);
    const pago = mocks.insertEnPagos.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(pago.canal).toBe("PRESENCIAL");
    expect(pago.metodo).toBe("EFECTIVO");
    expect(pago.monto).toBe("160000.00");
    expect(pago.userId).toBe(JUGADOR);
  });

  it("guarda el método y la entidad que informó el dueño", async () => {
    await POST(peticion({ playerId: JUGADOR, metodo: "TRANSFERENCIA", entidad: "NEQUI" }));

    const pago = mocks.insertEnPagos.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(pago.metodo).toBe("TRANSFERENCIA");
    expect(pago.entidad).toBe("NEQUI");
  });

  it("un cobro parcial deja la reserva con saldo", async () => {
    await POST(peticion({ playerId: JUGADOR, montoPagado: 80000 }));

    const reserva = mocks.insertEnReservas.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(reserva.montoPagado).toBe("80000.00");
    expect(reserva.saldoPendiente).toBe("80000.00");
    expect(reserva.estado).toBe("PAGO_PARCIAL");

    const pago = mocks.insertEnPagos.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(pago.monto).toBe("80000.00");
  });

  it("sin monto se asume que cobró todo y la reserva queda confirmada", async () => {
    await POST(peticion({ playerId: JUGADOR }));

    const reserva = mocks.insertEnReservas.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(reserva.saldoPendiente).toBe("0.00");
    expect(reserva.estado).toBe("CONFIRMADA");
  });

  it("el jugador que reserva por la app no genera fila de pago todavía", async () => {
    mocks.getAuthUser.mockResolvedValue({ sub: JUGADOR, email: "j@sfs.test", role: "PLAYER" });

    await POST(peticion({}));

    expect(mocks.insertEnPagos).not.toHaveBeenCalled();
    const reserva = mocks.insertEnReservas.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(reserva.estado).toBe("PENDIENTE_PAGO");
  });
});

describe("GET /api/reservas?conSaldo=true — cuentas por cobrar", () => {
  function condiciones() {
    const args = mocks.reservaFindMany.mock.calls[0]?.[0] as { where: { and: unknown[] } };
    return args.where.and;
  }

  beforeEach(() => {
    mocks.reservaFindMany.mockResolvedValue([]);
    mocks.getAuthUser.mockResolvedValue({ sub: DUENO, email: "d@sfs.test", role: "OWNER" });
  });

  function consulta(query: string) {
    return new NextRequest(`http://localhost/api/reservas${query}`, {
      method: "GET",
      headers: { "x-forwarded-for": `10.8.0.${(ip += 1)}` },
    });
  }

  it("pide sólo las que deben plata", async () => {
    await GET(consulta("?conSaldo=true"));
    expect(condiciones()).toContainEqual({ gt: ["saldo_pendiente", "0"] });
  });

  it("deja afuera lo que está muerto: canceladas y expiradas", async () => {
    await GET(consulta("?conSaldo=true"));
    expect(condiciones()).toContainEqual({ notInArray: ["estado", ["CANCELADA", "EXPIRADA"]] });
  });

  it("no filtra por estado: una COMPLETADA también puede deber", async () => {
    await GET(consulta("?conSaldo=true"));
    const porEstado = condiciones().filter(
      (c): c is { eq: unknown[] } =>
        typeof c === "object" && c !== null && "eq" in c && (c as { eq: unknown[] }).eq[0] === "estado"
    );
    expect(porEstado).toHaveLength(0);
  });

  it("sin el filtro no se mete con el saldo", async () => {
    await GET(consulta(""));
    expect(condiciones()).not.toContainEqual({ gt: ["saldo_pendiente", "0"] });
  });
});

describe("POST /api/reservas — la base como última palabra sobre el turno", () => {
  // El turno que pide `peticion()`: 20:00 del 2026-12-01 en Bogotá (UTC-5),
  // una hora de duración.
  const INICIO = new Date("2026-12-02T01:00:00.000Z");
  const FIN = new Date("2026-12-02T02:00:00.000Z");

  beforeEach(() => {
    mocks.getAuthUser.mockResolvedValue({ sub: JUGADOR, email: "j@sfs.test", role: "PLAYER" });
    mocks.canchaFindFirst.mockResolvedValue({
      id: CANCHA, tenantId: DUENO, duracionSlotMinutos: 60,
      complejo: { zonaHoraria: "America/Bogota" }, slots: [{ diaSemana: 1 }],
    });
    mocks.reservaFindFirst.mockResolvedValue(undefined);
  });

  it("asienta lo vencido de ESE turno antes de insertar", async () => {
    await POST(peticion({}));

    expect(mocks.liberarTurnoVencido).toHaveBeenCalledWith({
      canchaId: CANCHA,
      inicio: INICIO,
      fin: FIN,
    });
  });

  it("lo espera: si insertara primero, la fila vencida haría fallar el constraint", async () => {
    await POST(peticion({}));

    const liberacion = mocks.liberarTurnoVencido.mock.invocationCallOrder[0];
    const insercion = mocks.insertEnReservas.mock.invocationCallOrder[0];
    expect(liberacion).toBeLessThan(insercion);
  });

  it("traduce el rechazo de la base en un 409, no en un 500", async () => {
    mocks.insertEnReservas.mockImplementationOnce(() => {
      throw Object.assign(new Error("conflicting key value violates exclusion constraint"), {
        code: "23P01",
        constraint_name: CONSTRAINT_SIN_DOBLE_BOOKING,
      });
    });

    const res = await POST(peticion({}));

    expect(res.status).toBe(409);
  });

  it("le dice lo mismo que el chequeo de la app: para el usuario es el mismo hecho", async () => {
    mocks.insertEnReservas.mockImplementationOnce(() => {
      throw Object.assign(new Error("boom"), {
        code: "23P01",
        constraint_name: CONSTRAINT_SIN_DOBLE_BOOKING,
      });
    });

    const res = await POST(peticion({}));

    expect((await res.json()).error).toBe("El slot ya está reservado");
  });

  it("no se come cualquier error: lo que no es un choque de turno sigue siendo 500", async () => {
    mocks.insertEnReservas.mockImplementationOnce(() => {
      throw new Error("se cayó la base");
    });

    const res = await POST(peticion({}));

    expect(res.status).toBe(500);
  });
});

describe("POST /api/reservas — el dueño agenda sin cobrar", () => {
  beforeEach(() => {
    mocks.getAuthUser.mockResolvedValue({ sub: DUENO, email: "d@sfs.test", role: "OWNER" });
    mocks.canchaFindFirst.mockResolvedValue({
      id: CANCHA, tenantId: DUENO, duracionSlotMinutos: 60,
      complejo: { zonaHoraria: "America/Bogota" }, slots: [{ diaSemana: 1 }],
    });
    mocks.reservaFindFirst.mockResolvedValue(undefined);
  });

  it("queda CONFIRMADA debiendo todo: el dueño garantiza el turno", async () => {
    // Un PAGO_PARCIAL con cero pagado sería un turno ocupado para siempre
    // —PAGO_PARCIAL no expira— afirmando un pago que no existió.
    await POST(peticion({ playerId: JUGADOR, montoPagado: 0 }));

    const reserva = mocks.insertEnReservas.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(reserva.estado).toBe("CONFIRMADA");
    expect(reserva.montoPagado).toBe("0.00");
    expect(reserva.saldoPendiente).toBe("160000.00");
  });

  it("no deja fila en pagos: no entró plata", async () => {
    await POST(peticion({ playerId: JUGADOR, montoPagado: 0 }));

    expect(mocks.insertEnPagos).not.toHaveBeenCalled();
  });

  it("no avisa de un abono que nadie recibió", async () => {
    await POST(peticion({ playerId: JUGADOR, montoPagado: 0 }));

    expect(mocks.notificarReserva).toHaveBeenCalledWith("reserva-nueva", "RESERVA_CONFIRMADA");
  });

  it("un abono de verdad sí queda PAGO_PARCIAL", async () => {
    await POST(peticion({ playerId: JUGADOR, montoPagado: 80000 }));

    const reserva = mocks.insertEnReservas.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(reserva.estado).toBe("PAGO_PARCIAL");
    expect(mocks.notificarReserva).toHaveBeenCalledWith("reserva-nueva", "PAGO_PARCIAL_RECIBIDO");
  });
});
