-- Impide vender dos veces el mismo turno. En la base, no en el código.
--
-- Hasta acá la única defensa era el SELECT previo al INSERT en
-- `POST /api/reservas` y en `POST /api/sync`. Ese chequeo no puede ser
-- correcto por construcción: entre leer y escribir hay una ventana, y dos
-- requests simultáneos la atraviesan los dos. El daño no es una fila de más
-- —es un cliente plantado en la cancha con un recibo en la mano.
--
-- `btree_gist` hace falta sólo por `cancha_id`: GiST no sabe indexar una
-- igualdad de uuid sin esa extensión. El `&&` sobre tstzrange ya es nativo.
-- La clase de operadores va calificada (`extensions.gist_uuid_ops`) para no
-- depender de que el `search_path` incluya el schema donde vive la extensión.
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
--> statement-breakpoint
-- El rango es MEDIO-ABIERTO: `[)`. Un turno que termina a las 20 no choca con
-- el que arranca a las 20. Es el mismo criterio que el chequeo de la app
-- (`slot_inicio < fin AND slot_fin > inicio`); con `[]` la cancha perdería un
-- turno de cada dos.
--
-- Los estados del predicado son los mismos que ya decide `/api/sync`:
-- PENDIENTE_PAGO, PAGO_PARCIAL y CONFIRMADA. Las tres razones:
--
-- * PENDIENTE_PAGO entra aunque la app lo suelte al vencer el TTL. El
--   predicado de un EXCLUDE tiene que ser inmutable y no puede preguntar la
--   hora, así que o entra siempre o no entra nunca. Dejarlo afuera parece lo
--   conservador y es lo peor: los dos jugadores que compiten crearían sus dos
--   PENDIENTE_PAGO sin ruido, y el choque estallaría recién cuando el webhook
--   de MP intente pasar el segundo a CONFIRMADA. Cobrarle la plata y después
--   no poder darle el turno es el peor momento posible para fallar. Lo que
--   paga ese precio es `liberarTurnoVencido` en `web/src/lib/ttl.ts`: asienta
--   lo vencido de ese turno, y se espera, antes de insertar.
-- * CANCELADA y EXPIRADA no ocupan nada: están muertas.
-- * COMPLETADA tampoco entra, igual que en `ESTADOS_QUE_SIEMPRE_OCUPAN`
--   (`web/src/lib/disponibilidad.ts`). El partido ya se jugó, el turno es
--   pasado y el dueño puede necesitar anotar a mano lo que pasó ahí. Si la
--   base fuera más estricta que la app, el jugador vería el turno libre y
--   comería un rechazo al reservarlo.
--
-- `deleted_at IS NULL` cierra una trampa: la columna existe y hoy nadie la
-- escribe, pero el día que un borrado lógico signifique "esto nunca pasó", sin
-- esta cláusula esa fila bloquearía el turno para siempre y sin forma de
-- liberarlo.
ALTER TABLE "reservas"
  ADD CONSTRAINT "reservas_sin_doble_booking"
  EXCLUDE USING gist (
    "cancha_id" extensions.gist_uuid_ops WITH =,
    tstzrange("slot_inicio", "slot_fin", '[)') WITH &&
  )
  WHERE (
    "deleted_at" IS NULL
    AND "estado" IN ('PENDIENTE_PAGO', 'PAGO_PARCIAL', 'CONFIRMADA')
  );
