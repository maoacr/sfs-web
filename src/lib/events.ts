// Domain events — desacopla los cambios de estado de sus efectos secundarios.
// Cuando una reserva cambia de estado, se emite un evento.
// Los listeners (notificaciones, email, logs) reaccionan sin que la API sepa.

export type TipoEvento = "RESERVA_CREADA" | "RESERVA_CONFIRMADA" | "RESERVA_CANCELADA" | "RESERVA_COMPLETADA" | "RESERVA_EXPIRADA";

export interface ReservaEvent {
  tipo: TipoEvento;
  reservaId: string;
  canchaNombre: string;
  complejoNombre: string;
  slotInicio: Date;
  slotFin: Date;
  // Jugador
  playerId: string;
  playerNombre: string;
  playerEmail: string;
  // Owner
  tenantId: string;
  tenantEmail: string;
}

type Listener = (event: ReservaEvent) => void | Promise<void>;

const listeners: Listener[] = [];

export function onReservaEvent(fn: Listener) {
  listeners.push(fn);
}

export async function emitReservaEvent(event: ReservaEvent) {
  await Promise.all(listeners.map(fn => fn(event)));
}
