// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ set: vi.fn(), where: vi.fn() }));

vi.mock("drizzle-orm", () => ({
  and: (...partes: unknown[]) => ({ and: partes }),
  eq: (columna: unknown, valor: unknown) => ({ eq: [columna, valor] }),
  lt: (columna: unknown, valor: unknown) => ({ lt: [columna, valor] }),
  isNull: (columna: unknown) => ({ isNull: columna }),
}));

vi.mock("@sfs/db", () => ({
  db: {
    update: (tabla: { _nombre: string }) => ({
      set: (valores: Record<string, unknown>) => {
        mocks.set(tabla._nombre, valores);
        return {
          where: (condicion: unknown) => {
            mocks.where(condicion);
            return { returning: async () => [] };
          },
        };
      },
    }),
  },
  reservas: { _nombre: "reservas", estado: "estado", createdAt: "created_at", id: "id" },
  pagos: {
    _nombre: "pagos",
    estadoPago: "estado_pago",
    mpPaymentId: "mp_payment_id",
    createdAt: "created_at",
    id: "id",
  },
}));

vi.mock("./event-listeners", () => ({ notificarReserva: vi.fn(async () => undefined) }));

import { expirarPagosAbandonados } from "@/lib/ttl";
import { TTL_PAGO_MINUTOS } from "@/lib/disponibilidad";

function condiciones() {
  const llamada = mocks.where.mock.calls[0]?.[0] as { and: unknown[] };
  return llamada.and;
}

beforeEach(() => vi.clearAllMocks());

describe("expirarPagosAbandonados", () => {
  it("sólo toca pagos que siguen PENDIENTE", async () => {
    await expirarPagosAbandonados();
    expect(condiciones()).toContainEqual({ eq: ["estado_pago", "PENDIENTE"] });
  });

  it("NUNCA expira un pago que MercadoPago ya reconoció", async () => {
    await expirarPagosAbandonados();
    // Sin este guard, una revisión manual de MP —que puede tardar días— se
    // marcaría como abandonada y el webhook llegaría sin nada que aplicar.
    expect(condiciones()).toContainEqual({ isNull: "mp_payment_id" });
  });

  it("respeta la ventana de TTL_PAGO_MINUTOS", async () => {
    const antes = Date.now();
    await expirarPagosAbandonados();

    const corte = condiciones().find((c): c is { lt: [string, Date] } =>
      typeof c === "object" && c !== null && "lt" in c
    );
    const limite = corte!.lt[1].getTime();

    expect(limite).toBeLessThanOrEqual(antes - TTL_PAGO_MINUTOS * 60 * 1000);
    expect(limite).toBeGreaterThan(antes - (TTL_PAGO_MINUTOS + 1) * 60 * 1000);
  });

  it("los marca EXPIRADO, no RECHAZADO: el banco no dijo que no", async () => {
    await expirarPagosAbandonados();

    const [tabla, valores] = mocks.set.mock.calls[0] as [string, Record<string, unknown>];
    expect(tabla).toBe("pagos");
    expect(valores.estadoPago).toBe("EXPIRADO");
    expect(valores.detalleEstado).toBeTruthy();
  });
});
