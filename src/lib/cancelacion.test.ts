import { describe, it, expect } from "vitest";
import { porcentajeReembolso } from "@/lib/cancelacion";

describe("porcentajeReembolso", () => {
  const politica = { plazoHoras: 24, penalizacion: 30 };

  it("el dueño siempre reembolsa 100%", () => {
    expect(porcentajeReembolso({ ...politica, esDueno: true, horasHastaReserva: 1 })).toBe(100);
  });

  it("el jugador que cancela antes del plazo recibe 100%", () => {
    expect(porcentajeReembolso({ ...politica, esDueno: false, horasHastaReserva: 48 })).toBe(100);
  });

  it("el jugador que cancela dentro del plazo paga la penalización", () => {
    expect(porcentajeReembolso({ ...politica, esDueno: false, horasHastaReserva: 5 })).toBe(70);
  });

  it("sin penalización configurada reembolsa 100% aunque esté dentro del plazo", () => {
    expect(
      porcentajeReembolso({ plazoHoras: 24, penalizacion: 0, esDueno: false, horasHastaReserva: 5 })
    ).toBe(100);
  });
});
