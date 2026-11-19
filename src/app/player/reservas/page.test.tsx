import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PlayerReservas from "./page";

const params = new URLSearchParams();
vi.mock("next/navigation", () => ({ useSearchParams: () => params }));

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
  for (const clave of [...params.keys()]) params.delete(clave);
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

  it("deja pagar el saldo sin mandar el monto: lo decide el servidor", async () => {
    montarCon([reserva()]);

    fireEvent.click(await screen.findByRole("button", { name: /pagar saldo/i }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const [ruta, opciones] = apiFetch.mock.calls[0] as unknown as [string, { body: string }];
    expect(ruta).toBe("/api/reservas/reserva-1/pagar-saldo");
    // El saldo del cliente puede estar viejo; el servidor lo lee al cobrar.
    expect(JSON.parse(opciones.body)).toEqual({});
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

  it("presenta las reservas como una lista", async () => {
    montarCon([reserva(), reserva({ id: "reserva-2", estado: "CONFIRMADA", saldoPendiente: 0 })]);

    expect(await screen.findAllByRole("listitem")).toHaveLength(2);
  });

  it("los botones dicen de qué reserva son", async () => {
    montarCon([reserva()]);

    const pagar = await screen.findByRole("button", { name: /pagar saldo/i });
    expect(pagar).toHaveAccessibleName(/cancha 1/i);

    const cancelar = screen.getByRole("button", { name: /cancelar/i });
    expect(cancelar).toHaveAccessibleName(/cancha 1/i);
  });

  it("pide confirmación antes de cancelar", async () => {
    montarCon([reserva()]);

    fireEvent.click(await screen.findByRole("button", { name: /cancelar/i }));
    expect(apiFetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /sí, cancelar/i }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
  });

  it("deja arrepentirse de cancelar", async () => {
    montarCon([reserva()]);

    fireEvent.click(await screen.findByRole("button", { name: /cancelar/i }));
    fireEvent.click(screen.getByRole("button", { name: /no, dejarla/i }));

    expect(apiFetch).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeInTheDocument();
  });

  it("anuncia que está cargando", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<PlayerReservas />);

    expect(screen.getByRole("status")).toHaveAccessibleName(/cargando/i);
  });

  it("sigue mostrando el estado vacío cuando no hay ninguna", async () => {
    montarCon([]);
    expect(await screen.findByText(/no tenés reservas todavía/i)).toBeInTheDocument();
  });
});

describe("PlayerReservas — resultado del pago", () => {
  it("al volver rechazado de MercadoPago se lo dice, no lo deja adivinando", async () => {
    params.set("status", "rejected");
    montarCon([reserva()]);

    expect(await screen.findByRole("alert")).toHaveTextContent(/rechaz/i);
  });

  it("al volver aprobado lo confirma", async () => {
    params.set("status", "approved");
    montarCon([reserva({ estado: "CONFIRMADA", saldoPendiente: 0 })]);

    expect(await screen.findByRole("alert")).toHaveTextContent(/acredit/i);
  });

  it("sin vuelta de MercadoPago no muestra ningún aviso", async () => {
    montarCon([reserva()]);

    await screen.findByText("Cancha 1");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("explica el motivo concreto del último pago fallido", async () => {
    montarCon([
      reserva({
        ultimoPago: { estadoPago: "RECHAZADO", detalleEstado: "cc_rejected_insufficient_amount" },
      }),
    ]);

    expect(await screen.findByText(/fondos/i)).toBeInTheDocument();
  });

  it("ante un pago duplicado esconde el botón: reintentar cobraría dos veces", async () => {
    montarCon([
      reserva({
        ultimoPago: { estadoPago: "RECHAZADO", detalleEstado: "cc_rejected_duplicated_payment" },
      }),
    ]);

    expect(await screen.findByText("Cancha 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pagar saldo/i })).not.toBeInTheDocument();
  });

  it("un pago en revisión manual tampoco invita a pagar de nuevo", async () => {
    montarCon([
      reserva({
        ultimoPago: { estadoPago: "PENDIENTE", detalleEstado: "pending_review_manual" },
      }),
    ]);

    expect(await screen.findByText(/revis/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pagar saldo/i })).not.toBeInTheDocument();
  });

  it("un pago aprobado NO bloquea pagar el saldo que queda", async () => {
    // Un abono exitoso del 50% deja la reserva en PAGO_PARCIAL. "No reintentar
    // ese pago" y "no poder pagar el resto" son cosas distintas.
    montarCon([
      reserva({
        estado: "PAGO_PARCIAL",
        saldoPendiente: 80000,
        ultimoPago: { estadoPago: "APROBADO", detalleEstado: "accredited" },
      }),
    ]);

    expect(await screen.findByRole("button", { name: /pagar saldo/i })).toBeInTheDocument();
  });

  it("tampoco muestra el motivo de un pago que salió bien", async () => {
    montarCon([
      reserva({ ultimoPago: { estadoPago: "APROBADO", detalleEstado: "accredited" } }),
    ]);

    await screen.findByText("Cancha 1");
    expect(screen.queryByText(/se acreditó/i)).not.toBeInTheDocument();
  });

  it("un rechazo por fondos sí deja volver a intentar con otra tarjeta", async () => {
    montarCon([
      reserva({
        ultimoPago: { estadoPago: "RECHAZADO", detalleEstado: "cc_rejected_insufficient_amount" },
      }),
    ]);

    expect(await screen.findByRole("button", { name: /pagar saldo/i })).toBeInTheDocument();
  });
});
