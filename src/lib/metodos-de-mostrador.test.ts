import { describe, it, expect } from "vitest";
import { METODOS_DE_MOSTRADOR, requiereEntidad } from "./metodos-de-mostrador";

describe("Vocabulario compartido del mostrador", () => {
  // Lo usan el formulario de cobro y el de reserva manual. Si cada uno
  // definiera su propia lista, agregar un método en uno dejaría al otro sin
  // poder registrarlo y el dueño tendría dos realidades según la pantalla.

  it("ofrece cinco opciones, no las siete del enum", () => {
    expect(METODOS_DE_MOSTRADOR.map(m => m.valor)).toEqual([
      "EFECTIVO",
      "TRANSFERENCIA",
      "TARJETA_DEBITO",
      "TARJETA_CREDITO",
      "OTRO",
    ]);
  });

  it("no ofrece PSE ni BILLETERA: desde el mostrador son el mismo hecho", () => {
    const valores = METODOS_DE_MOSTRADOR.map(m => m.valor) as string[];
    expect(valores).not.toContain("PSE");
    expect(valores).not.toContain("BILLETERA");
  });

  it("toda opción tiene una etiqueta para mostrar", () => {
    for (const metodo of METODOS_DE_MOSTRADOR) {
      expect(metodo.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("el efectivo es el único que no pide entidad: no hay institución detrás", () => {
    expect(requiereEntidad("EFECTIVO")).toBe(false);

    for (const metodo of METODOS_DE_MOSTRADOR.filter(m => m.valor !== "EFECTIVO")) {
      expect(requiereEntidad(metodo.valor)).toBe(true);
    }
  });
});
