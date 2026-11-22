// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  canchaDelDueno: vi.fn(),
  reservaFindFirst: vi.fn(),
  insertEnReservas: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  and: (...partes: unknown[]) => ({ and: partes }),
  eq: (columna: unknown, valor: unknown) => ({ eq: [columna, valor] }),
  gt: (columna: unknown, valor: unknown) => ({ gt: [columna, valor] }),
  lt: (columna: unknown, valor: unknown) => ({ lt: [columna, valor] }),
  inArray: (columna: unknown, valor: unknown) => ({ inArray: [columna, valor] }),
}));

vi.mock("@sfs/db", () => ({
  db: {
    query: { reservas: { findFirst: mocks.reservaFindFirst } },
    insert: () => ({
      values: (valores: Record<string, unknown>) => {
        mocks.insertEnReservas(valores);
        return { returning: async () => [{ id: "reserva-del-servidor" }] };
      },
    }),
  },
  reservas: {
    _nombre: "reservas",
    estado: "estado",
    canchaId: "cancha_id",
    slotInicio: "slot_inicio",
    slotFin: "slot_fin",
    id: "id",
  },
}));

vi.mock("@/lib/auth-api", async () => {
  const real = await vi.importActual<typeof import("@/lib/auth-api")>("@/lib/auth-api");
  return { ...real, getAuthUser: mocks.getAuthUser };
});

vi.mock("@/lib/consultas", () => ({ canchaDelDueno: mocks.canchaDelDueno }));

import { POST } from "./route";
import { CONSTRAINT_SIN_DOBLE_BOOKING } from "@/lib/errores-db";

const DUENO = "11111111-1111-4111-8111-111111111111";
const CANCHA = "33333333-3333-4333-8333-333333333333";

let ip = 0;
function peticion(data: Record<string, unknown> = {}) {
  ip += 1;
  return new NextRequest("http://localhost/api/sync", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.7.0.${ip}`,
      "x-csrf-token": "token-csrf",
      cookie: "csrf_token=token-csrf",
    },
    body: JSON.stringify({
      type: "CREATE",
      entity: "reserva",
      data: {
        id: "local-1",
        canchaId: CANCHA,
        slotInicio: "2026-12-02T01:00:00.000Z",
        slotFin: "2026-12-02T02:00:00.000Z",
        montoTotal: 160000,
        ...data,
      },
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthUser.mockResolvedValue({ sub: DUENO, email: "d@sfs.test", role: "OWNER" });
  mocks.canchaDelDueno.mockResolvedValue({ id: CANCHA, tenantId: DUENO });
  mocks.reservaFindFirst.mockResolvedValue(undefined);
});

describe("POST /api/sync — la reserva que se tomó offline", () => {
  it("la crea y devuelve el id del servidor junto al local", async () => {
    const res = await POST(peticion());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ serverId: "reserva-del-servidor", localId: "local-1" });
  });

  it("rechaza la cancha que no es del dueño", async () => {
    mocks.canchaDelDueno.mockResolvedValue(undefined);

    const res = await POST(peticion());

    expect(res.status).toBe(404);
    expect(mocks.insertEnReservas).not.toHaveBeenCalled();
  });

  it("avisa del conflicto que detecta el chequeo, con el detalle de la reserva que ganó", async () => {
    mocks.reservaFindFirst.mockResolvedValue({
      id: "la-que-gano",
      playerId: DUENO,
      slotInicio: new Date("2026-12-02T01:00:00.000Z"),
      slotFin: new Date("2026-12-02T02:00:00.000Z"),
    });

    const res = await POST(peticion());

    expect(res.status).toBe(409);
    expect((await res.json()).conflicto.reservaId).toBe("la-que-gano");
  });
});

describe("POST /api/sync — el constraint como última palabra", () => {
  it("traduce el rechazo de la base en un 409, no en un 500", async () => {
    // Sin esto el cliente ve un 500, reintenta tres veces y recién después
    // descarta la operación. Un 409 lo resuelve en el primer intento.
    mocks.insertEnReservas.mockImplementationOnce(() => {
      throw Object.assign(new Error("conflicting key value violates exclusion constraint"), {
        code: "23P01",
        constraint_name: CONSTRAINT_SIN_DOBLE_BOOKING,
      });
    });

    const res = await POST(peticion());

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/offline/i);
  });

  it("no se come cualquier error: lo que no es un choque de turno sigue siendo 500", async () => {
    mocks.insertEnReservas.mockImplementationOnce(() => {
      throw new Error("se cayó la base");
    });

    const res = await POST(peticion());

    expect(res.status).toBe(500);
  });
});
