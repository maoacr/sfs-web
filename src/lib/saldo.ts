import { db, reservas } from "@sfs/db";
import { and, eq, sum } from "drizzle-orm";

/**
 * Saldo que un jugador debe en TODO el sistema.
 *
 * Deliberadamente sin filtro por cancha ni por complejo: la regla de negocio
 * es que deber en una cancha te deja afuera de todas. Deber en el complejo A
 * bloquea reservar en el complejo B.
 *
 * Sólo cuentan las reservas en `PAGO_PARCIAL`: ahí hay plata entregada y un
 * resto pactado. Las `PENDIENTE_PAGO` no deben nada —nunca se cobró— y además
 * expiran solas por TTL.
 *
 * Se cancela de dos maneras: el jugador paga el saldo
 * (`POST /api/reservas/:id/pagar-saldo`) o el dueño registra que lo cobró en
 * efectivo, Nequi o transferencia (`POST /api/reservas/:id/confirmar-pago`).
 */
export async function saldoPendienteDe(playerId: string): Promise<number> {
  const [fila] = await db
    .select({ saldo: sum(reservas.saldoPendiente) })
    .from(reservas)
    .where(and(eq(reservas.playerId, playerId), eq(reservas.estado, "PAGO_PARCIAL")));

  return Number(fila?.saldo ?? 0);
}
