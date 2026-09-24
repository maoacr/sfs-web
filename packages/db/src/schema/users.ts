import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { rolUsuarioEnum } from "./enums";

export const usuarios = pgTable(
  "usuarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    nombre: varchar("nombre", { length: 100 }).notNull(),
    apellido: varchar("apellido", { length: 100 }).notNull(),
    apodo: varchar("apodo", { length: 50 }),
    telefono: varchar("telefono", { length: 20 }),
    codigoPais: varchar("codigo_pais", { length: 5 }).default("+57").notNull(),
    rol: rolUsuarioEnum("rol").default("PLAYER").notNull(),
    avatarUrl: varchar("avatar_url", { length: 500 }),
    instagram: varchar("instagram", { length: 100 }),
    tiktok: varchar("tiktok", { length: 100 }),
    twitter: varchar("twitter", { length: 100 }),
    facebook: varchar("facebook", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_usuarios_email").on(table.email),
    index("idx_usuarios_rol").on(table.rol),
  ]
);

export type Usuario = typeof usuarios.$inferSelect;
export type NewUsuario = typeof usuarios.$inferInsert;
