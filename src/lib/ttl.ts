import { db, reservas, pagos } from "@sfs/db";
import { and, eq, gt, isNull, lt, type SQL } from "drizzle-orm";
import { notificarReserva } from "./event-listeners";
import { limiteExpiracion, TTL_PAGO_MINUTOS } from "./disponibilidad";

/**
 * Las reservas que el TTL ya venció: un PENDIENTE_PAGO más viejo que el corte.
 *
 * Vive en una sola función porque la consumen los dos barridos —el global y el
 * acotado a un turno— y un corte distinto en cada uno sería un turno que un
 * camino cree libre y el otro ocupado. El corte sale de `limiteExpiracion`,
 * el mismo que usa la disponibilidad para decidir en memoria.
 */
function pendientesVencidas() {
  return and(
    eq(reservas.estado, "PENDIENTE_PAGO"),
    lt(reservas.createdAt, limiteExpiracion(Date.now()))
  );
}

/**
 * Asienta la expiración de las reservas que matchean `condicion` y notifica.
 *
 * Se marcan CANCELADA y se les borra el saldo: lo que se liberó no se le cobra
 * a nadie. La notificación va por fuera del UPDATE, una por fila, porque es un
 * efecto hacia afuera y no debe decidir si la transacción vive o muere.
 */
async function asentarExpiracion(condicion: SQL | undefined) {
  const expiradas = await db
    .update(reservas)
    .set({ estado: "CANCELADA", saldoPendiente: "0.00" })
    .where(condicion)
    .returning({ id: reservas.id });

  for (const { id } of expiradas) {
    await notificarReserva(id, "RESERVA_EXPIRADA");
  }

  return expiradas;
}

/**
 * Persiste la expiración de TODAS las reservas que quedaron en PENDIENTE_PAGO.
 *
 * Esto es housekeeping: lo corre el cron y lo disparan las rutas sin esperarlo.
 * La disponibilidad ya ignora un PENDIENTE_PAGO vencido (ver
 * `reservaBloqueaTurno`), así que el turno se muestra libre desde el instante
 * en que expira, corra este barrido o no.
 *
 * Lo que NO alcanza a garantizar es que la base esté de acuerdo: para eso está
 * `liberarTurnoVencido`, que se espera antes de insertar.
 *
 * Las PAGO_PARCIAL no expiran: ya pagaron el mínimo y el saldo se cobra aparte.
 * Un pago que MP apruebe después de la expiración lo reembolsa el webhook.
 */
export function liberarReservasExpiradas() {
  return asentarExpiracion(pendientesVencidas());
}

/**
 * Asienta la expiración SÓLO de lo que podría chocar con este turno.
 *
 * Existe por el constraint `reservas_sin_doble_booking`. El predicado de un
 * EXCLUDE tiene que ser inmutable, así que no puede preguntar "¿venció?" —
 * cuenta todo PENDIENTE_PAGO como ocupante. Entonces una fila vencida que
 * nadie asentó todavía bloquea en la base un turno que la app muestra libre, y
 * el insert legítimo se come un 23P01.
 *
 * Esperar el barrido global antes de cada insert sería pagar su costo entero
 * —un UPDATE sobre toda la tabla y una notificación por fila— en el camino
 * crítico de una reserva. Acotado a la cancha y al rango, toca como mucho las
 * dos o tres filas que de verdad compiten por ese turno.
 *
 * El solapamiento es medio-abierto, igual que el chequeo de la app y que el
 * `[)` del constraint: un turno que termina a las 20 no choca con el que
 * arranca a las 20.
 */
export function liberarTurnoVencido({
  canchaId,
  inicio,
  fin,
}: {
  canchaId: string;
  inicio: Date;
  fin: Date;
}) {
  return asentarExpiracion(
    and(
      pendientesVencidas(),
      eq(reservas.canchaId, canchaId),
      lt(reservas.slotInicio, fin),
      gt(reservas.slotFin, inicio)
    )
  );
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
