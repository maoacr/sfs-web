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

const params = (p: Record<string, string>) => ({ params: Promise.resolve(p) });

describe("apiHandler", () => {
  it("pasa los params de la ruta al handler", async () => {
    const handler = apiHandler(async (_req, ctx) => NextResponse.json({ id: ctx.params.id }), {
      requireAuth: true,
    });
    const res = await handler(new NextRequest("http://localhost/api/canchas/abc"), params({ id: "abc" }));
    expect(await res.json()).toEqual({ id: "abc" });
  });

  it("rechaza escrituras sin token CSRF", async () => {
    const handler = apiHandler(async () => NextResponse.json({ ok: true }), { requireAuth: true });
    const res = await handler(
      new NextRequest("http://localhost/api/canchas/abc", { method: "PUT" }),
      params({ id: "abc" })
    );
    expect(res.status).toBe(403);
  });

  it("acepta escrituras cuando el header coincide con la cookie", async () => {
    const handler = apiHandler(async () => NextResponse.json({ ok: true }), { requireAuth: true });
    const req = new NextRequest("http://localhost/api/canchas/abc", {
      method: "PUT",
      headers: { cookie: "csrf_token=tok", "X-CSRF-Token": "tok" },
    });
    const res = await handler(req, params({ id: "abc" }));
    expect(res.status).toBe(200);
  });

  it("rechaza un rol distinto al requerido", async () => {
    const handler = apiHandler(async () => NextResponse.json({ ok: true }), {
      requireAuth: true,
      requiredRole: "OWNER",
    });
    const res = await handler(new NextRequest("http://localhost/api/canchas/abc"), params({ id: "abc" }));
    expect(res.status).toBe(403);
  });
});
