// @vitest-environment node
import { describe, it, expect } from "vitest";
import { formatearPrecio } from "@/lib/moneda";

describe("formatearPrecio", () => {
  it("escribe pesos colombianos con separador de miles", () => {
    expect(formatearPrecio(160000)).toMatch(/160\.000/);
  });

  it("no muestra centavos: acá no se cobran", () => {
    expect(formatearPrecio(160000)).not.toMatch(/,00/);
    expect(formatearPrecio(50000)).not.toMatch(/,00/);
  });

  it("redondea el monto con decimales en vez de arrastrarlos", () => {
    expect(formatearPrecio(7500.5)).not.toMatch(/,5/);
  });

  it("el cero es un monto válido, no un vacío", () => {
    expect(formatearPrecio(0)).toMatch(/0/);
  });

  it("marca la moneda, para que un número suelto no se confunda", () => {
    expect(formatearPrecio(160000)).toMatch(/\$/);
  });
});
