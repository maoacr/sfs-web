import { relations } from "drizzle-orm";
import { usuarios } from "./users";
import { complejos, imagenesComplejos } from "./complejos";
import { canchas, imagenesCanchas } from "./canchas";
import { slotConfigs } from "./slot-configs";
import { tarifas } from "./tarifas";
import { reservas } from "./reservas";
import { pagos } from "./pagos";
import { promociones } from "./promociones";
import { notificaciones } from "./notificaciones";
import { equipos, equipoMiembros, partidos, partidoJugadores } from "./partidos";

export const usuariosRelations = relations(usuarios, ({ many }) => ({
  complejos: many(complejos),
  canchas: many(canchas),
  reservasComoPlayer: many(reservas, { relationName: "playerReservas" }),
  reservasComoTenant: many(reservas, { relationName: "tenantReservas" }),
  pagos: many(pagos),
  notificaciones: many(notificaciones),
  equiposCreados: many(equipos),
  equiposMiembro: many(equipoMiembros),
  partidosCreados: many(partidos),
  partidosJugados: many(partidoJugadores),
}));

export const complejosRelations = relations(complejos, ({ one, many }) => ({
  owner: one(usuarios, {
    fields: [complejos.tenantId],
    references: [usuarios.id],
  }),
  imagenes: many(imagenesComplejos),
  canchas: many(canchas),
}));

export const imagenesComplejosRelations = relations(imagenesComplejos, ({ one }) => ({
  complejo: one(complejos, {
    fields: [imagenesComplejos.complejoId],
    references: [complejos.id],
  }),
}));

export const canchasRelations = relations(canchas, ({ one, many }) => ({
  owner: one(usuarios, {
    fields: [canchas.tenantId],
    references: [usuarios.id],
  }),
  complejo: one(complejos, {
    fields: [canchas.complejoId],
    references: [complejos.id],
  }),
  imagenes: many(imagenesCanchas),
  slots: many(slotConfigs),
  tarifas: many(tarifas),
  reservas: many(reservas),
}));

export const imagenesCanchasRelations = relations(imagenesCanchas, ({ one }) => ({
  cancha: one(canchas, {
    fields: [imagenesCanchas.canchaId],
    references: [canchas.id],
  }),
}));

export const slotConfigsRelations = relations(slotConfigs, ({ one }) => ({
  cancha: one(canchas, {
    fields: [slotConfigs.canchaId],
    references: [canchas.id],
  }),
}));

export const tarifasRelations = relations(tarifas, ({ one, many }) => ({
  cancha: one(canchas, {
    fields: [tarifas.canchaId],
    references: [canchas.id],
  }),
  promociones: many(promociones),
}));

export const promocionesRelations = relations(promociones, ({ one }) => ({
  tarifa: one(tarifas, {
    fields: [promociones.tarifaId],
    references: [tarifas.id],
  }),
}));

export const reservasRelations = relations(reservas, ({ one, many }) => ({
  tenant: one(usuarios, {
    fields: [reservas.tenantId],
    references: [usuarios.id],
    relationName: "tenantReservas",
  }),
  player: one(usuarios, {
    fields: [reservas.playerId],
    references: [usuarios.id],
    relationName: "playerReservas",
  }),
  cancha: one(canchas, {
    fields: [reservas.canchaId],
    references: [canchas.id],
  }),
  pagos: many(pagos),
  partido: one(partidos, {
    fields: [reservas.id],
    references: [partidos.reservaId],
  }),
}));

export const pagosRelations = relations(pagos, ({ one }) => ({
  reserva: one(reservas, {
    fields: [pagos.reservaId],
    references: [reservas.id],
  }),
  user: one(usuarios, {
    fields: [pagos.userId],
    references: [usuarios.id],
  }),
}));

export const notificacionesRelations = relations(notificaciones, ({ one }) => ({
  user: one(usuarios, {
    fields: [notificaciones.userId],
    references: [usuarios.id],
  }),
  reserva: one(reservas, {
    fields: [notificaciones.reservaId],
    references: [reservas.id],
  }),
}));

export const equiposRelations = relations(equipos, ({ one, many }) => ({
  creador: one(usuarios, {
    fields: [equipos.creadorId],
    references: [usuarios.id],
  }),
  miembros: many(equipoMiembros),
  partidosComoA: many(partidos, { relationName: "partidosEquipoA" }),
  partidosComoB: many(partidos, { relationName: "partidosEquipoB" }),
}));

export const equipoMiembrosRelations = relations(equipoMiembros, ({ one }) => ({
  equipo: one(equipos, {
    fields: [equipoMiembros.equipoId],
    references: [equipos.id],
  }),
  user: one(usuarios, {
    fields: [equipoMiembros.userId],
    references: [usuarios.id],
  }),
}));

export const partidosRelations = relations(partidos, ({ one, many }) => ({
  reserva: one(reservas, {
    fields: [partidos.reservaId],
    references: [reservas.id],
  }),
  creador: one(usuarios, {
    fields: [partidos.creadorId],
    references: [usuarios.id],
  }),
  equipoA: one(equipos, {
    fields: [partidos.equipoAId],
    references: [equipos.id],
    relationName: "partidosEquipoA",
  }),
  equipoB: one(equipos, {
    fields: [partidos.equipoBId],
    references: [equipos.id],
    relationName: "partidosEquipoB",
  }),
  jugadores: many(partidoJugadores),
}));

export const partidoJugadoresRelations = relations(partidoJugadores, ({ one }) => ({
  partido: one(partidos, {
    fields: [partidoJugadores.partidoId],
    references: [partidos.id],
  }),
  user: one(usuarios, {
    fields: [partidoJugadores.userId],
    references: [usuarios.id],
  }),
}));
