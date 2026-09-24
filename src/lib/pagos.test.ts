import { describe, it, expect } from "vitest";
import { aplicarPago } from "@/lib/pagos";

describe("aplicarPago", () => {
  it("un pago parcial deja la reserva en PAGO_PARCIAL con saldo", () => {
    expect(aplicarPago({ montoTotal: 100000, montoPagado: 0, monto: 60000 })).toEqual({
      montoPagado: 60000,
      saldoPendiente: 40000,
      estado: "PAGO_PARCIAL",
    });
  });

  it("completar el total confirma la reserva y deja saldo 0", () => {
    expect(aplicarPago({ montoTotal: 100000, montoPagado: 60000, monto: 40000 })).toEqual({
      montoPagado: 100000,
      saldoPendiente: 0,
      estado: "CONFIRMADA",
    });
  });

  it("un sobrepago confirma sin saldo negativo", () => {
    expect(aplicarPago({ montoTotal: 100000, montoPagado: 60000, monto: 50000 })).toEqual({
      montoPagado: 110000,
      saldoPendiente: 0,
      estado: "CONFIRMADA",
    });
  });
});
