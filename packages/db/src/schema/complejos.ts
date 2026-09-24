import { pgTable, uuid, varchar, text, decimal, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { usuarios } from "./users";

export const complejos = pgTable(
  "complejos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "restrict" }),
    nombre: varchar("nombre", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 120 }),
    direccion: varchar("direccion", { length: 255 }).notNull(),
    tipoVia: varchar("tipo_via", { length: 20 }).default("Calle").notNull(),
    numeroVia: varchar("numero_via", { length: 10 }).default("").notNull(),
    numeroSec: varchar("numero_sec", { length: 10 }),
    complemento: varchar("complemento", { length: 100 }),
    ciudad: varchar("ciudad", { length: 100 }).notNull(),
    departamento: varchar("departamento", { length: 100 }).notNull(),
    descripcion: text("descripcion"),
    telefono: varchar("telefono", { length: 20 }),
    email: varchar("email", { length: 255 }),
    instagram: varchar("instagram", { length: 100 }),
    tiktok: varchar("tiktok", { length: 100 }),
    twitter: varchar("twitter", { length: 100 }),
    facebook: varchar("facebook", { length: 100 }),
    latitud: decimal("latitud", { precision: 10, scale: 7 }),
    longitud: decimal("longitud", { precision: 10, scale: 7 }),
    politicaCancelacionHoras: decimal("politica_cancelacion_horas", { precision: 5, scale: 2 }).default("24.00"),
    politicaCancelacionPenalizacion: decimal("politica_cancelacion_penalizacion", { precision: 5, scale: 2 }).default("0.00"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_complejos_tenant_id").on(table.tenantId),
    index("idx_complejos_ciudad").on(table.ciudad),
    index("idx_complejos_slug").on(table.slug),
  ]
);

export const imagenesComplejos = pgTable(
  "imagenes_complejos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    complejoId: uuid("complejo_id")
      .notNull()
      .references(() => complejos.id, { onDelete: "cascade" }),
    url: varchar("url", { length: 500 }).notNull(),
    orden: decimal("orden", { precision: 5, scale: 0 }).default("0"),
    principal: decimal("principal", { precision: 1, scale: 0 }).default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_imagenes_complejos_complejo_id").on(table.complejoId),
  ]
);

export type Complejo = typeof complejos.$inferSelect;
export type NewComplejo = typeof complejos.$inferInsert;
export type ImagenComplejo = typeof imagenesComplejos.$inferSelect;
export type NewImagenComplejo = typeof imagenesComplejos.$inferInsert;
