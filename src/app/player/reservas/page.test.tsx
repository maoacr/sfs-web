import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PlayerReservas from "./page";

const apiFetch = vi.fn(async () => ({
  ok: true,
  json: async () => ({ checkoutUrl: "https://mp/checkout" }),
}));

vi.mock("@/lib/api-client", () => ({ apiFetch: (...args: unknown[]) => apiFetch(...(args as [])) }));

const CANCHA = {
  nombre: "Cancha 1",
  tipo: "FUTBOL_5",
  complejo: { nombre: "Complejo Norte", zonaHoraria: "America/Bogota" },
};

function reserva(over: Record<string, unknown> = {}) {
  return {
    id: "reserva-1",
    cancha: CANCHA,
    slotInicio: "2026-11-18T02:00:00.000Z",
    slotFin: "2026-11-18T03:00:00.000Z",
    montoTotal: 160000,
    montoPagado: 80000,
    saldoPendiente: 80000,
    estado: "PAGO_PARCIAL",
    ...over,
  };
}

function montarCon(lista: unknown[]) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => lista })));
  return render(<PlayerReservas />);
}

beforeEach(() => {
  apiFetch.mockClear();
});

describe("PlayerReservas", () => {
  it("muestra una reserva en PAGO_PARCIAL", async () => {
    montarCon([reserva()]);
    expect(await screen.findByText("Cancha 1")).toBeInTheDocument();
  });

  it("avisa cuánto saldo queda pendiente", async () => {
    montarCon([reserva()]);
    expect(await screen.findByText(/saldo pendiente/i)).toBeInTheDocument();
  });

  it("deja pagar el saldo desde la tarjeta", async () => {
    montarCon([reserva()]);

    fireEvent.click(await screen.findByRole("button", { name: /pagar saldo/i }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const [ruta, opciones] = apiFetch.mock.calls[0] as unknown as [string, { body: string }];
    expect(ruta).toBe("/api/reservas/reserva-1/pagar-saldo");
    expect(JSON.parse(opciones.body)).toEqual({ monto: 80000 });
  });

  it("no ofrece pagar saldo cuando la reserva está confirmada", async () => {
    montarCon([reserva({ estado: "CONFIRMADA", montoPagado: 160000, saldoPendiente: 0 })]);

    expect(await screen.findByText("Cancha 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pagar saldo/i })).not.toBeInTheDocument();
  });

  it("muestra una reserva EXPIRADA en el historial", async () => {
    montarCon([reserva({ estado: "EXPIRADA" })]);

    expect(await screen.findByText("Cancha 1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^historial$/i })).toBeInTheDocument();
  });

  it("sigue mostrando el estado vacío cuando no hay ninguna", async () => {
    montarCon([]);
    expect(await screen.findByText(/no tenés reservas todavía/i)).toBeInTheDocument();
  });
});
