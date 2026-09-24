import { db, reservas } from "@sfs/db";
import { and, eq, lt } from "drizzle-orm";
import { notificarReserva } from "./event-listeners";

const TTL_MINUTOS = 15;

/**
 * Libera reservas que siguen en PENDIENTE_PAGO después del TTL.
 * Las PAGO_PARCIAL no expiran: ya pagaron el mínimo y el saldo se cobra aparte.
 * Un pago que MP apruebe después de la expiración lo reembolsa el webhook.
 */
export async function liberarReservasExpiradas() {
  const limite = new Date(Date.now() - TTL_MINUTOS * 60 * 1000);

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
