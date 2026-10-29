import { describe, it, expect, vi, afterEach } from "vitest";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_MAX_AGE,
  REFRESH_MAX_AGE,
  sessionCookieOptions,
  setSessionCookies,
} from "../lib/cookies";

/** Doble de NextResponse: sólo necesitamos registrar qué cookies se escriben. */
function responseDoble() {
  const escritas: Array<{ name: string; value: string; options: ReturnType<typeof sessionCookieOptions> }> = [];
  return {
    escritas,
    cookies: {
      set(name: string, value: string, options: ReturnType<typeof sessionCookieOptions>) {
        escritas.push({ name, value, options });
      },
    },
  };
}

describe("Política de cookies de sesión", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("sameSite", () => {
    it("usa lax para que la vuelta de MercadoPago traiga la sesión", () => {
      // MercadoPago redirige al jugador de vuelta con un GET de nivel superior.
      // Con "strict" el browser no manda la cookie y proxy.ts lo rebota al
      // login justo después de pagar. "lax" sí la manda en ese caso y sigue
      // bloqueando POST/subrecursos cross-site.
      expect(sessionCookieOptions(ACCESS_MAX_AGE).sameSite).toBe("lax");
    });

    it("mantiene la misma política en el access y en el refresh", () => {
      expect(sessionCookieOptions(ACCESS_MAX_AGE).sameSite).toBe(
        sessionCookieOptions(REFRESH_MAX_AGE).sameSite
      );
    });
  });

  describe("endurecimiento", () => {
    it("las cookies de sesión nunca son legibles por JS", () => {
      expect(sessionCookieOptions(ACCESS_MAX_AGE).httpOnly).toBe(true);
    });

    it("exige HTTPS en producción", () => {
      vi.stubEnv("NODE_ENV", "production");
      expect(sessionCookieOptions(ACCESS_MAX_AGE).secure).toBe(true);
    });

    it("no exige HTTPS fuera de producción, para poder trabajar en local", () => {
      vi.stubEnv("NODE_ENV", "development");
      expect(sessionCookieOptions(ACCESS_MAX_AGE).secure).toBe(false);
    });

    it("alcanza toda la app", () => {
      expect(sessionCookieOptions(ACCESS_MAX_AGE).path).toBe("/");
    });
  });

  describe("vigencia", () => {
    it("el access dura 15 minutos y el refresh 7 días", () => {
      expect(ACCESS_MAX_AGE).toBe(15 * 60);
      expect(REFRESH_MAX_AGE).toBe(7 * 24 * 60 * 60);
    });

    it("cada cookie recibe su propia vigencia", () => {
      expect(sessionCookieOptions(ACCESS_MAX_AGE).maxAge).toBe(ACCESS_MAX_AGE);
      expect(sessionCookieOptions(REFRESH_MAX_AGE).maxAge).toBe(REFRESH_MAX_AGE);
    });
  });

  describe("setSessionCookies", () => {
    it("escribe access y refresh con sus nombres y vigencias", () => {
      const res = responseDoble();

      setSessionCookies(res, { accessToken: "a-token", refreshToken: "r-token" });

      expect(res.escritas).toHaveLength(2);

      const access = res.escritas.find((c) => c.name === ACCESS_COOKIE);
      const refresh = res.escritas.find((c) => c.name === REFRESH_COOKIE);

      expect(access?.value).toBe("a-token");
      expect(access?.options.maxAge).toBe(ACCESS_MAX_AGE);

      expect(refresh?.value).toBe("r-token");
      expect(refresh?.options.maxAge).toBe(REFRESH_MAX_AGE);
    });

    it("aplica lax a las dos cookies que escribe", () => {
      const res = responseDoble();

      setSessionCookies(res, { accessToken: "a", refreshToken: "r" });

      expect(res.escritas.every((c) => c.options.sameSite === "lax")).toBe(true);
      expect(res.escritas.every((c) => c.options.httpOnly === true)).toBe(true);
    });
  });
});
