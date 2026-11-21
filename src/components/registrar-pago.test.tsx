import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RegistrarPago } from "@/components/registrar-pago";

const apiFetch = vi.fn();
vi.mock("@/lib/api-client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...(a as [])) }));

const RESERVA = { id: "reserva-1", saldoPendiente: 80000, titular: "Juan Pérez" };

function montar(over: Partial<typeof RESERVA> = {}) {
  const onRegistrado = vi.fn();
  render(
    <RegistrarPago reserva={{ ...RESERVA, ...over }} onCerrar={() => {}} onRegistrado={onRegistrado} />
  );
  return { onRegistrado };
}

const cuerpoEnviado = () => {
  const [, opciones] = apiFetch.mock.calls[0] as unknown as [string, { body: string }];
  return JSON.parse(opciones.body);
};

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockResolvedValue({ ok: true, json: async () => ({ estado: "CONFIRMADA" }) });
});

describe("RegistrarPago", () => {
  it("arranca proponiendo cobrar todo el saldo", () => {
    montar();
    expect(screen.getByLabelText(/monto/i)).toHaveValue(80000);
  });

  it("cobra en efectivo por defecto y sin pedir entidad", async () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /registrar/i }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(cuerpoEnviado()).toEqual({ metodo: "EFECTIVO", monto: 80000 });
  });

  it("no pide entidad para efectivo, porque no hay ninguna", () => {
    montar();
    expect(screen.queryByLabelText(/entidad|banco/i)).not.toBeInTheDocument();
  });

  it("no ofrece PSE ni billetera: en el mostrador eso es una transferencia", () => {
    montar();
    const opciones = Array.from(screen.getByLabelText(/método/i).querySelectorAll("option"))
      .map(o => (o as HTMLOptionElement).value);

    expect(opciones).not.toContain("PSE");
    expect(opciones).not.toContain("BILLETERA");
  });

  it("ofrece lo que de verdad pasa en un mostrador", () => {
    montar();
    const opciones = Array.from(screen.getByLabelText(/método/i).querySelectorAll("option"))
      .map(o => (o as HTMLOptionElement).value);

    expect(opciones).toEqual(["EFECTIVO", "TRANSFERENCIA", "TARJETA_DEBITO", "TARJETA_CREDITO", "OTRO"]);
  });

  it("pide la entidad cuando el cobro fue por transferencia", () => {
    montar();
    fireEvent.change(screen.getByLabelText(/método/i), { target: { value: "TRANSFERENCIA" } });

    expect(screen.getByLabelText(/entidad|banco/i)).toBeInTheDocument();
  });

  it("manda método y entidad juntos", async () => {
    montar();
    fireEvent.change(screen.getByLabelText(/método/i), { target: { value: "TRANSFERENCIA" } });
    fireEvent.change(screen.getByLabelText(/entidad|banco/i), { target: { value: "Nequi" } });
    fireEvent.click(screen.getByRole("button", { name: /registrar/i }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(cuerpoEnviado()).toMatchObject({ metodo: "TRANSFERENCIA", entidad: "Nequi" });
  });

  it("deja registrar un abono parcial", async () => {
    montar();
    fireEvent.change(screen.getByLabelText(/monto/i), { target: { value: "30000" } });
    fireEvent.click(screen.getByRole("button", { name: /registrar/i }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(cuerpoEnviado().monto).toBe(30000);
  });

  it("no deja cobrar más que el saldo", async () => {
    montar();
    fireEvent.change(screen.getByLabelText(/monto/i), { target: { value: "200000" } });
    fireEvent.click(screen.getByRole("button", { name: /registrar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/saldo/i);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("no deja registrar un cobro de cero", async () => {
    montar();
    fireEvent.change(screen.getByLabelText(/monto/i), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /registrar/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("muestra el error del servidor en vez de tragárselo", async () => {
    apiFetch.mockResolvedValue({ ok: false, json: async () => ({ error: "No se puede cobrar una reserva cancelada" }) });
    montar();
    fireEvent.click(screen.getByRole("button", { name: /registrar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/cancelada/i);
  });

  it("avisa cuando el cobro quedó registrado", async () => {
    const { onRegistrado } = montar();
    fireEvent.click(screen.getByRole("button", { name: /registrar/i }));

    await waitFor(() => expect(onRegistrado).toHaveBeenCalled());
  });

  it("dice de quién es la deuda que se está cobrando", () => {
    montar();
    expect(screen.getByText(/juan pérez/i)).toBeInTheDocument();
  });
});
