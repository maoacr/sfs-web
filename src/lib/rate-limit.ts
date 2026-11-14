/**
 * Rate limiting — en memoria con sliding window.
 *
 * Para producción, migrar a Redis/Vercel KV.
 * Configurable por ruta: cada endpoint define su propio límite.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // duración de la ventana en ms
  /**
   * Nombre del balde de contadores. Dos endpoints con el mismo `bucket`
   * comparten contador; con baldes distintos no se pisan.
   *
   * Existe porque sin él la key era sólo la IP: todos los endpoints sumaban
   * al mismo contador mientras cada uno lo comparaba contra su propio límite.
   * Navegar la app dejaba sin login a quien después quisiera entrar.
   */
  bucket: string;
}

const store = new Map<string, RateLimitEntry>();

const DEFAULT_CONFIG: RateLimitConfig = {
  bucket: "default",
  maxRequests: 100,
  windowMs: 60_000, // 1 minuto
};

// Limpieza periódica — evita memory leak
const CLEANUP_INTERVAL = 5 * 60_000; // cada 5 minutos
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

/**
 * Verifica rate limit para una key (ej: IP, userId).
 * Retorna true si el request está permitido, false si excedió el límite.
 * También retorna headers para el cliente.
 */
export function checkRateLimit(
  key: string,
  config: Partial<RateLimitConfig> = {}
): {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
} {
  cleanup();

  const { maxRequests, windowMs } = { ...DEFAULT_CONFIG, ...config };
  const now = Date.now();
  const entry = store.get(key);

  // Primera vez o ventana expirada
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: new Date(now + windowMs),
    };
  }

  // Dentro de la ventana actual
  entry.count++;

  if (entry.count > maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(entry.resetAt),
    };
  }

  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: new Date(entry.resetAt),
  };
}

/**
 * Key de rate limiting: un contador por balde y por cliente.
 *
 * El balde va en la key y el pathname NO. Incluir la ruta abriría un contador
 * por cada id de las rutas dinámicas, lo que además de filtrar memoria haría
 * esquivable el límite con sólo cambiar el id.
 */
export function getRateLimitKey(request: Request, bucket: string): string {
  // Primer salto de x-forwarded-for: el cliente real detrás de los proxies.
  // En local el header no existe y todo cae en "unknown", que para un único
  // desarrollador alcanza.
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";

  return `rate:${bucket}:${ip}`;
}

/**
 * Añade headers de rate limit a una response.
 */
export function setRateLimitHeaders<T extends Response>(
  response: T,
  remaining: number,
  resetAt: Date
): T {
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  response.headers.set(
    "X-RateLimit-Reset",
    String(Math.ceil(resetAt.getTime() / 1000))
  );
  return response;
}

/**
 * Configuraciones por endpoint
 */
export const RATE_LIMITS = {
  // `auth` lo comparten /api/auth/login y /api/auth/google a propósito: los
  // dos son intentos de autenticarse, y el límite es del intento y no del
  // método. Cinco por contraseña más cinco por Google serían diez.
  AUTH_LOGIN: { bucket: "auth", maxRequests: 5, windowMs: 60_000 }, // 5 intentos/min
  AUTH_REGISTER: { bucket: "auth_register", maxRequests: 3, windowMs: 60_000 }, // 3 registros/min
  DEFAULT: { bucket: "default", maxRequests: 100, windowMs: 60_000 },
  DISPONIBILIDAD: { bucket: "disponibilidad", maxRequests: 60, windowMs: 60_000 }, // 1 query/seg
  STRICT: { bucket: "strict", maxRequests: 10, windowMs: 60_000 }, // 10/min
} as const;
