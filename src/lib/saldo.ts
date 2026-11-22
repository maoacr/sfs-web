import { db, reservas } from "@sfs/db";
import { and, eq, inArray, sum } from "drizzle-orm";

/**
 * Saldo que deben varios jugadores, en una sola consulta.
 *
 * Esta función es la ÚNICA definición en SQL de qué cuenta como deuda, y
 * `saldoPendienteDe` se apoya en ella: dos consultas separadas para la misma
 * regla se desincronizan solas, y el día que la regla cambie —otro estado que
 * deba, un vencimiento, lo que sea— hay un solo lugar donde cambiarla.
 *
 * Deliberadamente sin filtro por cancha ni por complejo: la regla de negocio
 * es que deber en una cancha te deja afuera de todas. Deber en el complejo A
 * bloquea reservar en el complejo B.
 *
 * Sólo cuentan las reservas en `PAGO_PARCIAL`: ahí hay plata entregada y un
 * resto pactado. Las `PENDIENTE_PAGO` no deben nada —nunca se cobró— y además
 * expiran solas por TTL.
 *
 * Quien no debe nada NO viene en el Map: la consulta sólo trae a los que
 * tienen filas. Leerlo con `?? 0` es parte del contrato.
 */
export async function saldosPendientesDe(playerIds: string[]): Promise<Map<string, number>> {
  // Un `IN ()` vacío es una consulta cuyo resultado ya conocemos.
  if (playerIds.length === 0) return new Map();

  const filas = await db
    .select({ playerId: reservas.playerId, saldo: sum(reservas.saldoPendiente) })
    .from(reservas)
    .where(and(inArray(reservas.playerId, playerIds), eq(reservas.estado, "PAGO_PARCIAL")))
    .groupBy(reservas.playerId);

  return new Map(filas.map((fila) => [fila.playerId, Number(fila.saldo ?? 0)]));
}

/**
 * Saldo que un jugador debe en TODO el sistema.
 *
 * Es el caso de uno de `saldosPendientesDe`, que es donde vive la regla.
 *
 * Se cancela de dos maneras: el jugador paga el saldo
 * (`POST /api/reservas/:id/pagar-saldo`) o el dueño registra que lo cobró en
 * efectivo, Nequi o transferencia (`POST /api/reservas/:id/confirmar-pago`).
 */
export async function saldoPendienteDe(playerId: string): Promise<number> {
  const saldos = await saldosPendientesDe([playerId]);
  return saldos.get(playerId) ?? 0;
}
