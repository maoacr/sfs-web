import type { Pago } from "@sfs/db";

type Metodo = Pago["metodo"];

/**
 * Traduce lo que devuelve MercadoPago a nuestras dimensiones.
 *
 * MP separa `payment_type_id` (el tipo: tarjeta, transferencia, efectivo) de
 * `payment_method_id` (el emisor concreto: visa, efecty, nequi). Ese corte es
 * casi el nuestro: el tipo va a `metodo` y el emisor a `entidad`.
 *
 * La excepción son los `payment_method_id` que nombran un carril y no una
 * institución —`pse`, `account_money`— donde `entidad` queda null en vez de
 * repetir el método con otro nombre.
 */
const POR_TIPO: Record<string, Metodo> = {
  credit_card: "TARJETA_CREDITO",
  debit_card: "TARJETA_DEBITO",
  prepaid_card: "TARJETA_DEBITO",
  bank_transfer: "PSE",
  account_money: "BILLETERA",
  digital_wallet: "BILLETERA",
  // Efecty, Baloto y los cajeros: la plata se entrega en efectivo en un punto.
  ticket: "EFECTIVO",
  atm: "EFECTIVO",
};

/** Cuando MP no manda el tipo, algunos métodos alcanzan para deducirlo. */
const POR_METODO: Record<string, Metodo> = {
  pse: "PSE",
  account_money: "BILLETERA",
  nequi: "BILLETERA",
  daviplata: "BILLETERA",
  efecty: "EFECTIVO",
  baloto: "EFECTIVO",
};

/** Nombran el carril, no a quién emitió: no son entidad. */
const CARRILES = new Set(["pse", "account_money", "credit_card", "debit_card", "bank_transfer"]);

export interface DatosMetodoMp {
  payment_type_id?: string;
  payment_method_id?: string;
}

export function desdeMercadoPago(payment: DatosMetodoMp): { metodo: Metodo; entidad: string | null } {
  const tipo = payment.payment_type_id?.toLowerCase();
  const emisor = payment.payment_method_id?.toLowerCase();

  const metodo = (tipo && POR_TIPO[tipo]) || (emisor && POR_METODO[emisor]) || "OTRO";
  const entidad = emisor && !CARRILES.has(emisor) ? emisor.toUpperCase() : null;

  return { metodo, entidad };
}

/**
 * Lo que se quedó MercadoPago. Va a su propia columna porque sin esto los
 * libros no cuadran contra el extracto: lo facturado no es lo que llega.
 */
export function comisionDe(payment: { fee_details?: { amount?: number }[] }): number {
  return (payment.fee_details ?? []).reduce(
    (total, fee) => total + (typeof fee.amount === "number" ? fee.amount : 0),
    0
  );
}
