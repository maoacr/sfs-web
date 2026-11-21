import { db, reservas } from "@sfs/db";
import { eq } from "drizzle-orm";
import { crearNotificacion } from "./notifications";
import { notificarPorEmail } from "./email";
import { nombreCompleto } from "./db-mappers";

export type EventoReserva =
  | "RESERVA_CREADA"
  | "RESERVA_CONFIRMADA"
  | "RESERVA_CANCELADA"
  | "RESERVA_COMPLETADA"
  | "RESERVA_EXPIRADA"
  | "PAGO_PARCIAL_RECIBIDO";

// ─── Mensajes ──────────────────────────────────────────────────────────────

const mensajes: Record<EventoReserva, { player: { titulo: string; mensaje: string }; owner: { titulo: string; mensaje: string } }> = {
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
  PAGO_PARCIAL_RECIBIDO: {
    player: { titulo: "Pago parcial recibido", mensaje: "Tu pago parcial fue recibido. Completá el saldo pendiente para confirmar." },
    owner:  { titulo: "Pago parcial recibido", mensaje: "pagó parcialmente su reserva. Queda saldo pendiente." },
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────

export async function notificarReserva(reservaId: string, tipo: EventoReserva) {
  const reserva = await db.query.reservas.findFirst({
    where: eq(reservas.id, reservaId),
    with: {
      cancha: {
        columns: { nombre: true },
        with: { complejo: { columns: { nombre: true, zonaHoraria: true } } },
      },
      player: { columns: { nombre: true, apellido: true, email: true } },
      tenant: { columns: { email: true } },
    },
  });
  if (!reserva) return;

  await notificarCambioReserva({
    tipo,
    reservaId: reserva.id,
    canchaNombre: reserva.cancha.nombre,
    complejoNombre: reserva.cancha.complejo.nombre,
    slotInicio: reserva.slotInicio,
    slotFin: reserva.slotFin,
    zonaHoraria: reserva.cancha.complejo.zonaHoraria,
    playerId: reserva.playerId,
    playerNombre: nombreCompleto(reserva.player),
    playerEmail: reserva.player.email,
    tenantId: reserva.tenantId,
    tenantEmail: reserva.tenant.email,
  });
}

export async function notificarCambioReserva(event: {
  tipo: EventoReserva;
  reservaId: string;
  canchaNombre: string;
  complejoNombre: string;
  slotInicio: Date;
  slotFin: Date;
  zonaHoraria: string;
  playerId: string;
  playerNombre: string;
  playerEmail: string;
  tenantId: string;
  tenantEmail: string;
}) {
  const msgs = mensajes[event.tipo];

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
  await notificarPorEmail(event);
}
