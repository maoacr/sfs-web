import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import OwnerDashboard from "./page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const apiFetch = vi.fn();
vi.mock("@/lib/api-client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...(a as [])) }));

function reserva(over: Record<string, unknown> = {}) {
  return {
    id: "reserva-1",
    cancha: { nombre: "Cancha 1", tipo: "FUTBOL_5", complejo: { nombre: "Norte", zonaHoraria: "America/Bogota" } },
    player: { primerNombre: "Juan", apellidos: "Pérez", apodo: null },
    slotInicio: "2026-11-22T14:00:00.000Z",
    slotFin: "2026-11-22T15:00:00.000Z",
    estado: "PAGO_PARCIAL",
    montoTotal: 100000,
    montoPagado: 50000,
    saldoPendiente: 50000,
    invitadoNombre: null,
    ultimoPago: null,
    ...over,
  };
}

/** Las URLs con las que el dashboard consultó el API. */
function urlsConsultadas(): string[] {
  const llamadas = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
  return llamadas.map(([url]) => String(url));
}

function montarCon(lista: unknown[]) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
    ok: true,
    json: async () => (url.includes("/api/complejos") ? [] : lista),
  })));
  return render(<OwnerDashboard />);
}

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.useFakeTimers({ shouldAdvanceTime: true });
  // Hoy es el 2026-11-22 en Bogotá. Sin fijarlo, el test se rompería mañana.
  vi.setSystemTime(new Date("2026-11-22T17:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("OwnerDashboard — las reservas de hoy son las de HOY", () => {
  it("pregunta por el día de hoy, no por todas las reservas de la historia", async () => {
    montarCon([]);

    await waitFor(() => expect(urlsConsultadas().length).toBeGreaterThan(1));
    const consultaReservas = urlsConsultadas().find(url => url.includes("/api/reservas"));
    expect(consultaReservas).toContain("fecha=2026-11-22");
  });

  it("nunca manda la fecha vacía: el API lo lee como 'no filtres' y trae todo", async () => {
    montarCon([]);

    await waitFor(() => expect(urlsConsultadas().length).toBeGreaterThan(1));
    const consultaReservas = urlsConsultadas().find(url => url.includes("/api/reservas")) ?? "";
    expect(consultaReservas).not.toMatch(/fecha=(&|$)/);
  });

  it("pide las efectivas, no un solo estado: un abono también es una reserva", async () => {
    montarCon([]);

    await waitFor(() => expect(urlsConsultadas().length).toBeGreaterThan(1));
    const consultaReservas = urlsConsultadas().find(url => url.includes("/api/reservas")) ?? "";
    expect(consultaReservas).toContain("efectivas=true");
    expect(consultaReservas).not.toContain("estado=CONFIRMADA");
  });

  it("cuenta lo que trajo el API, y muestra la reserva de hoy", async () => {
    montarCon([reserva()]);

    expect(await screen.findByText("1")).toBeInTheDocument();
    expect(await screen.findByText(/cancha 1/i)).toBeInTheDocument();
    expect(screen.getByText(/juan pérez/i)).toBeInTheDocument();
  });

  it("sin reservas hoy no muestra la sección en vez de mentir con datos viejos", async () => {
    montarCon([]);

    await waitFor(() => expect(urlsConsultadas().length).toBeGreaterThan(1));
    expect(screen.queryByText(/pendientes de completar/i)).not.toBeInTheDocument();
  });
});

describe("OwnerDashboard — la sección lista lo que falta cerrar, no lo que ya se cerró", () => {
  it("una reserva ya jugada no ocupa lugar en la lista", async () => {
    montarCon([reserva({ estado: "COMPLETADA" })]);

    await waitFor(() => expect(urlsConsultadas().length).toBeGreaterThan(1));
    expect(screen.queryByText(/cancha 1/i)).not.toBeInTheDocument();
  });

  it("pero sí cuenta en 'Reservas hoy': jugarse no la borra del día", async () => {
    montarCon([reserva({ estado: "COMPLETADA" })]);

    expect(await screen.findByText("1")).toBeInTheDocument();
  });

  it("si todo lo de hoy ya se jugó, la sección no aparece", async () => {
    montarCon([reserva({ estado: "COMPLETADA" }), reserva({ id: "r2", estado: "COMPLETADA" })]);

    await waitFor(() => expect(urlsConsultadas().length).toBeGreaterThan(1));
    expect(screen.queryByTitle(/pendientes/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pendientes de completar/i)).not.toBeInTheDocument();
  });

  it("lista la que falta cerrar aunque el turno ya haya pasado: es lo que hay que hacer", async () => {
    montarCon([reserva({ estado: "CONFIRMADA", slotInicio: "2026-11-22T11:00:00.000Z" })]);

    expect(await screen.findByText(/pendientes de completar/i)).toBeInTheDocument();
    expect(screen.getByText(/cancha 1/i)).toBeInTheDocument();
  });

  it("conviven: cuenta dos en el día y lista sólo la que falta", async () => {
    montarCon([
      reserva({ id: "jugada", estado: "COMPLETADA" }),
      reserva({ id: "por-jugar", estado: "PAGO_PARCIAL", cancha: { nombre: "Cancha 7", complejo: { nombre: "Norte", zonaHoraria: "America/Bogota" } } }),
    ]);

    expect(await screen.findByText("2")).toBeInTheDocument();
    expect(screen.getByText(/cancha 7/i)).toBeInTheDocument();
    expect(screen.queryByText(/cancha 1/i)).not.toBeInTheDocument();
  });
});

describe("OwnerDashboard — el detalle de la reserva", () => {
  async function abrirDetalle(over: Record<string, unknown> = {}) {
    montarCon([reserva(over)]);
    fireEvent.click(await screen.findByRole("button", { name: /cancha 1/i }));
  }

  it("la tarjeta se puede abrir: es un botón, no un div decorativo", async () => {
    montarCon([reserva()]);

    expect(await screen.findByRole("button", { name: /cancha 1/i })).toBeInTheDocument();
  });

  it("al abrirla muestra de qué reserva se trata", async () => {
    await abrirDetalle();

    const detalle = screen.getByRole("dialog");
    expect(within(detalle).getByText(/cancha 1/i)).toBeInTheDocument();
    expect(within(detalle).getByText(/norte/i)).toBeInTheDocument();
    expect(within(detalle).getByText(/juan pérez/i)).toBeInTheDocument();
  });

  it("muestra la plata desglosada: total, pagado y saldo", async () => {
    await abrirDetalle();

    const detalle = screen.getByRole("dialog");
    expect(within(detalle).getByText(/100\.000/)).toBeInTheDocument();
    expect(within(detalle).getAllByText(/50\.000/).length).toBeGreaterThan(0);
    expect(within(detalle).getByText(/saldo/i)).toBeInTheDocument();
  });

  it("dice que la reserva es de un invitado, no del dueño a cuya cuenta apunta", async () => {
    await abrirDetalle({ invitadoNombre: "Pedro Sin Cuenta" });

    expect(within(screen.getByRole("dialog")).getByText(/pedro sin cuenta/i)).toBeInTheDocument();
  });

  it("muestra el último intento de pago, que explica por qué no se acreditó", async () => {
    await abrirDetalle({
      ultimoPago: { estadoPago: "RECHAZADO", detalleEstado: "cc_rejected_insufficient_amount", monto: 50000, createdAt: "2026-11-22T13:30:00.000Z" },
    });

    const detalle = screen.getByRole("dialog");
    expect(within(detalle).getByText(/rechazado/i)).toBeInTheDocument();
    expect(within(detalle).getByText(/insufficient/i)).toBeInTheDocument();
  });

  it("con saldo ofrece cobrarlo", async () => {
    await abrirDetalle();

    expect(within(screen.getByRole("dialog")).getByRole("button", { name: /cobrar/i })).toBeInTheDocument();
  });

  it("sin saldo no ofrece cobrar lo que no se debe", async () => {
    await abrirDetalle({ saldoPendiente: 0, montoPagado: 100000 });

    expect(within(screen.getByRole("dialog")).queryByRole("button", { name: /cobrar/i })).not.toBeInTheDocument();
  });

  it("marcar jugada cierra el turno y no pide confirmación: no es destructivo", async () => {
    await abrirDetalle();

    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /marcar.*jugada/i }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const [ruta, opciones] = apiFetch.mock.calls[0] as unknown as [string, { body: string }];
    expect(ruta).toBe("/api/reservas/reserva-1");
    expect(JSON.parse(opciones.body)).toEqual({ estado: "COMPLETADA" });
  });

  it("cancelar SÍ pide confirmación antes de tocar nada", async () => {
    await abrirDetalle();

    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /cancelar la reserva/i }));

    expect(apiFetch).not.toHaveBeenCalled();
    expect(screen.getByText(/¿cancelar esta reserva\?/i)).toBeInTheDocument();
  });

  it("la confirmación de cancelar avisa de la plata ya pagada", async () => {
    await abrirDetalle();

    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /cancelar la reserva/i }));

    expect(screen.getByText(/política de reembolso/i)).toBeInTheDocument();
  });

  it("se puede cerrar el detalle sin hacer nada", async () => {
    await abrirDetalle();

    fireEvent.click(screen.getByRole("button", { name: /cerrar el detalle/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
