import { pgTable, uuid, varchar, timestamp, index } from "drizzle-orm/pg-core";
import { rolUsuarioEnum } from "./enums";

export const usuarios = pgTable(
  "usuarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * Nullable a propósito: el dueño registra clientes desde el mostrador con
     * los datos que la persona le quiera dar, y muchas veces no hay email.
     * Esa cuenta existe —la reserva tiene un titular de verdad y la deuda cae
     * donde corresponde— pero todavía no puede entrar.
     *
     * El email es lo que después le permite RECLAMARLA: cuando la persona
     * entra con Google, `decidirVinculo` la encuentra por email y le entrega
     * la cuenta con su historial (ver `src/lib/google-auth.ts`).
     *
     * El índice sigue siendo único y eso NO impide varios nulos: en Postgres
     * los NULL no colisionan entre sí. Es el mismo arreglo que ya tenía
     * `google_sub`, en esta misma tabla.
     */
    email: varchar("email", { length: 255 }).unique(),
    /**
     * Nullable a propósito: el hash existe SI esta cuenta puede entrar con
     * contraseña. Las cuentas de Google no tienen ninguna, y una cuenta que
     * se vincula a Google pierde la que tenía (ver `src/lib/google-auth.ts`).
     */
    passwordHash: varchar("password_hash", { length: 255 }),
    /**
     * `sub` de Google. Es el identificador estable de la identidad: el email
     * del usuario puede cambiar, esto no. Único para que dos filas no puedan
     * reclamar la misma identidad.
     */
    googleSub: varchar("google_sub", { length: 255 }).unique(),
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
