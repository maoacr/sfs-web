-- Quién juega cuando no tiene cuenta.
--
-- El dueño anota reservas de gente que cae al mostrador y nunca se registró.
-- Bloquear eso sería inventarle fricción a su operación, pero `player_id` es
-- NOT NULL y termina apuntando a la cuenta del propio dueño: sin esta columna
-- se pierde para siempre de quién era la reserva.
--
-- Null significa que la reserva sí está vinculada a un usuario real.

ALTER TABLE "reservas" ADD COLUMN "invitado_nombre" varchar(120);
