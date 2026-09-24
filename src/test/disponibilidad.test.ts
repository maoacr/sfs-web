import { describe, it, expect } from "vitest";
import {
  calcularSlotsDisponibles,
  haySolapamiento,
  parseHoraToMinutes,
  formatMinutesToHora,
  calcularPrecioSlot,
  turnoDentroDeHorario,
} from "../lib/disponibilidad";

describe("Motor de Disponibilidad y Slots (Fase 2)", () => {
  describe("Utilidades de Tiempo y Parsing", () => {
    it("convierte strings HH:MM y HH:MM:SS a minutos", () => {
      expect(parseHoraToMinutes("07:00")).toBe(420);
      expect(parseHoraToMinutes("23:00:00")).toBe(1380);
      expect(parseHoraToMinutes("00:30")).toBe(30);
    });

    it("formatea minutos a HH:MM", () => {
      expect(formatMinutesToHora(420)).toBe("07:00");
      expect(formatMinutesToHora(1380)).toBe("23:00");
      expect(formatMinutesToHora(75)).toBe("01:15");
    });
  });

  describe("Detección de Solapamiento", () => {
    it("detecta solapamiento exacto y parcial correctamente", () => {
      const t10 = new Date("2026-10-01T10:00:00Z").getTime();
      const t11 = new Date("2026-10-01T11:00:00Z").getTime();
      const t12 = new Date("2026-10-01T12:00:00Z").getTime();
      const t10_30 = new Date("2026-10-01T10:30:00Z").getTime();
      const t11_30 = new Date("2026-10-01T11:30:00Z").getTime();

      // Solapamiento idéntico (10-11 y 10-11)
      expect(haySolapamiento(t10, t11, t10, t11)).toBe(true);

      // Solapamiento parcial (10-11 y 10:30-11:30)
      expect(haySolapamiento(t10, t11, t10_30, t11_30)).toBe(true);

      // Turnos contiguos NO se solapan (10-11 y 11-12)
      expect(haySolapamiento(t10, t11, t11, t12)).toBe(false);

      // Turnos completamente separados (10-11 y 12-...)
      expect(haySolapamiento(t10, t11, t12, t12 + 3600000)).toBe(false);
    });
  });

  describe("Cálculo de Tarifas y Horas Pico", () => {
    it("aplica tarifa base y factor de hora pico", () => {
      const tarifas = [
        {
          id: "tarifa-base",
          precioBase: "100000",
          factor: "1.00",
        },
        {
          id: "tarifa-pico",
          precioBase: "100000",
          horaInicio: "18:00",
          horaFin: "23:00",
          factor: "1.40", // +40%
        },
      ];

      // A las 10:00 (minuto 600) -> Tarifa base
      const precioManana = calcularPrecioSlot(1, 600, tarifas);
      expect(precioManana.precio).toBe(100000);

      // A las 19:00 (minuto 1140) -> Tarifa pico (+40%)
      const precioPico = calcularPrecioSlot(1, 1140, tarifas);
      expect(precioPico.precio).toBe(140000);
      expect(precioPico.tarifaId).toBe("tarifa-pico");
    });
  });

  describe("turnoDentroDeHorario", () => {
    const slotConfig = { diaSemana: 1, horaApertura: "07:00:00", horaCierre: "23:00:00" };

    it("acepta turnos que empiezan y terminan dentro del horario", () => {
      expect(turnoDentroDeHorario({ slotConfig, hora: "07:00", duracionMinutos: 60 })).toBe(true);
      expect(turnoDentroDeHorario({ slotConfig, hora: "22:00", duracionMinutos: 60 })).toBe(true);
    });

    it("rechaza turnos antes de abrir o que terminan después de cerrar", () => {
      expect(turnoDentroDeHorario({ slotConfig, hora: "03:00", duracionMinutos: 60 })).toBe(false);
      expect(turnoDentroDeHorario({ slotConfig, hora: "22:30", duracionMinutos: 60 })).toBe(false);
    });

    it("rechaza cuando la cancha no abre ese día", () => {
      expect(turnoDentroDeHorario({ slotConfig: undefined, hora: "10:00", duracionMinutos: 60 })).toBe(false);
    });
  });

  describe("Generación de Slots de Jornada Completa", () => {
    const slotConfig = {
      diaSemana: 1, // Lunes
      horaApertura: "07:00",
      horaCierre: "23:00",
    };

    it("genera exactamente 16 slots de 60 minutos entre 07:00 y 23:00", () => {
      const slots = calcularSlotsDisponibles({
        fechaIso: "2026-10-05", // Lunes futuro
        slotConfig,
        duracionSlotMinutos: 60,
        reservas: [],
        tarifas: [{ id: "t1", precioBase: 100000, factor: 1 }],
        nowTimestamp: new Date("2026-10-01T00:00:00Z").getTime(),
        zonaHoraria: "America/Bogota",
      });

      expect(slots.length).toBe(16);
      expect(slots[0].horaInicio).toBe("07:00");
      expect(slots[0].horaFin).toBe("08:00");
      expect(slots[slots.length - 1].horaInicio).toBe("22:00");
      expect(slots[slots.length - 1].horaFin).toBe("23:00");
      expect(slots.every((s) => s.disponible)).toBe(true);
    });

    it("genera los instantes en la zona horaria de la cancha", () => {
      const slots = calcularSlotsDisponibles({
        fechaIso: "2026-10-05",
        slotConfig,
        duracionSlotMinutos: 60,
        reservas: [],
        tarifas: [{ id: "t1", precioBase: 100000, factor: 1 }],
        nowTimestamp: new Date("2026-10-01T00:00:00Z").getTime(),
        zonaHoraria: "America/Bogota",
      });

      expect(slots[0].inicio).toBe("2026-10-05T12:00:00.000Z"); // 07:00 Bogotá
      expect(slots[slots.length - 1].fin).toBe("2026-10-06T04:00:00.000Z"); // 23:00 Bogotá
    });

    it("bloquea el slot correspondiente cuando existe una reserva confirmada", () => {
      const reservas = [
        {
          id: "res-1",
          slotInicio: "2026-10-05T15:00:00.000Z",
          slotFin: "2026-10-05T16:00:00.000Z",
          estado: "CONFIRMADA",
          player: { nombre: "Carlos", apellido: "Valderrama", apodo: "Pibe" },
        },
      ];

      const slots = calcularSlotsDisponibles({
        fechaIso: "2026-10-05",
        slotConfig,
        duracionSlotMinutos: 60,
        reservas,
        tarifas: [{ id: "t1", precioBase: 100000, factor: 1 }],
        nowTimestamp: new Date("2026-10-01T00:00:00Z").getTime(),
        zonaHoraria: "America/Bogota",
      });

      const slot10 = slots.find((s) => s.horaInicio === "10:00");
      const slot11 = slots.find((s) => s.horaInicio === "11:00");

      expect(slot10?.disponible).toBe(false);
      expect(slot10?.reserva?.id).toBe("res-1");
      expect(slot10?.reserva?.player).toBe("Carlos Valderrama");

      expect(slot11?.disponible).toBe(true);
    });

    it("bloquea múltiples slots si una reserva tiene duración extendida (solapamiento parcial)", () => {
      const reservas = [
        {
          id: "res-partido-largo",
          slotInicio: "2026-10-05T19:00:00.000Z",
          slotFin: "2026-10-05T20:30:00.000Z", // 90 minutos
          estado: "CONFIRMADA",
        },
      ];

      const slots = calcularSlotsDisponibles({
        fechaIso: "2026-10-05",
        slotConfig,
        duracionSlotMinutos: 60,
        reservas,
        tarifas: [{ id: "t1", precioBase: 100000, factor: 1 }],
        nowTimestamp: new Date("2026-10-01T00:00:00Z").getTime(),
        zonaHoraria: "America/Bogota",
      });

      const slot14 = slots.find((s) => s.horaInicio === "14:00");
      const slot15 = slots.find((s) => s.horaInicio === "15:00");
      const slot16 = slots.find((s) => s.horaInicio === "16:00");

      expect(slot14?.disponible).toBe(false);
      expect(slot15?.disponible).toBe(false); // Solapado con los 30 min extra
      expect(slot16?.disponible).toBe(true);
    });

    it("marca como no disponibles los slots pasados para el día actual", () => {
      // Son las 11:30 en Bogotá (16:30 UTC)
      const nowTimestamp = new Date("2026-10-05T16:30:00.000Z").getTime();

      const slots = calcularSlotsDisponibles({
        fechaIso: "2026-10-05",
        slotConfig,
        duracionSlotMinutos: 60,
        reservas: [],
        tarifas: [{ id: "t1", precioBase: 100000, factor: 1 }],
        nowTimestamp,
        zonaHoraria: "America/Bogota",
      });

      const slot07 = slots.find((s) => s.horaInicio === "07:00");
      const slot11 = slots.find((s) => s.horaInicio === "11:00");
      const slot12 = slots.find((s) => s.horaInicio === "12:00");

      expect(slot07?.disponible).toBe(false); // Ya pasó
      expect(slot11?.disponible).toBe(false); // Empezó a las 11:00 y son 11:30
      expect(slot12?.disponible).toBe(true);  // Futuro
    });
  });
});
