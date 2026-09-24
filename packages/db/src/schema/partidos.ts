import { pgTable, uuid, varchar, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usuarios } from "./users";
import { reservas } from "./reservas";

export const equipos = pgTable(
  "equipos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: varchar("nombre", { length: 100 }).notNull(),
    fotoUrl: varchar("foto_url", { length: 500 }),
    descripcion: text("descripcion"),
    creadorId: uuid("creador_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  }
);

export const equipoMiembros = pgTable(
  "equipo_miembros",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    equipoId: uuid("equipo_id")
      .notNull()
      .references(() => equipos.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    rol: varchar("rol", { length: 20 }).default("MIEMBRO").notNull(), // CAPITAN, MIEMBRO
  },
  (table) => [
    uniqueIndex("uq_equipo_miembros_equipo_user").on(table.equipoId, table.userId),
  ]
);

export const partidos = pgTable(
  "partidos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reservaId: uuid("reserva_id")
      .notNull()
      .unique()
      .references(() => reservas.id, { onDelete: "cascade" }),
    creadorId: uuid("creador_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "restrict" }),
    equipoAId: uuid("equipo_a_id").references(() => equipos.id, { onDelete: "set null" }),
    equipoBId: uuid("equipo_b_id").references(() => equipos.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  }
);

export const partidoJugadores = pgTable(
  "partido_jugadores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partidoId: uuid("partido_id")
      .notNull()
      .references(() => partidos.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("uq_partido_jugadores_partido_user").on(table.partidoId, table.userId),
  ]
);

export type Equipo = typeof equipos.$inferSelect;
export type NewEquipo = typeof equipos.$inferInsert;
export type EquipoMiembro = typeof equipoMiembros.$inferSelect;
export type NewEquipoMiembro = typeof equipoMiembros.$inferInsert;
export type Partido = typeof partidos.$inferSelect;
export type NewPartido = typeof partidos.$inferInsert;
export type PartidoJugador = typeof partidoJugadores.$inferSelect;
export type NewPartidoJugador = typeof partidoJugadores.$inferInsert;
