import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { AgendaView } from "@/components/agenda-view";

// Miércoles 2026-11-18, 15:00 local. Fijo para que "hoy" sea determinista:
// el componente selecciona hoy al montar y pide los slots de esa fecha.
const HOY = new Date(2026, 10, 18, 15, 0, 0);

const CANCHA = "55555555-5555-4555-8555-555555555555";

function urlsPedidas(): string[] {
  return (globalThis.fetch as unknown as { mock: { calls: [string][] } }).mock.calls.map(
    ([url]) => String(url)
  );
}

function stubFetch(slots: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("/api/disponibilidad")) {
        return { ok: true, json: async () => [{ id: CANCHA, slots }] };
      }
      return {
        ok: true,
        json: async () => ({
          id: CANCHA,
          nombre: "Cancha 1",
          tipo: "F5",
          duracionSlotMinutos: 60,
          complejo: { nombre: "El Campito", zonaHoraria: "America/Bogota" },
        }),
      };
    })
  );
}

const SLOT = {
  inicio: "2026-11-18T12:00:00.000Z",
  fin: "2026-11-18T13:00:00.000Z",
  horaInicio: "07:00",
  horaFin: "08:00",
  disponible: true,
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(HOY);
  stubFetch([SLOT]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AgendaView — comportamiento al montar y al cambiar de día", () => {
  it("pide los datos de la cancha", async () => {
    render(<AgendaView canchaId={CANCHA} />);

    await waitFor(() => expect(screen.getByText("Cancha 1")).toBeInTheDocument());
    expect(urlsPedidas()).toContain(`/api/canchas/${CANCHA}`);
  });

  it("selecciona hoy al montar y pide la disponibilidad de hoy", async () => {
    render(<AgendaView canchaId={CANCHA} />);

    await waitFor(() =>
      expect(urlsPedidas().some(url => url.includes("/api/disponibilidad?fecha=2026-11-18"))).toBe(true)
    );
  });

  it("muestra el horario de los slots que devuelve la API", async () => {
    render(<AgendaView canchaId={CANCHA} />);

    expect(await screen.findByText(/07:00/)).toBeInTheDocument();
  });

  it("al tocar otro día de la semana pide la disponibilidad de ese día", async () => {
    render(<AgendaView canchaId={CANCHA} />);
    await waitFor(() => expect(urlsPedidas().length).toBeGreaterThan(1));

    // La semana arranca el lunes: el 16 es dos días antes del miércoles 18.
    fireEvent.click(screen.getByText("16"));

    await waitFor(() =>
      expect(urlsPedidas().some(url => url.includes("/api/disponibilidad?fecha=2026-11-16"))).toBe(true)
    );
  });

  it("no deja slots viejos en pantalla si la API falla", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/api/disponibilidad")) throw new Error("caída");
        return { ok: true, json: async () => ({ id: CANCHA, nombre: "Cancha 1", tipo: "F5", duracionSlotMinutos: 60, complejo: { nombre: "El Campito" } }) };
      })
    );

    render(<AgendaView canchaId={CANCHA} />);

    await waitFor(() => expect(screen.queryByText(/07:00/)).not.toBeInTheDocument());
  });
});
