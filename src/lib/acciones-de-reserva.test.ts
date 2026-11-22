// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  sePuedeCobrar,
  sePuedeMarcarJugada,
  sePuedeCancelar,
  seOfreceCerrarAlCobrar,
} from "@/lib/acciones-de-reserva";

const reserva = (estado: string, saldoPendiente = 0) => ({ estado, saldoPendiente });

describe("sePuedeCobrar", () => {
  it("lo habilita el saldo, no el punto del partido en que estemos", () => {
    expect(sePuedeCobrar(reserva("PAGO_PARCIAL", 50000))).toBe(true);
    expect(sePuedeCobrar(reserva("COMPLETADA", 50000))).toBe(true);
    expect(sePuedeCobrar(reserva("CONFIRMADA", 50000))).toBe(true);
  });

  it("sin saldo no hay nada que cobrar", () => {
    expect(sePuedeCobrar(reserva("CONFIRMADA", 0))).toBe(false);
    expect(sePuedeCobrar(reserva("COMPLETADA", 0))).toBe(false);
  });

  it("sobre una reserva muerta no se cobra, aunque figure saldo", () => {
    expect(sePuedeCobrar(reserva("CANCELADA", 50000))).toBe(false);
    expect(sePuedeCobrar(reserva("EXPIRADA", 50000))).toBe(false);
  });
});

describe("sePuedeMarcarJugada", () => {
  it("no mira el saldo: el partido se jugó o no, y eso es otro eje", () => {
    expect(sePuedeMarcarJugada(reserva("PAGO_PARCIAL", 50000))).toBe(true);
    expect(sePuedeMarcarJugada(reserva("CONFIRMADA", 0))).toBe(true);
  });

  it("lo ya jugado no se vuelve a jugar", () => {
    expect(sePuedeMarcarJugada(reserva("COMPLETADA", 0))).toBe(false);
    expect(sePuedeMarcarJugada(reserva("COMPLETADA", 50000))).toBe(false);
  });

  it("lo muerto no se juega", () => {
    expect(sePuedeMarcarJugada(reserva("CANCELADA", 0))).toBe(false);
    expect(sePuedeMarcarJugada(reserva("EXPIRADA", 0))).toBe(false);
  });
});

describe("sePuedeCancelar", () => {
  it("se puede cancelar lo que está vivo", () => {
    expect(sePuedeCancelar(reserva("PENDIENTE_PAGO", 0))).toBe(true);
    expect(sePuedeCancelar(reserva("PAGO_PARCIAL", 50000))).toBe(true);
    expect(sePuedeCancelar(reserva("CONFIRMADA", 0))).toBe(true);
  });

  it("lo muerto no se cancela dos veces", () => {
    expect(sePuedeCancelar(reserva("CANCELADA", 0))).toBe(false);
    expect(sePuedeCancelar(reserva("EXPIRADA", 0))).toBe(false);
  });
});

describe("seOfreceCerrarAlCobrar", () => {
  it("se ofrece cuando hay saldo y el partido todavía no está cerrado", () => {
    expect(seOfreceCerrarAlCobrar(reserva("PAGO_PARCIAL", 50000))).toBe(true);
    expect(seOfreceCerrarAlCobrar(reserva("CONFIRMADA", 50000))).toBe(true);
  });

  it("no se ofrece sobre una COMPLETADA: ya está cerrada", () => {
    expect(seOfreceCerrarAlCobrar(reserva("COMPLETADA", 50000))).toBe(false);
  });

  it("no se ofrece sin saldo: no habría cobro en el que ofrecerlo", () => {
    expect(seOfreceCerrarAlCobrar(reserva("CONFIRMADA", 0))).toBe(false);
  });

  it("no se ofrece sobre lo muerto", () => {
    expect(seOfreceCerrarAlCobrar(reserva("CANCELADA", 50000))).toBe(false);
  });
});
