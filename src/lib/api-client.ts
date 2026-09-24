// Cliente HTTP del frontend. El backend exige el header X-CSRF-Token (igual
// a la cookie csrf_token) en todo método que escribe; este wrapper lo agrega
// en un solo lugar para que ninguna pantalla tenga que acordarse.

const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"]);

function leerCookie(nombre: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${nombre}=`))
    ?.slice(nombre.length + 1);
}

async function tokenCsrf(): Promise<string | undefined> {
  const actual = leerCookie("csrf_token");
  if (actual) return actual;
  // GET /api/auth/me emite una cookie nueva (p. ej. si la anterior expiró).
  await fetch("/api/auth/me");
  return leerCookie("csrf_token");
}

export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const metodo = (init.method ?? "GET").toUpperCase();
  if (METODOS_SEGUROS.has(metodo)) return fetch(url, init);

  const headers = new Headers(init.headers);
  const token = await tokenCsrf();
  if (token) headers.set("X-CSRF-Token", token);
  return fetch(url, { ...init, headers });
}
