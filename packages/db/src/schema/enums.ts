import { pgEnum } from "drizzle-orm/pg-core";

export const rolUsuarioEnum = pgEnum("rol_usuario", ["OWNER", "PLAYER", "ADMIN"]);

export const tipoCanchaEnum = pgEnum("tipo_cancha", [
  "FUTBOL_5",
  "FUTBOL_6",
  "FUTBOL_7",
  "FUTBOL_8",
  "FUTBOL_9",
  "FUTBOL_11",
]);

export const estadoReservaEnum = pgEnum("estado_reserva", [
  "PENDIENTE_PAGO",
  "PAGO_PARCIAL",
  "CONFIRMADA",
  "CANCELADA",
  "EXPIRADA",
  "COMPLETADA",
]);

export const estadoPagoEnum = pgEnum("estado_pago", [
  "PENDIENTE",
  "APROBADO",
  "RECHAZADO",
  "REEMBOLSADO",
]);

export const tipoDescuentoEnum = pgEnum("tipo_descuento", [
  "PORCENTAJE",
  "MONTO_FIJO",
]);

export const tipoNotificacionEnum = pgEnum("tipo_notificacion", [
  "RESERVA_CREADA",
  "RESERVA_CONFIRMADA",
  "RESERVA_CANCELADA",
  "RESERVA_EXPIRADA",
  "RESERVA_COMPLETADA",
  "PAGO_PARCIAL_RECIBIDO",
  "INVITACION_EQUIPO",
  "INVITACION_PARTIDO",
]);
