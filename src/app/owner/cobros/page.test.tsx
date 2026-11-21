import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import OwnerCobros from "./page";

const apiFetch = vi.fn();
vi.mock("@/lib/api-client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...(a as [])) }));

const CANCHA = {
  nombre: "Cancha 1",
  tipo: "FUTBOL_5",
  complejo: { nombre: "Complejo Norte", zonaHoraria: "America/Bogota" },
};

function deuda(over: Record<string, unknown> = {}) {
  return {
    id: "reserva-1",
    cancha: CANCHA,
    player: { primerNombre: "Juan", apellidos: "Pérez", apodo: null, telefono: "3001234567" },
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
  return render(<OwnerCobros />);
}

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockResolvedValue({ ok: true, json: async () => ({ estado: "CONFIRMADA" }) });
});

describe("OwnerCobros", () => {
  it("pide al API sólo las reservas con saldo", async () => {
    montarCon([]);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    const [ruta] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(ruta).toContain("conSaldo=true");
  });

  it("muestra quién debe, cuánto y de qué cancha", async () => {
    montarCon([deuda()]);

    const fila = within(await screen.findByRole("listitem"));
    expect(fila.getByText(/juan pérez/i)).toBeInTheDocument();
    expect(fila.getByText(/cancha 1/i)).toBeInTheDocument();
    expect(fila.getByText(/80\.000/)).toBeInTheDocument();
  });

  it("suma el total por cobrar, que es el número que el dueño busca", async () => {
    montarCon([deuda(), deuda({ id: "reserva-2", saldoPendiente: 50000 })]);

    expect(await screen.findByText(/130\.000/)).toBeInTheDocument();
  });

  it("deja cobrar una reserva de un partido ya jugado", async () => {
    montarCon([deuda({ estado: "COMPLETADA" })]);

    fireEvent.click(await screen.findByRole("button", { name: /registrar pago/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("al registrar el cobro vuelve a consultar: la deuda ya no está", async () => {
    montarCon([deuda()]);

    fireEvent.click(await screen.findByRole("button", { name: /registrar pago/i }));

    const modal = within(screen.getByRole("dialog"));
    fireEvent.click(modal.getByRole("button", { name: /registrar pago/i }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });

  it("cuando no hay deudas lo dice y no deja un listado vacío", async () => {
    montarCon([]);

    expect(await screen.findByText(/no hay nada por cobrar/i)).toBeInTheDocument();
  });
});
