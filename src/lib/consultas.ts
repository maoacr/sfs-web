import { db, reservas, canchas, complejos, type Reserva } from "@sfs/db";
import { and, eq, gt, inArray, or, sql } from "drizzle-orm";
import {
  ESTADOS_QUE_SIEMPRE_OCUPAN,
  ESTADO_QUE_VENCE,
  limiteExpiracion,
} from "./disponibilidad";

/** La cancha si pertenece al dueño; undefined si no existe o es de otro tenant. */
export function canchaDelDueno(id: string, tenantId: string) {
  return db.query.canchas.findFirst({
    where: and(eq(canchas.id, id), eq(canchas.tenantId, tenantId)),
  });
}

/** El complejo si pertenece al dueño; undefined si no existe o es de otro tenant. */
export function complejoDelDueno(id: string, tenantId: string) {
  return db.query.complejos.findFirst({
    where: and(eq(complejos.id, id), eq(complejos.tenantId, tenantId)),
  });
}

/** Reservas que se concretaron: se pagó al menos el mínimo o ya se jugaron. */
export const ESTADOS_EFECTIVOS: Reserva["estado"][] = ["PAGO_PARCIAL", "CONFIRMADA", "COMPLETADA"];

/**
 * Espejo en SQL de `reservaBloqueaTurno`: qué reservas ocupan realmente un turno.
 *
 * La disponibilidad decide en memoria sobre las filas que ya trajo; la creación
 * de reservas tiene que decidir lo mismo dentro del WHERE. Las dos se arman con
 * las constantes de `disponibilidad.ts`, así que no pueden divergir — y si
 * divergieran, el jugador vería el slot libre y comería un 409 al reservarlo.
 */
export function reservaOcupaElTurno() {
  return or(
    inArray(reservas.estado, [...ESTADOS_QUE_SIEMPRE_OCUPAN] as Reserva["estado"][]),
    and(
      eq(reservas.estado, ESTADO_QUE_VENCE),
      gt(reservas.createdAt, limiteExpiracion(Date.now()))
    )
  );
}

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
