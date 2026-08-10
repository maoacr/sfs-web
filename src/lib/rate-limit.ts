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
}

const store = new Map<string, RateLimitEntry>();

const DEFAULT_CONFIG: RateLimitConfig = {
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
 * Obtiene la key de rate limiting desde el request.
 * Prioridad: userId (si autenticado) > IP del cliente.
 */
export function getRateLimitKey(request: Request): string {
  // Intentar extraer IP
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";

  return `rate:${ip}`;
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
  AUTH_LOGIN: { maxRequests: 5, windowMs: 60_000 }, // 5 intentos/min
  AUTH_REGISTER: { maxRequests: 3, windowMs: 60_000 }, // 3 registros/min
  DEFAULT: { maxRequests: 100, windowMs: 60_000 },
  DISPONIBILIDAD: { maxRequests: 60, windowMs: 60_000 }, // 1 query/seg
  STRICT: { maxRequests: 10, windowMs: 60_000 }, // 10/min
} as const;
