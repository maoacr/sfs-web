import { pgTable, uuid, varchar, decimal, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { estadoPagoEnum } from "./enums";
import { reservas } from "./reservas";
import { usuarios } from "./users";

export const pagos = pgTable(
  "pagos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reservaId: uuid("reserva_id")
      .notNull()
      .references(() => reservas.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "restrict" }),
    monto: decimal("monto", { precision: 10, scale: 2 }).notNull(),
    estadoPago: estadoPagoEnum("estado_pago").default("PENDIENTE").notNull(),
    mpSplitId: varchar("mp_split_id", { length: 255 }),
    mpPaymentId: varchar("mp_payment_id", { length: 255 }),
    mpMetadata: jsonb("mp_metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_pagos_reserva_id").on(table.reservaId),
    index("idx_pagos_user_id").on(table.userId),
    index("idx_pagos_mp_payment_id").on(table.mpPaymentId),
  ]
);

export type Pago = typeof pagos.$inferSelect;
export type NewPago = typeof pagos.$inferInsert;
