// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ where: vi.fn() }));

vi.mock("drizzle-orm", () => ({
  and: (...partes: unknown[]) => ({ and: partes }),
  eq: (columna: unknown, valor: unknown) => ({ eq: [columna, valor] }),
  sum: (columna: unknown) => ({ sum: columna }),
}));

vi.mock("@sfs/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (condicion: unknown) => mocks.where(condicion),
      }),
    }),
  },
  reservas: { playerId: "player_id", estado: "estado", saldoPendiente: "saldo_pendiente" },
}));

import { saldoPendienteDe } from "@/lib/saldo";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.where.mockResolvedValue([{ saldo: "0" }]);
});

describe("saldoPendienteDe", () => {
  it("suma el saldo del jugador que se le pasa, no el de quien consulta", async () => {
    await saldoPendienteDe("jugador-endeudado");

    const condicion = mocks.where.mock.calls[0]?.[0] as { and: { eq: unknown[] }[] };
    expect(condicion.and).toContainEqual({ eq: ["player_id", "jugador-endeudado"] });
  });

  it("sólo cuenta las reservas en PAGO_PARCIAL", async () => {
    await saldoPendienteDe("jugador-1");

    const condicion = mocks.where.mock.calls[0]?.[0] as { and: { eq: unknown[] }[] };
    expect(condicion.and).toContainEqual({ eq: ["estado", "PAGO_PARCIAL"] });
  });

  it("devuelve el total como número", async () => {
    mocks.where.mockResolvedValue([{ saldo: "80000.00" }]);
    expect(await saldoPendienteDe("jugador-1")).toBe(80000);
  });

  it("devuelve 0 cuando el jugador no debe nada", async () => {
    mocks.where.mockResolvedValue([{ saldo: null }]);
    expect(await saldoPendienteDe("jugador-1")).toBe(0);
  });

  it("devuelve 0 cuando la consulta no trae filas", async () => {
    mocks.where.mockResolvedValue([]);
    expect(await saldoPendienteDe("jugador-1")).toBe(0);
  });
});
