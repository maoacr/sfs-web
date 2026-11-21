import { describe, it, expect } from "vitest";
import { admiteLoop } from "./page";

/**
 * Swiper en modo loop clona slides y necesita `slidesPerView * 2 + 1` para
 * llenar el buffer. Con menos reutiliza el mismo nodo en las dos puntas y el
 * carrusel muestra siempre la misma cancha aunque el swipe se mueva.
 */
describe("admiteLoop", () => {
  describe("con una cancha por vista (mobile)", () => {
    it("con dos canchas NO hace loop: era el caso que se rompía", () => {
      expect(admiteLoop(2, 1)).toBe(false);
    });

    it("con una cancha tampoco, que no habría nada que recorrer", () => {
      expect(admiteLoop(1, 1)).toBe(false);
    });

    it("con tres ya alcanza", () => {
      expect(admiteLoop(3, 1)).toBe(true);
    });
  });

  describe("con dos canchas por vista (pantallas anchas)", () => {
    it("tres o cuatro no alcanzan: el buffer de clones pide cinco", () => {
      expect(admiteLoop(3, 2)).toBe(false);
      expect(admiteLoop(4, 2)).toBe(false);
    });

    it("con cinco sí", () => {
      expect(admiteLoop(5, 2)).toBe(true);
    });
  });

  it("sin canchas no hace loop", () => {
    expect(admiteLoop(0, 1)).toBe(false);
  });
});
