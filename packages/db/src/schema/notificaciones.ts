import { pgTable, uuid, varchar, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { tipoNotificacionEnum } from "./enums";
import { usuarios } from "./users";
import { reservas } from "./reservas";

export const notificaciones = pgTable(
  "notificaciones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    tipo: tipoNotificacionEnum("tipo").notNull(),
    titulo: varchar("titulo", { length: 200 }).notNull(),
    mensaje: text("mensaje").notNull(),
    reservaId: uuid("reserva_id").references(() => reservas.id, { onDelete: "set null" }),
    leida: boolean("leida").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_notificaciones_user_leida").on(table.userId, table.leida),
    index("idx_notificaciones_user_created").on(table.userId, table.createdAt),
  ]
);

export type Notificacion = typeof notificaciones.$inferSelect;
export type NewNotificacion = typeof notificaciones.$inferInsert;
