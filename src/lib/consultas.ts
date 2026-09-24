import { db, reservas, canchas, complejos, type Reserva } from "@sfs/db";
import { eq, sql } from "drizzle-orm";

/** Reservas que se concretaron: se pagó al menos el mínimo o ya se jugaron. */
export const ESTADOS_EFECTIVOS: Reserva["estado"][] = ["PAGO_PARCIAL", "CONFIRMADA", "COMPLETADA"];

/** La reserva empieza el día `fecha` en la zona horaria de su complejo. */
export function empiezaElDiaLocal(fecha: string) {
  return sql`(${reservas.slotInicio} AT TIME ZONE ${complejos.zonaHoraria})::date = ${fecha}::date`;
}

/** Ids de reservas cuyo día local (zona del complejo) es `fecha`. */
export function reservasDelDiaLocal(fecha: string) {
  return db
    .select({ id: reservas.id })
    .from(reservas)
    .innerJoin(canchas, eq(canchas.id, reservas.canchaId))
    .innerJoin(complejos, eq(complejos.id, canchas.complejoId))
    .where(empiezaElDiaLocal(fecha));
}
