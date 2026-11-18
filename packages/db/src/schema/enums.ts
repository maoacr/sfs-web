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

/**
 * CÓMO se movió la plata. Son tipos, no instituciones: Nequi, Daviplata y
 * Bancolombia son todos `TRANSFERENCIA`, y cuál fue se guarda en `entidad`.
 * La lista es corta y estable a propósito — es la que se agrupa en los
 * reportes.
 */
export const metodoPagoEnum = pgEnum("metodo_pago", [
  "EFECTIVO",
  "TRANSFERENCIA",
  "PSE",
  "TARJETA_DEBITO",
  "TARJETA_CREDITO",
  "BILLETERA",
  "OTRO",
]);

/** DÓNDE se originó el pago: por la app o en el mostrador del complejo. */
export const canalPagoEnum = pgEnum("canal_pago", ["APP", "PRESENCIAL"]);

/**
 * `RECHAZADO` es "el banco dijo que no". `EXPIRADO` es "la persona se fue sin
 * pagar". Mezclarlos arruinaría cualquier reporte de ventas perdidas: uno es
 * un problema de medio de pago, el otro de conversión.
 */
export const estadoPagoEnum = pgEnum("estado_pago", [
  "PENDIENTE",
  "APROBADO",
  "RECHAZADO",
  "REEMBOLSADO",
  "EXPIRADO",
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
