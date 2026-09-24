import { db, reservas, pagos } from "@sfs/db";
import { and, inArray, lt, eq } from "drizzle-orm";
import { notificarCambioReserva } from "./event-listeners";
import { refundPayment, isMercadoPagoConfigured } from "./mercadopago";

const TTL_MINUTOS = 15;

/**
 * Libera reservas en estado PENDIENTE_PAGO o PAGO_PARCIAL que excedieron el TTL.
 * Si hubo pagos vía MP, intenta reembolsarlos.
 * Retorna las reservas que fueron canceladas.
 */
export async function liberarReservasExpiradas() {
  const limite = new Date(Date.now() - TTL_MINUTOS * 60 * 1000);

  const expiradas = await db.query.reservas.findMany({
    where: and(
      inArray(reservas.estado, ["PENDIENTE_PAGO", "PAGO_PARCIAL"]),
      lt(reservas.createdAt, limite)
    ),
    with: {
      cancha: {
        with: {
          complejo: true,
        },
      },
      player: true,
      tenant: true,
      pagos: {
        where: eq(pagos.estadoPago, "APROBADO"),
      },
    },
  });

  if (expiradas.length === 0) return [];

  // ─── Reembolsar pagos MP ─────────────────────────────────────────────
  if (isMercadoPagoConfigured()) {
    for (const r of expiradas) {
      for (const pago of r.pagos) {
        if (pago.mpPaymentId) {
          try {
            await refundPayment(pago.mpPaymentId);
            await db
              .update(pagos)
              .set({ estadoPago: "REEMBOLSADO" })
              .where(eq(pagos.id, pago.id));
          } catch (err) {
            console.error(`[TTL] Error reembolsando pago ${pago.id}:`, err);
          }
        }
      }
    }
  }

  // ─── Cancelar todas las reservas expiradas ───────────────────────────
  const ids = expiradas.map((r) => r.id);
  await db
    .update(reservas)
    .set({ estado: "CANCELADA", saldoPendiente: "0.00" })
    .where(inArray(reservas.id, ids));

  // ─── Notificar a cada jugador y dueño ────────────────────────────────
  for (const r of expiradas) {
    await notificarCambioReserva({
      tipo: "RESERVA_EXPIRADA",
      reservaId: r.id,
      canchaNombre: r.cancha.nombre,
      complejoNombre: r.cancha.complejo.nombre,
      slotInicio: r.slotInicio,
      slotFin: r.slotFin,
      playerId: r.playerId,
      playerNombre: `${r.player.nombre} ${r.player.apellido || ""}`.trim(),
      playerEmail: r.player.email,
      tenantId: r.tenantId,
      tenantEmail: r.tenant.email,
    });
  }

  return expiradas;
}
