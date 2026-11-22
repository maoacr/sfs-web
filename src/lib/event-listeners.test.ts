// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  reservaFindFirst: vi.fn(),
  crearNotificacion: vi.fn(),
  notificarPorEmail: vi.fn(),
}));

vi.mock("@sfs/db", () => ({
  db: { query: { reservas: { findFirst: mocks.reservaFindFirst } } },
  reservas: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({ eq: (columna: unknown, valor: unknown) => ({ eq: [columna, valor] }) }));
vi.mock("@/lib/notifications", () => ({ crearNotificacion: mocks.crearNotificacion }));
vi.mock("@/lib/email", () => ({ notificarPorEmail: mocks.notificarPorEmail }));

import { notificarReserva } from "@/lib/event-listeners";

const RESERVA = "33333333-3333-4333-8333-333333333333";

function filaDeReserva(over: Record<string, unknown> = {}) {
  return {
    id: RESERVA,
    slotInicio: new Date("2026-11-20T12:00:00Z"),
    slotFin: new Date("2026-11-20T13:00:00Z"),
    playerId: "player-1",
    tenantId: "tenant-1",
    montoTotal: "120000.00",
    saldoPendiente: "40000.00",
    cancha: { nombre: "Cancha 1", complejo: { nombre: "El Campito", zonaHoraria: "America/Bogota" } },
    player: { nombre: "Mario", apellido: "Crespo", email: "j@sfs.test" },
    tenant: { email: "d@sfs.test" },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.reservaFindFirst.mockResolvedValue(filaDeReserva());
  mocks.crearNotificacion.mockResolvedValue(undefined);
  mocks.notificarPorEmail.mockResolvedValue(undefined);
});

describe("notificarReserva — los montos llegan al email", () => {
  it("manda el saldo pendiente: sin esto la plantilla de pago parcial muestra —", async () => {
    await notificarReserva(RESERVA, "PAGO_PARCIAL_RECIBIDO");

    expect(mocks.notificarPorEmail).toHaveBeenCalledWith(
      expect.objectContaining({ saldoPendiente: "40000.00" })
    );
  });

  it("manda el monto total: sin esto el recibo muestra —", async () => {
    await notificarReserva(RESERVA, "RESERVA_CONFIRMADA");

    expect(mocks.notificarPorEmail).toHaveBeenCalledWith(
      expect.objectContaining({ montoTotal: "120000.00" })
    );
  });

  it("sigue mandando los datos de la cancha y el jugador", async () => {
    await notificarReserva(RESERVA, "RESERVA_CONFIRMADA");

    expect(mocks.notificarPorEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        canchaNombre: "Cancha 1",
        complejoNombre: "El Campito",
        playerNombre: "Mario Crespo",
        playerEmail: "j@sfs.test",
        tenantEmail: "d@sfs.test",
      })
    );
  });

  it("no revienta cuando la reserva no tiene saldo pendiente", async () => {
    mocks.reservaFindFirst.mockResolvedValue(filaDeReserva({ saldoPendiente: null }));

    await notificarReserva(RESERVA, "RESERVA_CONFIRMADA");

    expect(mocks.notificarPorEmail).toHaveBeenCalledWith(
      expect.objectContaining({ saldoPendiente: null })
    );
  });

  it("no notifica nada si la reserva no existe", async () => {
    mocks.reservaFindFirst.mockResolvedValue(undefined);

    await notificarReserva(RESERVA, "RESERVA_CONFIRMADA");

    expect(mocks.notificarPorEmail).not.toHaveBeenCalled();
    expect(mocks.crearNotificacion).not.toHaveBeenCalled();
  });
});
