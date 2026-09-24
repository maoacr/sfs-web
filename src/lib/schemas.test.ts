import { describe, it, expect } from "vitest";
import {
  loginSchema,
  registerSchema,
  createCanchaSchema,
  createComplejoSchema,
  createReservaSchema,
  createSlotSchema,
  createTarifaSchema,
} from "@/lib/schemas";

describe("Auth Schemas", () => {
  it("loginSchema valida email y password requeridos", () => {
    const result = loginSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("loginSchema acepta credenciales válidas", () => {
    const result = loginSchema.safeParse({
      email: "test@test.com",
      password: "test1234",
    });
    expect(result.success).toBe(true);
  });

  it("registerSchema rechaza password corto", () => {
    const result = registerSchema.safeParse({
      email: "test@test.com",
      password: "123",
      primerNombre: "Carlos",
      apellidos: "Gómez",
      role: "PLAYER",
    });
    expect(result.success).toBe(false);
  });

  it("registerSchema acepta datos válidos", () => {
    const result = registerSchema.safeParse({
      email: "carlos@test.com",
      password: "test1234",
      primerNombre: "Carlos",
      apellidos: "Gómez Pérez",
      apodo: "carlitosg",
      role: "PLAYER",
    });
    expect(result.success).toBe(true);
  });
});

describe("Cancha Schemas", () => {
  it("createCanchaSchema rechaza tipo inválido", () => {
    const result = createCanchaSchema.safeParse({
      nombre: "Cancha 1",
      tipo: "F99",
      capacidad: 10,
      complejoId: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(result.success).toBe(false);
  });

  it("createCanchaSchema acepta datos válidos", () => {
    const result = createCanchaSchema.safeParse({
      nombre: "Fútbol 7 Techada",
      tipo: "F7",
      capacidad: 14,
      complejoId: "123e4567-e89b-12d3-a456-426614174000",
      servicios: ["vestidores", "cafeteria"],
      duracionSlotMinutos: 90,
    });
    expect(result.success).toBe(true);
  });
});

describe("Complejo Schemas", () => {
  it("createComplejoSchema acepta datos mínimos", () => {
    const result = createComplejoSchema.safeParse({
      nombre: "El Campito",
    });
    expect(result.success).toBe(true);
  });

  it("createComplejoSchema rechaza lat/lng fuera de rango", () => {
    const result = createComplejoSchema.safeParse({
      nombre: "El Campito",
      lat: 100,
      lng: 200,
    });
    expect(result.success).toBe(false);
  });
});

describe("Reserva Schemas", () => {
  it("createReservaSchema rechaza fecha y hora mal formadas", () => {
    const result = createReservaSchema.safeParse({
      canchaId: "123e4567-e89b-12d3-a456-426614174000",
      fecha: "10/08/2026",
      hora: "6pm",
    });
    expect(result.success).toBe(false);
  });

  it("createReservaSchema acepta fecha y hora locales de la cancha", () => {
    const result = createReservaSchema.safeParse({
      canchaId: "123e4567-e89b-12d3-a456-426614174000",
      fecha: "2026-08-10",
      hora: "18:00",
    });
    expect(result.success).toBe(true);
  });

  it("createReservaSchema ya no acepta instantes calculados por el cliente", () => {
    const result = createReservaSchema.safeParse({
      canchaId: "123e4567-e89b-12d3-a456-426614174000",
      slotInicio: "2026-08-10T18:00:00Z",
      slotFin: "2026-08-10T19:00:00Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("Slot Schemas", () => {
  it("createSlotSchema rechaza día inválido", () => {
    const result = createSlotSchema.safeParse({
      diaSemana: 7,
      horaApertura: "08:00",
      horaCierre: "23:00",
    });
    expect(result.success).toBe(false);
  });

  it("createSlotSchema acepta slot válido", () => {
    const result = createSlotSchema.safeParse({
      diaSemana: 1,
      horaApertura: "08:00",
      horaCierre: "23:00",
    });
    expect(result.success).toBe(true);
  });
});

describe("Tarifa Schemas", () => {
  it("createTarifaSchema rechaza precio negativo", () => {
    const result = createTarifaSchema.safeParse({
      precioBase: -1000,
    });
    expect(result.success).toBe(false);
  });

  it("createTarifaSchema acepta tarifa válida", () => {
    const result = createTarifaSchema.safeParse({
      precioBase: 15000,
      factor: 1.5,
    });
    expect(result.success).toBe(true);
  });
});
