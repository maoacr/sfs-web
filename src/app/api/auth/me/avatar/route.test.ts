// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  usuarioFindFirst: vi.fn(),
  valoresDelUpdate: vi.fn(),
  uploadPrivateImage: vi.fn(),
  signedUrlFor: vi.fn(),
  deletePrivateImage: vi.fn(),
  TAMANO_MAXIMO_DE_IMAGEN_BYTES: 10 * 1024 * 1024,
}));

vi.mock("@/lib/auth-api", async () => {
  const real = await vi.importActual<typeof import("@/lib/auth-api")>("@/lib/auth-api");
  return { ...real, getAuthUser: mocks.getAuthUser };
});

vi.mock("@sfs/db", () => ({
  db: {
    query: { usuarios: { findFirst: mocks.usuarioFindFirst } },
    update: () => ({
      set: (valores: Record<string, unknown>) => {
        mocks.valoresDelUpdate(valores);
        return { where: async () => undefined };
      },
    }),
  },
  usuarios: { id: "id", avatarUrl: "avatar_url" },
}));

vi.mock("drizzle-orm", () => ({ eq: (columna: unknown, valor: unknown) => ({ eq: [columna, valor] }) }));

vi.mock("@/lib/storage", () => ({
  uploadPrivateImage: mocks.uploadPrivateImage,
  signedUrlFor: mocks.signedUrlFor,
  deletePrivateImage: mocks.deletePrivateImage,
  AVATAR_URL_TTL_SEGUNDOS: 3600,
}));

import { AuthError } from "@/lib/auth-api";
import { POST } from "./route";

const USUARIO = "44444444-4444-4444-8444-444444444444";

let contadorDeIp = 0;
function peticionConArchivo(file: File | null): NextRequest {
  contadorDeIp += 1;
  const formData = new FormData();
  if (file) formData.append("file", file);

  return new NextRequest("http://localhost/api/auth/me/avatar", {
    method: "POST",
    headers: {
      "x-forwarded-for": `10.9.0.${contadorDeIp}`,
      "x-csrf-token": "token-csrf",
      cookie: "csrf_token=token-csrf",
    },
    body: formData,
  });
}

function imagen(): File {
  return new File([new Uint8Array([1, 2, 3])], "perfil.jpg", { type: "image/jpeg" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthUser.mockResolvedValue({ sub: USUARIO, email: "o@sfs.test", role: "OWNER" });
  mocks.usuarioFindFirst.mockResolvedValue({ avatarUrl: null });
  mocks.uploadPrivateImage.mockResolvedValue(`usuarios/${USUARIO}/1700000000-ab12cd.webp`);
  mocks.signedUrlFor.mockResolvedValue("https://cdn.sfs.test/firmada?token=abc");
  mocks.deletePrivateImage.mockResolvedValue(undefined);
});

describe("POST /api/auth/me/avatar", () => {
  it("sube al bucket privado con el preset profile, en la carpeta del usuario", async () => {
    const response = await POST(peticionConArchivo(imagen()), { params: Promise.resolve({}) });

    expect(response.status).toBe(201);
    expect(mocks.uploadPrivateImage).toHaveBeenCalledWith(
      expect.any(File),
      `usuarios/${USUARIO}`,
      "profile"
    );
  });

  it("persiste la RUTA en avatarUrl, no la URL firmada: la firmada vence", async () => {
    await POST(peticionConArchivo(imagen()), { params: Promise.resolve({}) });

    expect(mocks.valoresDelUpdate).toHaveBeenCalledWith({
      avatarUrl: `usuarios/${USUARIO}/1700000000-ab12cd.webp`,
    });
  });

  it("devuelve una URL firmada para que el navegador pueda mostrar la foto", async () => {
    const response = await POST(peticionConArchivo(imagen()), { params: Promise.resolve({}) });

    expect(await response.json()).toEqual({ avatarUrl: "https://cdn.sfs.test/firmada?token=abc" });
  });

  it("borra la foto anterior cuando el usuario ya tenía una", async () => {
    mocks.usuarioFindFirst.mockResolvedValue({ avatarUrl: `usuarios/${USUARIO}/vieja.webp` });

    await POST(peticionConArchivo(imagen()), { params: Promise.resolve({}) });

    expect(mocks.deletePrivateImage).toHaveBeenCalledWith(`usuarios/${USUARIO}/vieja.webp`);
  });

  it("no intenta borrar nada en la primera foto del usuario", async () => {
    await POST(peticionConArchivo(imagen()), { params: Promise.resolve({}) });

    expect(mocks.deletePrivateImage).not.toHaveBeenCalled();
  });

  it("rechaza con 400 si no viene archivo", async () => {
    const response = await POST(peticionConArchivo(null), { params: Promise.resolve({}) });

    expect(response.status).toBe(400);
    expect(mocks.uploadPrivateImage).not.toHaveBeenCalled();
  });

  it("rechaza con 400 un archivo que no es imagen", async () => {
    const pdf = new File([new Uint8Array([1])], "cv.pdf", { type: "application/pdf" });

    const response = await POST(peticionConArchivo(pdf), { params: Promise.resolve({}) });

    expect(response.status).toBe(400);
    expect(mocks.uploadPrivateImage).not.toHaveBeenCalled();
  });

  it("rechaza con 400 una imagen más grande que el máximo, antes de pasarla a sharp", async () => {
    const gigante = new File([new Uint8Array(mocks.TAMANO_MAXIMO_DE_IMAGEN_BYTES + 1024)], "enorme.jpg", {
      type: "image/jpeg",
    });

    const response = await POST(peticionConArchivo(gigante), { params: Promise.resolve({}) });

    expect(response.status).toBe(400);
    expect(mocks.uploadPrivateImage).not.toHaveBeenCalled();
  });

  it("acepta una imagen justo por debajo del máximo", async () => {
    const alLimite = new File([new Uint8Array(mocks.TAMANO_MAXIMO_DE_IMAGEN_BYTES - 1024)], "grande.jpg", {
      type: "image/jpeg",
    });

    const response = await POST(peticionConArchivo(alLimite), { params: Promise.resolve({}) });

    expect(response.status).toBe(201);
    expect(mocks.uploadPrivateImage).toHaveBeenCalled();
  });

  it("no guarda nada si el usuario no está autenticado", async () => {
    // getAuthUser no devuelve null: lanza AuthError. Ese es el contrato que
    // apiHandler traduce a una respuesta HTTP.
    mocks.getAuthUser.mockRejectedValue(new AuthError("No autenticado", 401));

    const response = await POST(peticionConArchivo(imagen()), { params: Promise.resolve({}) });

    expect(response.status).toBe(401);
    expect(mocks.valoresDelUpdate).not.toHaveBeenCalled();
  });
});
