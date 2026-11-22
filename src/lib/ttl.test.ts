// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  set: vi.fn(),
  where: vi.fn(),
  notificarReserva: vi.fn(async () => undefined),
  /** Filas que el UPDATE dice haber tocado. */
  filasLiberadas: [] as { id: string }[],
}));

vi.mock("drizzle-orm", () => ({
  and: (...partes: unknown[]) => ({ and: partes }),
  eq: (columna: unknown, valor: unknown) => ({ eq: [columna, valor] }),
  lt: (columna: unknown, valor: unknown) => ({ lt: [columna, valor] }),
  gt: (columna: unknown, valor: unknown) => ({ gt: [columna, valor] }),
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
            return { returning: async () => mocks.filasLiberadas };
          },
        };
      },
    }),
  },
  reservas: {
    _nombre: "reservas",
    estado: "estado",
    createdAt: "created_at",
    id: "id",
    canchaId: "cancha_id",
    slotInicio: "slot_inicio",
    slotFin: "slot_fin",
  },
  pagos: {
    _nombre: "pagos",
    estadoPago: "estado_pago",
    mpPaymentId: "mp_payment_id",
    createdAt: "created_at",
    id: "id",
  },
}));

vi.mock("./event-listeners", () => ({ notificarReserva: mocks.notificarReserva }));

import { expirarPagosAbandonados, liberarReservasExpiradas, liberarTurnoVencido } from "@/lib/ttl";
import { TTL_PAGO_MINUTOS, TTL_RESERVA_MINUTOS } from "@/lib/disponibilidad";

function condiciones() {
  const llamada = mocks.where.mock.calls[0]?.[0] as { and: unknown[] };
  return llamada.and;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.filasLiberadas = [];
});

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

const CANCHA = "33333333-3333-4333-8333-333333333333";
const INICIO = new Date("2026-12-01T20:00:00.000Z");
const FIN = new Date("2026-12-01T21:00:00.000Z");

/** Las condiciones del último WHERE, aplanadas: `and` puede venir anidado. */
function condicionesPlanas() {
  const ultima = mocks.where.mock.calls.at(-1)?.[0];
  const aplanar = (nodo: unknown): unknown[] => {
    if (typeof nodo === "object" && nodo !== null && "and" in nodo) {
      return (nodo as { and: unknown[] }).and.flatMap(aplanar);
    }
    return [nodo];
  };
  return aplanar(ultima);
}

describe("liberarTurnoVencido", () => {
  it("acota el barrido a la cancha del turno", async () => {
    await liberarTurnoVencido({ canchaId: CANCHA, inicio: INICIO, fin: FIN });

    expect(condicionesPlanas()).toContainEqual({ eq: ["cancha_id", CANCHA] });
  });

  it("solapa con el intervalo medio-abierto: el turno que termina donde arranca el otro no choca", async () => {
    // Mismo criterio que el chequeo de la app y que el `[)` del constraint.
    // Con `<=` una reserva de 19 a 20 bloquearía la de 20 a 21.
    await liberarTurnoVencido({ canchaId: CANCHA, inicio: INICIO, fin: FIN });

    const condiciones = condicionesPlanas();
    expect(condiciones).toContainEqual({ lt: ["slot_inicio", FIN] });
    expect(condiciones).toContainEqual({ gt: ["slot_fin", INICIO] });
  });

  it("sólo asienta PENDIENTE_PAGO: una PAGO_PARCIAL no expira nunca", async () => {
    await liberarTurnoVencido({ canchaId: CANCHA, inicio: INICIO, fin: FIN });

    expect(condicionesPlanas()).toContainEqual({ eq: ["estado", "PENDIENTE_PAGO"] });
  });

  it("usa el MISMO corte de edad que el barrido global", async () => {
    // Si los dos cortes divergieran, el acotado liberaría filas que el global
    // considera vivas (o al revés) y el constraint rechazaría reservas buenas.
    await liberarReservasExpiradas();
    const corteGlobal = cortePorEdad();

    await liberarTurnoVencido({ canchaId: CANCHA, inicio: INICIO, fin: FIN });
    const corteAcotado = cortePorEdad();

    expect(Math.abs(corteAcotado - corteGlobal)).toBeLessThan(1000);
    expect(corteAcotado).toBeLessThanOrEqual(Date.now() - TTL_RESERVA_MINUTOS * 60 * 1000);
  });

  it("notifica la expiración de cada reserva que asentó", async () => {
    mocks.filasLiberadas = [{ id: "reserva-a" }, { id: "reserva-b" }];

    await liberarTurnoVencido({ canchaId: CANCHA, inicio: INICIO, fin: FIN });

    expect(mocks.notificarReserva).toHaveBeenCalledWith("reserva-a", "RESERVA_EXPIRADA");
    expect(mocks.notificarReserva).toHaveBeenCalledWith("reserva-b", "RESERVA_EXPIRADA");
  });

  it("no notifica nada cuando no había nada vencido", async () => {
    await liberarTurnoVencido({ canchaId: CANCHA, inicio: INICIO, fin: FIN });

    expect(mocks.notificarReserva).not.toHaveBeenCalled();
  });

  it("deja la reserva sin saldo: lo que se liberó no se cobra", async () => {
    await liberarTurnoVencido({ canchaId: CANCHA, inicio: INICIO, fin: FIN });

    const [tabla, valores] = mocks.set.mock.calls.at(-1) as [string, Record<string, unknown>];
    expect(tabla).toBe("reservas");
    expect(valores.estado).toBe("CANCELADA");
    expect(valores.saldoPendiente).toBe("0.00");
  });
});

/** El límite temporal del último WHERE, en epoch ms. */
function cortePorEdad() {
  const corte = condicionesPlanas().find(
    (c): c is { lt: [string, Date] } =>
      typeof c === "object" && c !== null && "lt" in c && (c as { lt: [string, unknown] }).lt[0] === "created_at"
  );
  return corte!.lt[1].getTime();
}
