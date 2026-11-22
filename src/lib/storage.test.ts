// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  bucketUsado: vi.fn(),
  upload: vi.fn(),
  createSignedUrl: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: () => ({
    storage: {
      from: (bucket: string) => {
        mocks.bucketUsado(bucket);
        return {
          upload: mocks.upload,
          createSignedUrl: mocks.createSignedUrl,
          remove: mocks.remove,
          getPublicUrl: (ruta: string) => ({
            data: { publicUrl: `https://cdn.sfs.test/storage/v1/object/public/canchas/${ruta}` },
          }),
        };
      },
    },
  }),
}));

vi.mock("sharp", () => {
  const encadenable = {
    resize: () => encadenable,
    webp: () => encadenable,
    rotate: () => encadenable,
    toBuffer: async () => Buffer.from("bytes-webp"),
  };
  return { default: () => encadenable };
});

import { uploadImage, uploadPrivateImage, signedUrlFor, deletePrivateImage } from "@/lib/storage";

function archivoDePrueba(): File {
  return new File([new Uint8Array([1, 2, 3])], "perfil.jpg", { type: "image/jpeg" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.upload.mockResolvedValue({ error: null });
  mocks.createSignedUrl.mockResolvedValue({
    data: { signedUrl: "https://cdn.sfs.test/firmada?token=abc" },
    error: null,
  });
  mocks.remove.mockResolvedValue({ error: null });
});

describe("uploadPrivateImage", () => {
  it("sube al bucket privado sfs, no al público", async () => {
    await uploadPrivateImage(archivoDePrueba(), "usuarios/u-1", "profile");

    expect(mocks.bucketUsado).toHaveBeenCalledWith("sfs");
    expect(mocks.bucketUsado).not.toHaveBeenCalledWith("canchas");
  });

  it("devuelve la ruta del objeto, nunca una URL: la firmada vence y no se puede persistir", async () => {
    const ruta = await uploadPrivateImage(archivoDePrueba(), "usuarios/u-1", "profile");

    expect(ruta).toMatch(/^usuarios\/u-1\/\d+-[a-z0-9]{6}\.webp$/);
    expect(ruta).not.toContain("http");
  });

  it("propaga el error de Supabase en vez de devolver una ruta inválida", async () => {
    mocks.upload.mockResolvedValue({ error: { message: "quota excedida" } });

    await expect(uploadPrivateImage(archivoDePrueba(), "usuarios/u-1", "profile"))
      .rejects.toThrow("quota excedida");
  });
});

describe("uploadImage (bucket público, comportamiento previo)", () => {
  it("sigue subiendo al bucket canchas y devuelve una URL pública", async () => {
    const url = await uploadImage(archivoDePrueba(), "canchas/c-1", "photo");

    expect(mocks.bucketUsado).toHaveBeenCalledWith("canchas");
    expect(url).toMatch(/^https:\/\/cdn\.sfs\.test\/storage\/v1\/object\/public\/canchas\/canchas\/c-1\/\d+-[a-z0-9]{6}\.webp$/);
  });
});

describe("signedUrlFor", () => {
  it("firma la ruta contra el bucket privado con el TTL indicado", async () => {
    const url = await signedUrlFor("usuarios/u-1/1700000000-ab12cd.webp", 3600);

    expect(mocks.bucketUsado).toHaveBeenCalledWith("sfs");
    expect(mocks.createSignedUrl).toHaveBeenCalledWith("usuarios/u-1/1700000000-ab12cd.webp", 3600);
    expect(url).toBe("https://cdn.sfs.test/firmada?token=abc");
  });

  it("devuelve null si Supabase no puede firmar: un perfil sin foto no es un error", async () => {
    mocks.createSignedUrl.mockResolvedValue({ data: null, error: { message: "not found" } });

    expect(await signedUrlFor("usuarios/u-1/no-existe.webp", 3600)).toBeNull();
  });

  it("devuelve null para una ruta vacía sin llamar a Supabase", async () => {
    expect(await signedUrlFor("", 3600)).toBeNull();
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });
});

describe("deletePrivateImage", () => {
  it("borra la ruta del bucket privado", async () => {
    await deletePrivateImage("usuarios/u-1/1700000000-ab12cd.webp");

    expect(mocks.bucketUsado).toHaveBeenCalledWith("sfs");
    expect(mocks.remove).toHaveBeenCalledWith(["usuarios/u-1/1700000000-ab12cd.webp"]);
  });

  it("no llama a Supabase si la ruta está vacía", async () => {
    await deletePrivateImage("");

    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
