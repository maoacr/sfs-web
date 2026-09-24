import { pgTable, uuid, decimal, timestamp, index } from "drizzle-orm/pg-core";
import { estadoReservaEnum } from "./enums";
import { usuarios } from "./users";
import { canchas } from "./canchas";

export const reservas = pgTable(
  "reservas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "restrict" }),
    canchaId: uuid("cancha_id")
      .notNull()
      .references(() => canchas.id, { onDelete: "restrict" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "restrict" }),
    slotInicio: timestamp("slot_inicio", { withTimezone: true }).notNull(),
    slotFin: timestamp("slot_fin", { withTimezone: true }).notNull(),
    montoTotal: decimal("monto_total", { precision: 10, scale: 2 }).notNull(),
    montoPagado: decimal("monto_pagado", { precision: 10, scale: 2 }).default("0.00").notNull(),
    saldoPendiente: decimal("saldo_pendiente", { precision: 10, scale: 2 }).default("0.00").notNull(),
    estado: estadoReservaEnum("estado").default("PENDIENTE_PAGO").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_reservas_tenant_id").on(table.tenantId),
    index("idx_reservas_player_id").on(table.playerId),
    index("idx_reservas_cancha_slot").on(table.canchaId, table.slotInicio, table.slotFin),
    index("idx_reservas_estado").on(table.estado),
  ]
);

export type Reserva = typeof reservas.$inferSelect;
export type NewReserva = typeof reservas.$inferInsert;
