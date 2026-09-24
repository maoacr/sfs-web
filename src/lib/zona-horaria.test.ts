import { describe, it, expect } from "vitest";
import {
  aInstante,
  partesEnZona,
  esZonaHorariaValida,
  formatearHora,
  ventanaDelDia,
  ZONA_HORARIA_DEFAULT,
} from "@/lib/zona-horaria";

describe("aInstante", () => {
  it("interpreta la hora local de Bogotá (UTC-5)", () => {
    expect(aInstante("2026-10-05", "07:00", "America/Bogota").toISOString()).toBe(
      "2026-10-05T12:00:00.000Z"
    );
  });

  it("cruza al día siguiente en UTC para horas de la noche", () => {
    expect(aInstante("2026-10-05", "23:30", "America/Bogota").toISOString()).toBe(
      "2026-10-06T04:30:00.000Z"
    );
  });

  it("respeta el horario de verano de zonas que lo tienen", () => {
    // Santiago: UTC-4 en invierno (julio), UTC-3 en verano (octubre)
    expect(aInstante("2026-07-06", "07:00", "America/Santiago").toISOString()).toBe(
      "2026-07-06T11:00:00.000Z"
    );
    expect(aInstante("2026-10-05", "07:00", "America/Santiago").toISOString()).toBe(
      "2026-10-05T10:00:00.000Z"
    );
  });
});

describe("partesEnZona", () => {
  it("devuelve fecha y hora locales de la zona, no de UTC", () => {
    expect(partesEnZona(new Date("2026-10-06T04:30:00.000Z"), "America/Bogota")).toEqual({
      fecha: "2026-10-05",
      hora: "23:30",
    });
  });

  it("es la inversa de aInstante", () => {
    const instante = aInstante("2026-12-31", "19:00", "America/Mexico_City");
    expect(partesEnZona(instante, "America/Mexico_City")).toEqual({
      fecha: "2026-12-31",
      hora: "19:00",
    });
  });
});

describe("ventanaDelDia", () => {
  it("cubre el día de calendario en cualquier zona (UTC-12 a UTC+14)", () => {
    const { desde, hasta } = ventanaDelDia("2026-10-05");
    expect(desde.toISOString()).toBe("2026-10-04T10:00:00.000Z");
    expect(hasta.toISOString()).toBe("2026-10-06T12:00:00.000Z");
    expect(desde <= aInstante("2026-10-05", "00:00", "Pacific/Kiritimati")).toBe(true);
    expect(hasta >= aInstante("2026-10-05", "23:59", "Etc/GMT+12")).toBe(true);
  });
});

describe("formatearHora", () => {
  it("formatea en la zona indicada sin importar la del sistema", () => {
    expect(formatearHora("2026-10-05T23:00:00.000Z", "America/Bogota")).toContain("06:00");
  });
});

describe("esZonaHorariaValida", () => {
  it("acepta nombres IANA y rechaza lo demás", () => {
    expect(esZonaHorariaValida("America/Bogota")).toBe(true);
    expect(esZonaHorariaValida("Mars/Olympus")).toBe(false);
    expect(esZonaHorariaValida("")).toBe(false);
  });

  it("el default es Bogotá", () => {
    expect(ZONA_HORARIA_DEFAULT).toBe("America/Bogota");
  });
});
