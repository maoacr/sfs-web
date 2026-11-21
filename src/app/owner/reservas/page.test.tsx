import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import OwnerReservas from "./page";

const apiFetch = vi.fn();
vi.mock("@/lib/api-client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...(a as [])) }));

function reserva(over: Record<string, unknown> = {}) {
  return {
    id: "reserva-1",
    cancha: { nombre: "Cancha 1", tipo: "FUTBOL_5", complejo: { nombre: "Norte", zonaHoraria: "America/Bogota" } },
    player: { primerNombre: "Juan", apellidos: "Pérez", apodo: null, telefono: "3001234567" },
    slotInicio: "2026-11-18T02:00:00.000Z",
    slotFin: "2026-11-18T03:00:00.000Z",
    montoTotal: 160000,
    montoPagado: 160000,
    saldoPendiente: 0,
    estado: "CONFIRMADA",
    ...over,
  };
}

function montarCon(lista: unknown[]) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
    ok: true,
    json: async () => (url.includes("/api/complejos") ? [] : lista),
  })));
  return render(<OwnerReservas />);
}

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
});

describe("OwnerReservas — acciones sobre una reserva", () => {
  it("las acciones dicen qué hacen, no son un símbolo suelto", async () => {
    montarCon([reserva()]);

    expect(await screen.findByRole("button", { name: /marcar.*jugada/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeInTheDocument();
  });

  it("cada acción dice sobre qué reserva actúa", async () => {
    montarCon([reserva()]);

    expect(await screen.findByRole("button", { name: /marcar.*jugada/i }))
      .toHaveAccessibleName(/juan pérez/i);
  });

  it("marcar como jugada no pide confirmación: no es destructivo", async () => {
    montarCon([reserva()]);

    fireEvent.click(await screen.findByRole("button", { name: /marcar.*jugada/i }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const [, opciones] = apiFetch.mock.calls[0] as unknown as [string, { body: string }];
    expect(JSON.parse(opciones.body)).toEqual({ estado: "COMPLETADA" });
  });

  it("cancelar SÍ pide confirmación antes de tocar nada", async () => {
    montarCon([reserva()]);

    fireEvent.click(await screen.findByRole("button", { name: /cancelar/i }));

    expect(apiFetch).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("al confirmar, cancela", async () => {
    montarCon([reserva()]);

    fireEvent.click(await screen.findByRole("button", { name: /cancelar/i }));
    const dialogo = within(screen.getByRole("dialog"));
    fireEvent.click(dialogo.getByRole("button", { name: /sí, cancelar/i }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const [, opciones] = apiFetch.mock.calls[0] as unknown as [string, { body: string }];
    expect(JSON.parse(opciones.body)).toEqual({ estado: "CANCELADA" });
  });

  it("avisa que hay plata de por medio antes de cancelar", async () => {
    montarCon([reserva({ montoPagado: 160000 })]);

    fireEvent.click(await screen.findByRole("button", { name: /cancelar/i }));

    expect(within(screen.getByRole("dialog")).getByText(/reembols/i)).toBeInTheDocument();
  });

  it("una reserva ya jugada no se vuelve a marcar como jugada", async () => {
    montarCon([reserva({ estado: "COMPLETADA" })]);

    await screen.findByText(/cancha 1/i);
    expect(screen.queryByRole("button", { name: /marcar.*jugada/i })).not.toBeInTheDocument();
  });

  it("sobre una reserva cancelada no se ofrece ninguna acción", async () => {
    montarCon([reserva({ estado: "CANCELADA" })]);

    await screen.findByText(/cancha 1/i);
    expect(screen.queryByRole("button", { name: /marcar.*jugada/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^cancelar la reserva/i })).not.toBeInTheDocument();
  });

  it("una reserva con pago parcial también se puede marcar jugada", async () => {
    montarCon([reserva({ estado: "PAGO_PARCIAL", montoPagado: 80000, saldoPendiente: 80000 })]);

    expect(await screen.findByRole("button", { name: /marcar.*jugada/i })).toBeInTheDocument();
  });
});
