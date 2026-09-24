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

  it("rechaza un rol distinto al requerido", async () => {
    const handler = apiHandler(async () => NextResponse.json({ ok: true }), {
      requireAuth: true,
      requiredRole: "OWNER",
    });
    const res = await handler(new NextRequest("http://localhost/api/canchas/abc"), params({ id: "3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b" }));
    expect(res.status).toBe(403);
  });
});
