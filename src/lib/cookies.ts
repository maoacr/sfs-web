/**
 * Política de cookies de sesión — fuente única de verdad.
 *
 * Antes estaba copiada a mano en login y register (cuatro `cookies.set`), que
 * es exactamente cómo un atributo como `sameSite` termina desincronizado entre
 * rutas. Acá vive una sola vez y se testea una sola vez.
 */

export const ACCESS_COOKIE = "sfs_token";
export const REFRESH_COOKIE = "sfs_refresh";

export const ACCESS_MAX_AGE = 15 * 60; // 15 minutos
export const REFRESH_MAX_AGE = 7 * 24 * 60 * 60; // 7 días

export interface SessionCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
}

/**
 * `sameSite: "lax"` y no `"strict"`.
 *
 * MercadoPago devuelve al jugador con un redirect a `back_urls` — una
 * navegación de nivel superior con GET que viene de otro sitio. `strict` no
 * manda la cookie en ese caso, así que `proxy.ts` no ve sesión y lo rebota al
 * login justo después de haber pagado.
 *
 * `lax` la manda sólo en ese escenario: navegación de nivel superior con
 * método seguro. Sigue sin viajar en POST/PUT/DELETE cross-site ni en
 * subrecursos (imágenes, iframes, fetch), que es el vector real de CSRF. Y la
 * defensa no descansa en esto: las escrituras validan además el double-submit
 * token de `csrf.ts`.
 *
 * Condición que esto impone: ningún GET puede cambiar estado. El único que lo
 * hace es el cron, y se autentica con `CRON_SECRET`, no con cookie.
 */
export function sessionCookieOptions(maxAge: number): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

/** Lo mínimo que necesitamos de una NextResponse para escribir cookies. */
interface CookieWriter {
  cookies: {
    set(name: string, value: string, options: SessionCookieOptions): unknown;
  };
}

/** Emite el par access + refresh con la política compartida. */
export function setSessionCookies(
  response: CookieWriter,
  tokens: { accessToken: string; refreshToken: string }
): void {
  response.cookies.set(
    ACCESS_COOKIE,
    tokens.accessToken,
    sessionCookieOptions(ACCESS_MAX_AGE)
  );
  response.cookies.set(
    REFRESH_COOKIE,
    tokens.refreshToken,
    sessionCookieOptions(REFRESH_MAX_AGE)
  );
}
