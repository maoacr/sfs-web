import type { Pago } from "@sfs/db";

/**
 * Lo que de verdad pasa en un mostrador.
 *
 * El enum de la base tiene más valores —PSE, BILLETERA— porque guarda también
 * lo que reporta MercadoPago, donde esa distinción existe y sirve (ver
 * `metodo-pago.ts`, que traduce su payload). Pero acá nadie te paga "por PSE":
 * te transfiere, y el carril lo elige la persona en su banco. Ofrecer PSE y
 * Billetera al lado de Transferencia es pedirle al dueño que clasifique algo
 * que desde su lado es un solo hecho: entró plata a la cuenta.
 *
 * Nequi, Daviplata y Bancolombia son todos TRANSFERENCIA y se distinguen por
 * `entidad`.
 *
 * Vive acá y no dentro de un componente porque lo consumen dos formularios —el
 * cobro del mostrador y la reserva manual—. Con una lista por pantalla, el día
 * que se agregue un método el dueño tendría dos realidades según dónde esté
 * parado.
 */
export const METODOS_DE_MOSTRADOR = [
  { valor: "EFECTIVO", label: "Efectivo" },
  { valor: "TRANSFERENCIA", label: "Transferencia o billetera" },
  { valor: "TARJETA_DEBITO", label: "Tarjeta débito" },
  { valor: "TARJETA_CREDITO", label: "Tarjeta crédito" },
  { valor: "OTRO", label: "Otro" },
] as const satisfies readonly { valor: Pago["metodo"]; label: string }[];

/** El efectivo es el único sin institución detrás. */
export function requiereEntidad(metodo: string): boolean {
  return metodo !== "EFECTIVO";
}
