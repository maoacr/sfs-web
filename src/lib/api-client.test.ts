import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiFetch } from "@/lib/api-client";

function borrarCookieCsrf() {
  document.cookie = "csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
}

describe("apiFetch", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    borrarCookieCsrf();
    fetchMock.mockReset().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("no agrega el token en métodos seguros", async () => {
    document.cookie = "csrf_token=abc; path=/";
    await apiFetch("/api/reservas");
    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init?.headers).has("X-CSRF-Token")).toBe(false);
  });

  it("agrega el token de la cookie en métodos que escriben, sin perder otros headers", async () => {
    document.cookie = "csrf_token=abc; path=/";
    await apiFetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const [url, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(url).toBe("/api/auth/me");
    expect(headers.get("X-CSRF-Token")).toBe("abc");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("sin cookie, primero la obtiene de /api/auth/me", async () => {
    fetchMock.mockImplementationOnce(async () => {
      document.cookie = "csrf_token=nuevo; path=/";
      return new Response("{}");
    });
    await apiFetch("/api/complejos", { method: "POST", body: "{}" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/me");
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/complejos");
    expect(new Headers(init.headers).get("X-CSRF-Token")).toBe("nuevo");
  });
});
