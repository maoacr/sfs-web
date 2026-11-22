// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  usuarioFindFirst: vi.fn(),
  signedUrlFor: vi.fn(),
}));

vi.mock("@/lib/auth-api", async () => {
  const real = await vi.importActual<typeof import("@/lib/auth-api")>("@/lib/auth-api");
  return { ...real, getAuthUser: mocks.getAuthUser };
});

vi.mock("@sfs/db", () => ({
  db: { query: { usuarios: { findFirst: mocks.usuarioFindFirst } } },
  usuarios: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({ eq: (columna: unknown, valor: unknown) => ({ eq: [columna, valor] }) }));

vi.mock("@/lib/storage", () => ({
  signedUrlFor: mocks.signedUrlFor,
  AVATAR_URL_TTL_SEGUNDOS: 3600,
}));

import { GET } from "./route";

const USUARIO = "44444444-4444-4444-8444-444444444444";

let contadorDeIp = 0;
function peticion(): NextRequest {
  contadorDeIp += 1;
  return new NextRequest("http://localhost/api/auth/me", {
    method: "GET",
    headers: { "x-forwarded-for": `10.11.0.${contadorDeIp}` },
  });
}

function filaDeUsuario(over: Record<string, unknown> = {}) {
  return {
    id: USUARIO,
    email: "o@sfs.test",
    nombre: "Mario Alejandro",
    apellido: "Crespo",
    apodo: "mao",
    telefono: "3001234567",
    codigoPais: "+57",
    rol: "OWNER",
    instagram: null,
    tiktok: null,
    twitter: null,
    facebook: null,
    avatarUrl: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthUser.mockResolvedValue({ sub: USUARIO, email: "o@sfs.test", role: "OWNER" });
  mocks.usuarioFindFirst.mockResolvedValue(filaDeUsuario());
  mocks.signedUrlFor.mockResolvedValue(null);
});

describe("GET /api/auth/me — foto de perfil", () => {
  it("firma la ruta guardada y devuelve la URL para mostrar la foto", async () => {
    mocks.usuarioFindFirst.mockResolvedValue(
      filaDeUsuario({ avatarUrl: `usuarios/${USUARIO}/1700000000-ab12cd.webp` })
    );
    mocks.signedUrlFor.mockResolvedValue("https://cdn.sfs.test/firmada?token=abc");

    const response = await GET(peticion(), { params: Promise.resolve({}) });
    const { user } = await response.json();

    expect(mocks.signedUrlFor).toHaveBeenCalledWith(
      `usuarios/${USUARIO}/1700000000-ab12cd.webp`,
      3600
    );
    expect(user.avatarUrl).toBe("https://cdn.sfs.test/firmada?token=abc");
  });

  it("devuelve avatarUrl null para un usuario que nunca subió foto", async () => {
    const response = await GET(peticion(), { params: Promise.resolve({}) });
    const { user } = await response.json();

    expect(user.avatarUrl).toBeNull();
    expect(user.email).toBe("o@sfs.test");
  });

  it("no expone la ruta interna del storage, solo la URL firmada", async () => {
    const rutaInterna = `usuarios/${USUARIO}/1700000000-ab12cd.webp`;
    mocks.usuarioFindFirst.mockResolvedValue(filaDeUsuario({ avatarUrl: rutaInterna }));
    mocks.signedUrlFor.mockResolvedValue("https://cdn.sfs.test/firmada?token=abc");

    const response = await GET(peticion(), { params: Promise.resolve({}) });

    expect(JSON.stringify(await response.json())).not.toContain(rutaInterna);
  });
});
