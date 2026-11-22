/**
 * Nombre del constraint que impide vender dos veces el mismo turno.
 *
 * Lo crea `packages/db/drizzle/0011_sin_doble_booking.sql` y lo lee
 * `esDobleBooking`. Es el único lugar donde el nombre vive del lado de
 * TypeScript: SQL no puede importar de acá, así que la coherencia la sostiene
 * esta constante y nada más. Si se renombra el constraint, se renombra acá.
 */
export const CONSTRAINT_SIN_DOBLE_BOOKING = "reservas_sin_doble_booking";

/** `exclusion_violation` — https://www.postgresql.org/docs/current/errcodes-appendix.html */
const EXCLUSION_VIOLATION = "23P01";

/**
 * ¿Este error es la base rechazando un turno ya vendido?
 *
 * Se mira el nombre del constraint y no sólo el código: un `23P01` genérico
 * significa "alguna exclusión falló", y traducir eso a "el slot ya está
 * reservado" sería mentirle al usuario en cuanto exista un segundo constraint
 * de exclusión en el esquema.
 *
 * El nombre viaja en `constraint_name` con postgres.js y en `constraint` con
 * node-postgres. El repo usa el primero (`packages/db/src/client.ts`), pero
 * aceptar los dos cuesta una comparación y evita que un cambio de driver
 * convierta un 409 en un 500 silencioso.
 */
export function esDobleBooking(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const { code, constraint_name: constraintName, constraint } = error as {
    code?: unknown;
    constraint_name?: unknown;
    constraint?: unknown;
  };

  if (code !== EXCLUSION_VIOLATION) return false;

  return (
    constraintName === CONSTRAINT_SIN_DOBLE_BOOKING || constraint === CONSTRAINT_SIN_DOBLE_BOOKING
  );
}
