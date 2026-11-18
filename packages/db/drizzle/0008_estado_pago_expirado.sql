-- `EXPIRADO` como estado propio, y el `status_detail` de MercadoPago en su
-- propia columna.
--
-- Un pago abandonado no es un pago rechazado: uno es un problema de conversión
-- y el otro del medio de pago. Mezclarlos en `RECHAZADO` arruinaría cualquier
-- reporte de ventas perdidas.
--
-- Nota de Postgres: `ALTER TYPE ... ADD VALUE` puede correr dentro de una
-- transacción, pero el valor nuevo NO puede usarse en esa misma transacción.
-- Por eso esta migración sólo lo agrega; quien lo escribe es el código.

ALTER TYPE "public"."estado_pago" ADD VALUE IF NOT EXISTS 'EXPIRADO';--> statement-breakpoint

ALTER TABLE "pagos" ADD COLUMN "detalle_estado" varchar(60);--> statement-breakpoint

-- Rescata el detalle de los pagos que ya existen: hasta ahora vivía enterrado
-- en el jsonb y nadie lo leía.
UPDATE "pagos"
SET "detalle_estado" = left("mp_metadata"->'payment'->>'statusDetail', 60)
WHERE "detalle_estado" IS NULL
  AND "mp_metadata"->'payment'->>'statusDetail' IS NOT NULL;--> statement-breakpoint

CREATE INDEX "idx_pagos_detalle_estado" ON "pagos" USING btree ("detalle_estado");
