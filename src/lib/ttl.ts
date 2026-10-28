import { db, reservas } from "@sfs/db";
import { and, eq, lt } from "drizzle-orm";
import { notificarReserva } from "./event-listeners";
import { TTL_RESERVA_MINUTOS } from "./disponibilidad";

/**
 * Persiste la expiración de las reservas que quedaron en PENDIENTE_PAGO.
 *
 * Esto es housekeeping, no correctitud: la disponibilidad ya ignora un
 * PENDIENTE_PAGO vencido (ver `reservaBloqueaTurno`), así que el turno está
 * libre desde el instante en que expira, corra este job o no. Acá sólo se
 * asienta el estado CANCELADA y se dispara la notificación.
 *
 * Las PAGO_PARCIAL no expiran: ya pagaron el mínimo y el saldo se cobra aparte.
 * Un pago que MP apruebe después de la expiración lo reembolsa el webhook.
 */
export async function liberarReservasExpiradas() {
  const limite = new Date(Date.now() - TTL_RESERVA_MINUTOS * 60 * 1000);

  const expiradas = await db
    .update(reservas)
    .set({ estado: "CANCELADA", saldoPendiente: "0.00" })
    .where(and(eq(reservas.estado, "PENDIENTE_PAGO"), lt(reservas.createdAt, limite)))
    .returning({ id: reservas.id });

  for (const { id } of expiradas) {
    await notificarReserva(id, "RESERVA_EXPIRADA");
  }

  return expiradas;
}
