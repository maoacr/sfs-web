// Wire up: cuando se emite un evento de reserva,
// se crea notificación in-app Y se envía email.

import { onReservaEvent } from "./events";
import { crearNotificacion } from "./notifications";
import { notificarPorEmail } from "./email";

let initialized = false;

// ─── Mensajes ──────────────────────────────────────────────────────────────

const mensajes: Record<string, { player: { titulo: string; mensaje: string }; owner: { titulo: string; mensaje: string } }> = {
  RESERVA_CREADA: {
    player: { titulo: "Reserva pendiente de pago", mensaje: "Tu reserva está pendiente. Completá el pago en los próximos 15 minutos." },
    owner:  { titulo: "Nueva reserva", mensaje: "recibiste una nueva reserva pendiente de pago." },
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

// ─── Init ───────────────────────────────────────────────────────────────────

export function initNotificaciones() {
  if (initialized) return;
  initialized = true;

  onReservaEvent(async (event) => {
    const msgs = mensajes[event.tipo];
    if (!msgs) return;

    // In-app: jugador
    await crearNotificacion({
      userId: event.playerId,
      tipo: event.tipo,
      titulo: `${msgs.player.titulo} — ${event.canchaNombre}`,
      mensaje: `${msgs.player.mensaje}`,
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
    await notificarPorEmail(event);
  });
}
