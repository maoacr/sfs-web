// @vitest-environment node
import { describe, it, expect } from "vitest";
import { inicialesDe, nombreCompleto } from "@/lib/db-mappers";

describe("inicialesDe", () => {
  it("toma la inicial del nombre y la del apellido", () => {
    expect(inicialesDe({ nombre: "Mario", apellido: "Crespo" })).toBe("MC");
  });

  it("usa sólo la primera palabra de cada parte en nombres compuestos", () => {
    expect(inicialesDe({ nombre: "Mario Alejandro", apellido: "Crespo Reyes" })).toBe("MC");
  });

  it("pasa a mayúsculas lo que venga en minúsculas", () => {
    expect(inicialesDe({ nombre: "mario", apellido: "crespo" })).toBe("MC");
  });

  it("devuelve una sola inicial si no hay apellido", () => {
    expect(inicialesDe({ nombre: "Mario", apellido: "" })).toBe("M");
  });

  it("ignora los espacios de sobra en vez de tomarlos como inicial", () => {
    expect(inicialesDe({ nombre: "  Mario", apellido: "  Crespo" })).toBe("MC");
  });

  it("cae en ? cuando no hay nombre ni apellido: el avatar siempre muestra algo", () => {
    expect(inicialesDe({ nombre: "", apellido: "" })).toBe("?");
  });
});

describe("nombreCompleto", () => {
  it("une nombre y apellido", () => {
    expect(nombreCompleto({ nombre: "Mario Alejandro", apellido: "Crespo" })).toBe(
      "Mario Alejandro Crespo"
    );
  });

  it("no deja espacio colgando cuando falta el apellido", () => {
    expect(nombreCompleto({ nombre: "Mario", apellido: "" })).toBe("Mario");
  });
});
