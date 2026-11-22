/**
 * Lectura segura de una connection string de Postgres.
 *
 * Vive en su propio módulo, sin efectos al importarse, porque `migrate.ts` y
 * `seed.ts` sí los tienen: crean el cliente y llaman a `process.exit` al
 * cargarse. Eso los vuelve inimportables desde los tests, así que lo que
 * conviene cubrir se extrae acá.
 */

const DESTINO_ILEGIBLE = "(no se pudo interpretar la URL)";

/**
 * Devuelve `host:puerto` de una connection string, **sin credenciales**.
 *
 * Con dos proyectos de Supabase (producción y `sfs-dev`), apuntar el `.env` al
 * equivocado NO falla: las migraciones se aplican igual, sólo que en la base
 * que no era, y el ledger queda escrito ahí. El error recién se nota mucho
 * después, cuando ya hay datos encima. Imprimir el destino es la diferencia
 * entre enterarse ahora y enterarse cuando no se puede deshacer.
 *
 * Devuelve sólo el host porque esto termina en pantalla y en los logs de un
 * workflow: la cadena completa lleva la contraseña. Cuando el parseo falla
 * —por ejemplo si la contraseña tiene una barra, que rompe la URL— devuelve un
 * texto fijo en vez del pedazo que alcanzó a leer.
 */
export function extraerHostDeConexion(cadenaConexion: string): string {
  try {
    return new URL(cadenaConexion).host || DESTINO_ILEGIBLE;
  } catch {
    return DESTINO_ILEGIBLE;
  }
}
