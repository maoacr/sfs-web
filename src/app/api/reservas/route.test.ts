// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  saldoPendienteDe: vi.fn(),
  getAuthUser: vi.fn(),
  canchaFindFirst: vi.fn(),
}));

vi.mock("@/lib/saldo", () => ({ saldoPendienteDe: h.saldoPendienteDe }));

vi.mock("@/lib/auth-api", async () => {
  const real = await vi.importActual<typeof import("@/lib/auth-api")>("@/lib/auth-api");
  return { ...real, getAuthUser: h.getAuthUser };
});

vi.mock("@sfs/db", () => ({
  db: { query: { canchas: { findFirst: h.canchaFindFirst } } },
  reservas: { playerId: "player_id", estado: "estado", saldoPendiente: "saldo_pendiente", id: "id" },
  canchas: { id: "id", deletedAt: "deleted_at" },
  slotConfigs: { diaSemana: "dia_semana" },
  estadoReservaEnum: { enumValues: ["PENDIENTE_PAGO", "PAGO_PARCIAL", "CONFIRMADA"] },
}));

vi.mock("@/lib/ttl", () => ({ liberarReservasExpiradas: vi.fn(async () => undefined) }));

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
