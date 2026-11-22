import { describe, it, expect } from "vitest";
import { CONSTRAINT_SIN_DOBLE_BOOKING, esDobleBooking } from "./errores-db";

/** Un error tal como lo tira postgres.js: `code` + `constraint_name`. */
function errorDePostgres(code: string, constraintName?: string) {
  return Object.assign(new Error("error de postgres"), {
    code,
    constraint_name: constraintName,
  });
}

describe("esDobleBooking", () => {
  it("reconoce la violación del constraint que impide vender dos veces el turno", () => {
    expect(esDobleBooking(errorDePostgres("23P01", CONSTRAINT_SIN_DOBLE_BOOKING))).toBe(true);
  });

  it("acepta el nombre en `constraint`, como lo expone node-postgres", () => {
    const error = Object.assign(new Error("error de postgres"), {
      code: "23P01",
      constraint: CONSTRAINT_SIN_DOBLE_BOOKING,
    });

    expect(esDobleBooking(error)).toBe(true);
  });

  it("no confunde otra violación de exclusión con un doble booking", () => {
    expect(esDobleBooking(errorDePostgres("23P01", "otro_constraint_cualquiera"))).toBe(false);
  });

  it("no confunde un unique violation con un doble booking", () => {
    expect(esDobleBooking(errorDePostgres("23505", CONSTRAINT_SIN_DOBLE_BOOKING))).toBe(false);
  });

  it("devuelve false para lo que no es un error de postgres", () => {
    expect(esDobleBooking(new Error("boom"))).toBe(false);
    expect(esDobleBooking(null)).toBe(false);
    expect(esDobleBooking(undefined)).toBe(false);
    expect(esDobleBooking("23P01")).toBe(false);
  });
});
