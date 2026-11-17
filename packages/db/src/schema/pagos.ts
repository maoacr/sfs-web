import { pgTable, uuid, varchar, decimal, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { canalPagoEnum, estadoPagoEnum, metodoPagoEnum } from "./enums";
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

    /**
     * Las tres dimensiones del pago, separadas a propósito: una sola columna
     * obligaría a elegir entre "MercadoPago", "PSE" y "Bancolombia" cuando en
     * un mismo pago las tres son ciertas.
     *
     * `metodo` es el tipo y `entidad` la institución. Nequi, Daviplata y
     * Bancolombia son todos TRANSFERENCIA y se distinguen por `entidad`.
     *
     * `entidad` es varchar y no enum porque la lista de bancos y billeteras es
     * abierta: MercadoPago devuelve el emisor con el nombre que se le antoje y
     * un enum pediría una migración por cada banco nuevo. Queda null cuando no
     * aplica (efectivo).
     *
     * Quién procesó el pago no necesita columna: `mp_payment_id IS NOT NULL`
     * ya dice si pasó por MercadoPago.
     */
    metodo: metodoPagoEnum("metodo").default("OTRO").notNull(),
    canal: canalPagoEnum("canal").default("APP").notNull(),
    entidad: varchar("entidad", { length: 60 }),

    /**
     * Lo que se quedó el procesador. Sin esto los libros no cuadran contra el
     * extracto: lo facturado no es lo que llega al banco. El neto no se guarda
     * porque es `monto - comision`.
     */
    comision: decimal("comision", { precision: 10, scale: 2 }).default("0.00").notNull(),
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
    // Los reportes agrupan por estas dos y filtran por fecha.
    index("idx_pagos_canal_metodo").on(table.canal, table.metodo),
    index("idx_pagos_created_at").on(table.createdAt),
    index("idx_pagos_user_id").on(table.userId),
    index("idx_pagos_mp_payment_id").on(table.mpPaymentId),
  ]
);

export type Pago = typeof pagos.$inferSelect;
export type NewPago = typeof pagos.$inferInsert;
