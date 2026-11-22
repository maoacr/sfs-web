// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  jwtVerify: vi.fn(),
  usuarioFindFirst: vi.fn(),
  signedUrlFor: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.get }) }));
vi.mock("jose", () => ({ jwtVerify: mocks.jwtVerify }));

vi.mock("@sfs/db", () => ({
  db: { query: { usuarios: { findFirst: mocks.usuarioFindFirst } } },
  usuarios: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({ eq: (columna: unknown, valor: unknown) => ({ eq: [columna, valor] }) }));

vi.mock("@/lib/storage", () => ({
  signedUrlFor: mocks.signedUrlFor,
  AVATAR_URL_TTL_SEGUNDOS: 3600,
}));

import { usuarioDeSesion } from "@/lib/usuario-de-sesion";

const USUARIO = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockReturnValue({ value: "jwt-valido" });
  mocks.jwtVerify.mockResolvedValue({ payload: { sub: USUARIO, role: "OWNER" } });
  mocks.usuarioFindFirst.mockResolvedValue({
    nombre: "Mario Alejandro",
    apellido: "Crespo",
    avatarUrl: null,
  });
  mocks.signedUrlFor.mockResolvedValue(null);
});

describe("usuarioDeSesion", () => {
  it("devuelve nombre e iniciales reales para pintar el avatar", async () => {
    const usuario = await usuarioDeSesion();

    expect(usuario).toEqual({
      nombre: "Mario Alejandro Crespo",
      iniciales: "MC",
      avatarUrl: null,
    });
  });

  it("firma la ruta guardada cuando el usuario tiene foto", async () => {
    mocks.usuarioFindFirst.mockResolvedValue({
      nombre: "Mario",
      apellido: "Crespo",
      avatarUrl: `usuarios/${USUARIO}/1700000000-ab12cd.webp`,
    });
    mocks.signedUrlFor.mockResolvedValue("https://cdn.sfs.test/firmada?token=abc");

    const usuario = await usuarioDeSesion();

    expect(mocks.signedUrlFor).toHaveBeenCalledWith(
      `usuarios/${USUARIO}/1700000000-ab12cd.webp`,
      3600
    );
    expect(usuario?.avatarUrl).toBe("https://cdn.sfs.test/firmada?token=abc");
  });

  it("devuelve null sin consultar la base si no hay cookie de sesión", async () => {
    mocks.get.mockReturnValue(undefined);

    expect(await usuarioDeSesion()).toBeNull();
    expect(mocks.usuarioFindFirst).not.toHaveBeenCalled();
  });

  it("devuelve null si el token no verifica, en vez de reventar el layout", async () => {
    mocks.jwtVerify.mockRejectedValue(new Error("firma inválida"));

    expect(await usuarioDeSesion()).toBeNull();
  });

  it("devuelve null si el usuario del token ya no existe en la base", async () => {
    mocks.usuarioFindFirst.mockResolvedValue(undefined);

    expect(await usuarioDeSesion()).toBeNull();
  });

  it("no expone la ruta interna del storage, sólo la URL firmada", async () => {
    const rutaInterna = `usuarios/${USUARIO}/1700000000-ab12cd.webp`;
    mocks.usuarioFindFirst.mockResolvedValue({
      nombre: "Mario",
      apellido: "Crespo",
      avatarUrl: rutaInterna,
    });
    mocks.signedUrlFor.mockResolvedValue("https://cdn.sfs.test/firmada?token=abc");

    expect(JSON.stringify(await usuarioDeSesion())).not.toContain(rutaInterna);
  });
});
