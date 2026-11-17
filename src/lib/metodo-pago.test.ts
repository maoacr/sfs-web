import { describe, it, expect } from "vitest";
import { desdeMercadoPago, comisionDe } from "@/lib/metodo-pago";

describe("desdeMercadoPago", () => {
  it("una tarjeta de crédito guarda la marca como entidad", () => {
    expect(desdeMercadoPago({ payment_type_id: "credit_card", payment_method_id: "visa" }))
      .toEqual({ metodo: "TARJETA_CREDITO", entidad: "VISA" });
  });

  it("distingue débito de crédito", () => {
    expect(desdeMercadoPago({ payment_type_id: "debit_card", payment_method_id: "debmaster" }).metodo)
      .toBe("TARJETA_DEBITO");
  });

  it("PSE es un carril, no una institución: entidad queda null", () => {
    expect(desdeMercadoPago({ payment_type_id: "bank_transfer", payment_method_id: "pse" }))
      .toEqual({ metodo: "PSE", entidad: null });
  });

  it("el saldo de MercadoPago es billetera, sin entidad", () => {
    expect(desdeMercadoPago({ payment_type_id: "account_money", payment_method_id: "account_money" }))
      .toEqual({ metodo: "BILLETERA", entidad: null });
  });

  it("una billetera con nombre sí guarda la entidad", () => {
    expect(desdeMercadoPago({ payment_type_id: "digital_wallet", payment_method_id: "nequi" }))
      .toEqual({ metodo: "BILLETERA", entidad: "NEQUI" });
  });

  it("los puntos de pago en efectivo cuentan como efectivo", () => {
    expect(desdeMercadoPago({ payment_type_id: "ticket", payment_method_id: "efecty" }))
      .toEqual({ metodo: "EFECTIVO", entidad: "EFECTY" });
  });

  it("un tipo que no conocemos cae en OTRO sin inventar entidad", () => {
    expect(desdeMercadoPago({ payment_type_id: "crypto_transfer", payment_method_id: "bitcoin" }))
      .toEqual({ metodo: "OTRO", entidad: "BITCOIN" });
  });

  it("sin datos de MP no se inventa nada", () => {
    expect(desdeMercadoPago({})).toEqual({ metodo: "OTRO", entidad: null });
  });

  it("deduce el tipo desde el método cuando MP no manda payment_type_id", () => {
    expect(desdeMercadoPago({ payment_method_id: "pse" }).metodo).toBe("PSE");
  });
});

describe("comisionDe", () => {
  it("suma lo que se quedó MercadoPago", () => {
    expect(comisionDe({ fee_details: [{ amount: 6240.5 }, { amount: 100 }] })).toBe(6340.5);
  });

  it("sin fee_details la comisión es cero, no null", () => {
    expect(comisionDe({})).toBe(0);
  });

  it("ignora montos que no son números", () => {
    expect(comisionDe({ fee_details: [{ amount: 500 }, {}] })).toBe(500);
  });
});
