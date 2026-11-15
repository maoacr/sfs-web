// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/auth-api", () => {
  class AuthError extends Error {
    status = 401;
  }
  return {
    AuthError,
    getAuthUser: vi.fn(async () => ({ sub: "u1", email: "u1@sfs.test", role: "PLAYER" })),
  };
});

import { apiHandler } from "@/lib/api-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";

const params = (p: Record<string, string>) => ({ params: Promise.resolve(p) });

describe("apiHandler", () => {
  it("pasa los params de la ruta al handler", async () => {
    const handler = apiHandler(async (_req, ctx) => NextResponse.json({ id: ctx.params.id }), {
      requireAuth: true,
    });
    const id = "3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b";
    const res = await handler(new NextRequest(`http://localhost/api/canchas/${id}`), params({ id }));
    expect(await res.json()).toEqual({ id });
  });

  it("responde 404 si un id de la ruta no es un UUID, sin llegar a la base", async () => {
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const res = await apiHandler(handler, { requireAuth: true })(
      new NextRequest("http://localhost/api/canchas/abc"),
      params({ id: "abc" })
    );
    expect(res.status).toBe(404);
    expect(handler).not.toHaveBeenCalled();
  });

  it("rechaza escrituras sin token CSRF", async () => {
    const handler = apiHandler(async () => NextResponse.json({ ok: true }), { requireAuth: true });
    const res = await handler(
      new NextRequest("http://localhost/api/canchas/abc", { method: "PUT" }),
      params({ id: "3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b" })
    );
    expect(res.status).toBe(403);
  });

  it("acepta escrituras cuando el header coincide con la cookie", async () => {
    const handler = apiHandler(async () => NextResponse.json({ ok: true }), { requireAuth: true });
    const req = new NextRequest("http://localhost/api/canchas/abc", {
      method: "PUT",
      headers: { cookie: "csrf_token=tok", "X-CSRF-Token": "tok" },
    });
    const res = await handler(req, params({ id: "3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b" }));
    expect(res.status).toBe(200);
  });

  /**
   * El bug que esto cubre, en los términos en que se vivió: navegar la app
   * agotaba el límite de login. La key del limitador no incluía el balde, así
   * que todos los endpoints compartían UN contador por IP mientras cada uno lo
   * comparaba contra su propio límite. Ocho requests genéricas (límite 100)
   * dejaban el contador en 8, y el primer intento de login (límite 5) se iba
   * en 429 sin haber intentado nunca.
   */
  it("el tráfico normal de la app no agota el límite de login", async () => {
    const ip = "198.51.100.7";
    const pedir = (ruta: string) =>
      new NextRequest(`http://localhost${ruta}`, { headers: { "x-forwarded-for": ip } });

    const generico = apiHandler(async () => NextResponse.json({ ok: true }));
    for (let intento = 0; intento < 8; intento += 1) {
      expect((await generico(pedir("/api/canchas"))).status).toBe(200);
    }

    const login = apiHandler(async () => NextResponse.json({ ok: true }), {
      rateLimit: RATE_LIMITS.AUTH_LOGIN,
    });
    expect((await login(pedir("/api/auth/login"))).status).toBe(200);
  });

  it("sigue cortando cuando se pasa del límite de su propio balde", async () => {
    const ip = "198.51.100.8";
    const login = apiHandler(async () => NextResponse.json({ ok: true }), {
      rateLimit: RATE_LIMITS.AUTH_LOGIN,
    });
    const pedir = () =>
      new NextRequest("http://localhost/api/auth/login", {
        headers: { "x-forwarded-for": ip },
      });

    const estados: number[] = [];
    for (let intento = 0; intento < 6; intento += 1) {
      estados.push((await login(pedir())).status);
    }

    expect(estados.slice(0, 5)).not.toContain(429);
    expect(estados[5]).toBe(429);
  });

  it("rechaza un rol distinto al requerido", async () => {
    const handler = apiHandler(async () => NextResponse.json({ ok: true }), {
      requireAuth: true,
      requiredRole: "OWNER",
    });
    const res = await handler(new NextRequest("http://localhost/api/canchas/abc"), params({ id: "3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b" }));
    expect(res.status).toBe(403);
  });
});
