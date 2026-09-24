import { pgTable, uuid, varchar, text, integer, jsonb, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { tipoCanchaEnum } from "./enums";
import { usuarios } from "./users";
import { complejos } from "./complejos";

export const canchas = pgTable(
  "canchas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "restrict" }),
    complejoId: uuid("complejo_id")
      .notNull()
      .references(() => complejos.id, { onDelete: "cascade" }),
    nombre: varchar("nombre", { length: 100 }).notNull(),
    tipo: tipoCanchaEnum("tipo").notNull(),
    capacidad: integer("capacidad").notNull(),
    descripcion: text("descripcion"),
    servicios: jsonb("servicios").default([]).notNull(),
    duracionSlotMinutos: integer("duracion_slot_minutos").default(60).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_canchas_tenant_id").on(table.tenantId),
    index("idx_canchas_complejo_id").on(table.complejoId),
    index("idx_canchas_tipo").on(table.tipo),
  ]
);

export const imagenesCanchas = pgTable(
  "imagenes_canchas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    canchaId: uuid("cancha_id")
      .notNull()
      .references(() => canchas.id, { onDelete: "cascade" }),
    url: varchar("url", { length: 500 }).notNull(),
    orden: integer("orden").default(0).notNull(),
    principal: boolean("principal").default(false).notNull(),
  },
  (table) => [
    index("idx_imagenes_canchas_cancha_id").on(table.canchaId),
  ]
);

export type Cancha = typeof canchas.$inferSelect;
export type NewCancha = typeof canchas.$inferInsert;
export type ImagenCancha = typeof imagenesCanchas.$inferSelect;
export type NewImagenCancha = typeof imagenesCanchas.$inferInsert;
