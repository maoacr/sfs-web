// @vitest-environment node
import { describe, it, expect } from "vitest";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * El store del limitador es un Map a nivel de módulo, compartido por todo el
 * archivo. Cada test estrena IP para no apagar al siguiente.
 */
function peticion(ruta: string, ip: string) {
  return new Request(`http://localhost${ruta}`, {
    headers: { "x-forwarded-for": ip },
  });
}

describe("getRateLimitKey", () => {
  it("usa la IP del primer salto de x-forwarded-for", () => {
    const key = getRateLimitKey(peticion("/api/canchas", "203.0.113.5, 10.0.0.1"), "default");
    expect(key).toContain("203.0.113.5");
    expect(key).not.toContain("10.0.0.1");
  });

  it("cae a una key estable cuando no hay x-forwarded-for", () => {
    const key = getRateLimitKey(new Request("http://localhost/api/canchas"), "default");
    expect(key).toContain("unknown");
  });

  /**
   * El bug que esto cubre: la key no incluía el balde, así que TODOS los
   * endpoints compartían un contador por IP mientras cada uno lo comparaba
   * contra su propio límite. Navegar la app agotaba el límite de login.
   */
  it("separa el balde de auth del general para la misma IP", () => {
    const ip = "203.0.113.10";
    expect(getRateLimitKey(peticion("/api/canchas", ip), "default")).not.toBe(
      getRateLimitKey(peticion("/api/auth/login", ip), "auth")
    );
  });

  it("mantiene una sola key por balde, sin abrir una por id de ruta", () => {
    const ip = "203.0.113.11";
    // Si la key incluyera el pathname, cada uuid abriría su propio balde de
    // 100/min: memory leak y límite esquivable cambiando el id.
    expect(getRateLimitKey(peticion("/api/canchas/aaaa-1111", ip), "default")).toBe(
      getRateLimitKey(peticion("/api/canchas/bbbb-2222", ip), "default")
    );
  });
});

describe("checkRateLimit", () => {
  it("permite hasta el máximo y corta en el siguiente", () => {
    const key = "test:tope";
    const config = { maxRequests: 3, windowMs: 60_000 };
    expect(checkRateLimit(key, config).allowed).toBe(true);
    expect(checkRateLimit(key, config).allowed).toBe(true);
    expect(checkRateLimit(key, config).allowed).toBe(true);
    expect(checkRateLimit(key, config).allowed).toBe(false);
  });

  it("descuenta el remaining en cada intento", () => {
    const key = "test:remaining";
    const config = { maxRequests: 3, windowMs: 60_000 };
    expect(checkRateLimit(key, config).remaining).toBe(2);
    expect(checkRateLimit(key, config).remaining).toBe(1);
    expect(checkRateLimit(key, config).remaining).toBe(0);
  });

  it("vuelve a permitir cuando la ventana expira", () => {
    const key = "test:ventana";
    const config = { maxRequests: 1, windowMs: 1 };
    expect(checkRateLimit(key, config).allowed).toBe(true);
    expect(checkRateLimit(key, config).allowed).toBe(false);
    // Ventana de 1ms: para el próximo tick ya venció.
    return new Promise<void>((listo) =>
      setTimeout(() => {
        expect(checkRateLimit(key, config).allowed).toBe(true);
        listo();
      }, 5)
    );
  });

  it("cada balde de RATE_LIMITS declara un nombre propio", () => {
    const nombres = Object.values(RATE_LIMITS).map((c) => c.bucket);
    // AUTH_LOGIN y AUTH_REGISTER pueden compartir intencionalmente, pero cada
    // entrada tiene que declarar algo: sin nombre, vuelve el balde único.
    expect(nombres.every((n) => typeof n === "string" && n.length > 0)).toBe(true);
  });
});
