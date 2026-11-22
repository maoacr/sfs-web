import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import OwnerDashboard from "./page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

function reserva(over: Record<string, unknown> = {}) {
  return {
    id: "reserva-1",
    cancha: { nombre: "Cancha 1", tipo: "FUTBOL_5", complejo: { nombre: "Norte", zonaHoraria: "America/Bogota" } },
    player: { primerNombre: "Juan", apellidos: "Pérez", apodo: null },
    slotInicio: "2026-11-22T14:00:00.000Z",
    slotFin: "2026-11-22T15:00:00.000Z",
    estado: "PAGO_PARCIAL",
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
