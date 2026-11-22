// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ where: vi.fn() }));

vi.mock("drizzle-orm", () => ({
  and: (...partes: unknown[]) => ({ and: partes }),
  eq: (columna: unknown, valor: unknown) => ({ eq: [columna, valor] }),
  inArray: (columna: unknown, valores: unknown) => ({ inArray: [columna, valores] }),
  sum: (columna: unknown) => ({ sum: columna }),
}));

vi.mock("@sfs/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (condicion: unknown) => {
          const resultado = mocks.where(condicion);
          // La consulta agrupada encadena `.groupBy()`; la de un solo jugador
          // termina en el `where` y se espera directo. El mock soporta las dos.
          return Object.assign(Promise.resolve(resultado), {
            groupBy: () => Promise.resolve(resultado),
          });
        },
      }),
    }),
  },
  reservas: { playerId: "player_id", estado: "estado", saldoPendiente: "saldo_pendiente" },
}));

import { saldoPendienteDe, saldosPendientesDe } from "@/lib/saldo";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.where.mockResolvedValue([{ playerId: "jugador-1", saldo: "0" }]);
});

describe("saldoPendienteDe", () => {
  it("suma el saldo del jugador que se le pasa, no el de quien consulta", async () => {
    await saldoPendienteDe("jugador-endeudado");

    const condicion = mocks.where.mock.calls[0]?.[0] as { and: { inArray: unknown[] }[] };
    expect(condicion.and).toContainEqual({ inArray: ["player_id", ["jugador-endeudado"]] });
  });

  it("sólo cuenta las reservas en PAGO_PARCIAL", async () => {
    await saldoPendienteDe("jugador-1");

    const condicion = mocks.where.mock.calls[0]?.[0] as { and: { eq: unknown[] }[] };
    expect(condicion.and).toContainEqual({ eq: ["estado", "PAGO_PARCIAL"] });
  });

  it("devuelve el total como número", async () => {
    mocks.where.mockResolvedValue([{ playerId: "jugador-1", saldo: "80000.00" }]);
    expect(await saldoPendienteDe("jugador-1")).toBe(80000);
  });

  it("devuelve 0 cuando el jugador no debe nada", async () => {
    mocks.where.mockResolvedValue([{ playerId: "jugador-1", saldo: null }]);
    expect(await saldoPendienteDe("jugador-1")).toBe(0);
  });

  it("devuelve 0 cuando la consulta no trae filas", async () => {
    mocks.where.mockResolvedValue([]);
    expect(await saldoPendienteDe("jugador-1")).toBe(0);
  });
});

describe("saldosPendientesDe", () => {
  it("pregunta por todos los jugadores en UNA consulta, no una por cabeza", async () => {
    mocks.where.mockResolvedValue([]);

    await saldosPendientesDe(["jugador-1", "jugador-2", "jugador-3"]);

    expect(mocks.where).toHaveBeenCalledTimes(1);
    const condicion = mocks.where.mock.calls[0]?.[0] as { and: { inArray: unknown[] }[] };
    expect(condicion.and).toContainEqual({
      inArray: ["player_id", ["jugador-1", "jugador-2", "jugador-3"]],
    });
  });

  it("sólo cuenta PAGO_PARCIAL, igual que la versión de un jugador", async () => {
    mocks.where.mockResolvedValue([]);

    await saldosPendientesDe(["jugador-1"]);

    const condicion = mocks.where.mock.calls[0]?.[0] as { and: { eq: unknown[] }[] };
    expect(condicion.and).toContainEqual({ eq: ["estado", "PAGO_PARCIAL"] });
  });

  it("devuelve el saldo de cada jugador como número", async () => {
    mocks.where.mockResolvedValue([
      { playerId: "jugador-1", saldo: "50000.00" },
      { playerId: "jugador-2", saldo: "7500.50" },
    ]);

    const saldos = await saldosPendientesDe(["jugador-1", "jugador-2"]);

    expect(saldos.get("jugador-1")).toBe(50000);
    expect(saldos.get("jugador-2")).toBe(7500.5);
  });

  it("al que no debe nada no lo trae la consulta: preguntar por él da 0", async () => {
    mocks.where.mockResolvedValue([{ playerId: "jugador-1", saldo: "50000.00" }]);

    const saldos = await saldosPendientesDe(["jugador-1", "jugador-sin-deuda"]);

    expect(saldos.get("jugador-sin-deuda") ?? 0).toBe(0);
  });

  it("sin jugadores no toca la base: un IN vacío es una consulta al vacío", async () => {
    const saldos = await saldosPendientesDe([]);

    expect(mocks.where).not.toHaveBeenCalled();
    expect(saldos.size).toBe(0);
  });
});
