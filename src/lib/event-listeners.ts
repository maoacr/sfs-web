import { crearNotificacion } from "./notifications";
import { notificarPorEmail } from "./email";

// ─── Mensajes ──────────────────────────────────────────────────────────────

const mensajes: Record<string, { player: { titulo: string; mensaje: string }; owner: { titulo: string; mensaje: string } }> = {
  RESERVA_CREADA: {
    player: { titulo: "Reserva pendiente de pago", mensaje: "Tu reserva está pendiente. Completá el pago en los próximos 15 minutos." },
    owner:  { titulo: "", mensaje: "" }, // Owner solo se notifica cuando el pago se confirma
  },
  RESERVA_CONFIRMADA: {
    player: { titulo: "¡Reserva confirmada!", mensaje: "Tu reserva fue confirmada. ¡Buen partido!" },
    owner:  { titulo: "Reserva confirmada", mensaje: "pagó su reserva." },
  },
  RESERVA_CANCELADA: {
    player: { titulo: "Reserva cancelada", mensaje: "Tu reserva fue cancelada." },
    owner:  { titulo: "Reserva cancelada", mensaje: "canceló su reserva." },
  },
  RESERVA_COMPLETADA: {
    player: { titulo: "Partido completado", mensaje: "¿Cómo estuvo tu partido? ¡Reservá de nuevo!" },
    owner:  { titulo: "", mensaje: "" },
  },
  RESERVA_EXPIRADA: {
    player: { titulo: "Reserva expirada", mensaje: "Tu reserva expiró porque no se completó el pago a tiempo." },
    owner:  { titulo: "Reserva expirada", mensaje: "no completó el pago. El slot fue liberado." },
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────

export async function notificarCambioReserva(event: {
  tipo: string;
  reservaId: string;
  canchaNombre: string;
  complejoNombre: string;
  slotInicio: Date;
  slotFin: Date;
  playerId: string;
  playerNombre: string;
  playerEmail: string;
  tenantId: string;
  tenantEmail: string;
}) {
  const msgs = mensajes[event.tipo];
  if (!msgs) return;

  // In-app: jugador
  await crearNotificacion({
    userId: event.playerId,
    tipo: event.tipo,
    titulo: `${msgs.player.titulo} — ${event.canchaNombre}`,
    mensaje: msgs.player.mensaje,
    reservaId: event.reservaId,
  });

  // In-app: dueño
  if (msgs.owner.titulo) {
    await crearNotificacion({
      userId: event.tenantId,
      tipo: event.tipo,
      titulo: `${msgs.owner.titulo} — ${event.canchaNombre}`,
      mensaje: `${event.playerNombre} ${msgs.owner.mensaje}`,
      reservaId: event.reservaId,
    });
  }

  // Email
  await notificarPorEmail(event as any);
}
