-- Las tres dimensiones del pago, más la comisión del procesador.
--
-- Hasta acá el método vivía dentro de `mp_metadata` (un jsonb pensado para el
-- payload de MercadoPago) y el canal no se guardaba. Eso alcanza para mostrar
-- un dato suelto, no para agrupar: un cierre diario sobre
-- `mp_metadata->>'metodo'` es frágil, sin índice, y además miente cuando la
-- plata fue en efectivo.

CREATE TYPE "public"."metodo_pago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'PSE', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'BILLETERA', 'OTRO');--> statement-breakpoint
CREATE TYPE "public"."canal_pago" AS ENUM ('APP', 'PRESENCIAL');--> statement-breakpoint

-- Nullable primero: la tabla ya tiene filas y no se las puede dejar afuera.
-- Y con DEFAULT, para que el código que ya está corriendo pueda seguir
-- insertando entre que corre esta migración y se despliega el código nuevo.
-- Expand ahora, contract después: los defaults se sacan cuando todos los
-- caminos de escritura manden las dos columnas explícitas.
ALTER TABLE "pagos" ADD COLUMN "metodo" "metodo_pago" DEFAULT 'OTRO';--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "canal" "canal_pago" DEFAULT 'APP';--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "entidad" varchar(60);--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "comision" numeric(10, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint

-- Backfill 1: pagos que registró el dueño. El método estaba en el jsonb.
UPDATE "pagos" SET
  "canal" = 'PRESENCIAL',
  "metodo" = CASE lower("mp_metadata"->>'metodo')
    WHEN 'efectivo' THEN 'EFECTIVO'::"metodo_pago"
    WHEN 'nequi' THEN 'TRANSFERENCIA'::"metodo_pago"
    WHEN 'transferencia' THEN 'TRANSFERENCIA'::"metodo_pago"
    ELSE 'OTRO'::"metodo_pago"
  END,
  "entidad" = CASE lower("mp_metadata"->>'metodo') WHEN 'nequi' THEN 'NEQUI' ELSE NULL END
WHERE "mp_payment_id" IS NULL AND "mp_metadata"->>'metodo' IS NOT NULL;--> statement-breakpoint

-- Backfill 2: pagos por MercadoPago. `entidad` queda null a propósito: el
-- emisor nunca se guardó, y es preferible un null honesto a un dato inventado.
UPDATE "pagos" SET
  "canal" = 'APP',
  "metodo" = CASE lower("mp_metadata"->'payment'->>'metodo')
    WHEN 'pse' THEN 'PSE'::"metodo_pago"
    WHEN 'account_money' THEN 'BILLETERA'::"metodo_pago"
    WHEN 'visa' THEN 'TARJETA_CREDITO'::"metodo_pago"
    WHEN 'master' THEN 'TARJETA_CREDITO'::"metodo_pago"
    WHEN 'amex' THEN 'TARJETA_CREDITO'::"metodo_pago"
    WHEN 'debvisa' THEN 'TARJETA_DEBITO'::"metodo_pago"
    WHEN 'debmaster' THEN 'TARJETA_DEBITO'::"metodo_pago"
    ELSE 'OTRO'::"metodo_pago"
  END
WHERE "canal" IS NULL AND "mp_payment_id" IS NOT NULL;--> statement-breakpoint

-- Backfill 3: red de seguridad. Nada queda sin clasificar.
UPDATE "pagos" SET "canal" = 'APP', "metodo" = 'OTRO'
WHERE "canal" IS NULL OR "metodo" IS NULL;--> statement-breakpoint

ALTER TABLE "pagos" ALTER COLUMN "metodo" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pagos" ALTER COLUMN "canal" SET NOT NULL;--> statement-breakpoint

CREATE INDEX "idx_pagos_canal_metodo" ON "pagos" USING btree ("canal","metodo");--> statement-breakpoint
CREATE INDEX "idx_pagos_created_at" ON "pagos" USING btree ("created_at");
