import { pgTable, uuid, varchar, decimal, timestamp, integer, index } from "drizzle-orm/pg-core";
import { tipoDescuentoEnum } from "./enums";
import { tarifas } from "./tarifas";

export const promociones = pgTable(
  "promociones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tarifaId: uuid("tarifa_id")
      .notNull()
      .references(() => tarifas.id, { onDelete: "cascade" }),
    codigo: varchar("codigo", { length: 50 }).notNull().unique(),
    tipoDescuento: tipoDescuentoEnum("tipo_descuento").notNull(),
    valor: decimal("valor", { precision: 10, scale: 2 }).notNull(),
    validoDesde: timestamp("valido_desde", { withTimezone: true }).notNull(),
    validoHasta: timestamp("valido_hasta", { withTimezone: true }).notNull(),
    usosMaximos: integer("usos_maximos"), // null = ilimitado
    usosActuales: integer("usos_actuales").default(0).notNull(),
  },
  (table) => [
    index("idx_promociones_codigo").on(table.codigo),
    index("idx_promociones_tarifa_id").on(table.tarifaId),
  ]
);

export type Promocion = typeof promociones.$inferSelect;
export type NewPromocion = typeof promociones.$inferInsert;
