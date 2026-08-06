import { prisma } from "@sfs/db";
import { notificarCambioReserva } from "./event-listeners";

const TTL_MINUTOS = 15;

/**
 * Libera reservas en estado PENDIENTE_PAGO que excedieron el TTL.
 * Retorna las reservas que fueron canceladas.
 */
export async function liberarReservasExpiradas() {
  const limite = new Date(Date.now() - TTL_MINUTOS * 60 * 1000);

  const expiradas = await prisma.reserva.findMany({
    where: {
      estado: "PENDIENTE_PAGO",
      createdAt: { lt: limite },
    },
    include: {
      cancha: { include: { complejo: true } },
      player: { select: { id: true, primerNombre: true, apellidos: true, email: true } },
      tenant: { select: { id: true, email: true } },
    },
  });

  if (expiradas.length === 0) return [];

  // Cancelar todas en una transacción
  const ids = expiradas.map(r => r.id);
  await prisma.reserva.updateMany({
    where: { id: { in: ids } },
    data: { estado: "CANCELADA" },
  });

  // Notificar a cada jugador y dueño
  for (const r of expiradas) {
    await notificarCambioReserva({
      tipo: "RESERVA_EXPIRADA",
      reservaId: r.id,
      canchaNombre: r.cancha.nombre,
      complejoNombre: r.cancha.complejo.nombre,
      slotInicio: r.slotInicio,
      slotFin: r.slotFin,
      playerId: r.playerId,
      playerNombre: `${r.player.primerNombre} ${r.player.apellidos || ""}`.trim(),
      playerEmail: r.player.email,
      tenantId: r.tenantId,
      tenantEmail: r.tenant.email,
    });
  }

  return expiradas;
}
