// @vitest-environment node
import { describe, it, expect } from "vitest";
import { horariosDeSlots } from "@/app/owner/canchas/[id]/page";

const slot = (over: Record<string, unknown> = {}) => ({
  id: "slot-1",
  diaSemana: 1,
  horaApertura: "1970-01-01T08:00:00.000Z",
  horaCierre: "1970-01-01T23:00:00.000Z",
  ...over,
});

describe("horariosDeSlots", () => {
  it("saca la hora de apertura y cierre del ISO guardado", () => {
    expect(horariosDeSlots([slot()])).toEqual({
      "slot-1": { apertura: "08:00", cierre: "23:00" },
    });
  });

  it("indexa por id para que cada fila encuentre su horario", () => {
    const horarios = horariosDeSlots([
      slot({ id: "lunes", horaApertura: "1970-01-01T06:30:00.000Z" }),
      slot({ id: "martes", horaCierre: "1970-01-01T21:45:00.000Z" }),
    ]);

    expect(horarios["lunes"].apertura).toBe("06:30");
    expect(horarios["martes"].cierre).toBe("21:45");
  });

  it("cae en los valores por defecto de la UI cuando el slot viene sin horas", () => {
    expect(horariosDeSlots([slot({ horaApertura: undefined, horaCierre: undefined })])).toEqual({
      "slot-1": { apertura: "08:00", cierre: "23:00" },
    });
  });

  it("devuelve vacío sin slots: la grilla no tiene nada que pintar", () => {
    expect(horariosDeSlots([])).toEqual({});
  });
});
