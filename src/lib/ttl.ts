import { db, reservas, pagos } from "@sfs/db";
import { and, eq, isNull, lt } from "drizzle-orm";
import { notificarReserva } from "./event-listeners";
import { TTL_PAGO_MINUTOS, TTL_RESERVA_MINUTOS } from "./disponibilidad";

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

/**
 * Cierra los intentos de pago que quedaron colgados.
 *
 * Cada clic en "pagar" crea una fila en `pagos` ANTES de ir a MercadoPago,
 * porque su id viaja como `external_reference` y es lo que después permite
 * encontrar el pago cuando vuelve el webhook. Si la persona no completa el
 * checkout, esa fila queda PENDIENTE para siempre y ensucia la tabla del
 * dinero: tres clics dejan tres filas y dos son basura.
 *
 * El `isNull(mpPaymentId)` es el resguardo que hace esto seguro. Un pago que
 * MercadoPago ya reconoció puede estar legítimamente demorado —`offline_process`,
 * `pending_review_manual` tarda hasta dos días hábiles— y expirarlo acá sería
 * darlo por muerto justo antes de que MP lo apruebe. Sin `mp_payment_id`, en
 * cambio, MP nunca supo que ese intento existió: no hay nada que esperar.
 *
 * Se marcan EXPIRADO y no RECHAZADO porque el banco nunca dijo que no. La
 * diferencia importa en los reportes: uno es un problema de medio de pago, el
 * otro de conversión.
 */
export async function expirarPagosAbandonados() {
  const limite = new Date(Date.now() - TTL_PAGO_MINUTOS * 60 * 1000);

  return db
    .update(pagos)
    .set({ estadoPago: "EXPIRADO", detalleEstado: "abandonado_sin_completar" })
    .where(
      and(
        eq(pagos.estadoPago, "PENDIENTE"),
        isNull(pagos.mpPaymentId),
        lt(pagos.createdAt, limite)
      )
    )
    .returning({ id: pagos.id });
}
