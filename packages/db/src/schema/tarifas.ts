import { pgTable, uuid, decimal, integer, time } from "drizzle-orm/pg-core";
import { canchas } from "./canchas";

export const tarifas = pgTable(
  "tarifas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    canchaId: uuid("cancha_id")
      .notNull()
      .references(() => canchas.id, { onDelete: "cascade" }),
    precioBase: decimal("precio_base", { precision: 10, scale: 2 }).notNull(),
    diaSemana: integer("dia_semana"), // null = todos los días
    horaInicio: time("hora_inicio"),  // null = todo el día
    horaFin: time("hora_fin"),
    factor: decimal("factor", { precision: 3, scale: 2 }).default("1.00").notNull(), // 1.00 = normal, 1.50 = +50%
  }
);

export type Tarifa = typeof tarifas.$inferSelect;
export type NewTarifa = typeof tarifas.$inferInsert;
