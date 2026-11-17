-- Corrige el backfill de 0006.
--
-- Esa migración clasificaba las filas viejas con `WHERE canal IS NULL`, pero
-- las columnas se agregaron con DEFAULT: Postgres rellena las filas existentes
-- con el default en el mismo ALTER, así que `canal` nunca quedó null y el
-- UPDATE no matcheó ninguna fila. El default se comió al backfill.
--
-- La lección, por si vuelve a pasar: con `ADD COLUMN ... DEFAULT`, un backfill
-- no puede reconocer las filas viejas por el null. Hay que preguntarle a los
-- datos, no a la ausencia de datos.
--
-- Acá se re-clasifica sólo lo que quedó en el default 'OTRO', así que no pisa
-- nada que se haya guardado explícitamente, y correrlo de nuevo no cambia
-- nada.

UPDATE "pagos" SET
  "canal" = 'PRESENCIAL',
  "metodo" = CASE lower("mp_metadata"->>'metodo')
    WHEN 'efectivo' THEN 'EFECTIVO'::"metodo_pago"
    WHEN 'nequi' THEN 'TRANSFERENCIA'::"metodo_pago"
    WHEN 'transferencia' THEN 'TRANSFERENCIA'::"metodo_pago"
    ELSE 'OTRO'::"metodo_pago"
  END,
  "entidad" = CASE lower("mp_metadata"->>'metodo') WHEN 'nequi' THEN 'NEQUI' ELSE "entidad" END
WHERE "metodo" = 'OTRO'
  AND "mp_payment_id" IS NULL
  AND "mp_metadata"->>'metodo' IS NOT NULL;--> statement-breakpoint

UPDATE "pagos" SET
  "canal" = 'APP',
  "metodo" = CASE lower("mp_metadata"->'payment'->>'metodo')
    WHEN 'pse' THEN 'PSE'::"metodo_pago"
    WHEN 'account_money' THEN 'BILLETERA'::"metodo_pago"
    WHEN 'nequi' THEN 'BILLETERA'::"metodo_pago"
    WHEN 'daviplata' THEN 'BILLETERA'::"metodo_pago"
    WHEN 'visa' THEN 'TARJETA_CREDITO'::"metodo_pago"
    WHEN 'master' THEN 'TARJETA_CREDITO'::"metodo_pago"
    WHEN 'amex' THEN 'TARJETA_CREDITO'::"metodo_pago"
    WHEN 'diners' THEN 'TARJETA_CREDITO'::"metodo_pago"
    WHEN 'codensa' THEN 'TARJETA_CREDITO'::"metodo_pago"
    WHEN 'debvisa' THEN 'TARJETA_DEBITO'::"metodo_pago"
    WHEN 'debmaster' THEN 'TARJETA_DEBITO'::"metodo_pago"
    WHEN 'efecty' THEN 'EFECTIVO'::"metodo_pago"
    WHEN 'baloto' THEN 'EFECTIVO'::"metodo_pago"
    ELSE 'OTRO'::"metodo_pago"
  END
WHERE "metodo" = 'OTRO'
  AND "mp_payment_id" IS NOT NULL
  AND "mp_metadata"->'payment'->>'metodo' IS NOT NULL;
