import { pgTable, uuid, integer, time } from "drizzle-orm/pg-core";
import { canchas } from "./canchas";

export const slotConfigs = pgTable(
  "slot_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    canchaId: uuid("cancha_id")
      .notNull()
      .references(() => canchas.id, { onDelete: "cascade" }),
    diaSemana: integer("dia_semana").notNull(), // 0=Domingo, 1=Lunes... 6=Sábado
    horaApertura: time("hora_apertura").notNull(), // "08:00"
    horaCierre: time("hora_cierre").notNull(),     // "23:00"
  }
);

export type SlotConfig = typeof slotConfigs.$inferSelect;
export type NewSlotConfig = typeof slotConfigs.$inferInsert;
