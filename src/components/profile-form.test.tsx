import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: vi.fn() }) }));
vi.mock("@/lib/api-client", () => ({ apiFetch: mocks.apiFetch }));

import { ProfileForm } from "@/components/profile-form";
import { TAMANO_MAXIMO_DE_IMAGEN_BYTES } from "@/lib/imagenes";

const USUARIO = {
  id: "44444444-4444-4444-8444-444444444444",
  email: "o@sfs.test",
  primerNombre: "Mario",
  segundoNombre: null,
  apellidos: "Crespo",
  apodo: "mao",
  telefono: "3001234567",
  codigoPais: "+57",
  role: "OWNER" as const,
  instagram: null,
  tiktok: null,
  twitter: null,
  facebook: null,
  avatarUrl: null as string | null,
};

function stubDeCarga(user: typeof USUARIO) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("/api/auth/me")) {
        return { ok: true, json: async () => ({ user }) };
      }
      return { ok: true, json: async () => ({ canchas: 2, clientes: 5 }) };
    })
  );
}

function archivoDeImagen(): File {
  return new File([new Uint8Array([1, 2, 3])], "perfil.jpg", { type: "image/jpeg" });
}

const inputDeFoto = () => screen.getByLabelText(/foto de perfil/i) as HTMLInputElement;

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.apiFetch.mockReset();
  stubDeCarga(USUARIO);
});

describe("ProfileForm — foto de perfil", () => {
  it("muestra las iniciales mientras el usuario no tiene foto", async () => {
    render(<ProfileForm />);

    expect(await screen.findByText("MC")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /foto de perfil/i })).not.toBeInTheDocument();
  });

  it("muestra la foto cuando el perfil ya tiene una", async () => {
    stubDeCarga({ ...USUARIO, avatarUrl: "https://cdn.sfs.test/firmada?token=abc" });

    render(<ProfileForm />);

    const foto = await screen.findByRole("img", { name: /foto de perfil/i });
    expect(foto).toHaveAttribute("src", "https://cdn.sfs.test/firmada?token=abc");
  });

  it("sube el archivo elegido al endpoint de avatar como multipart", async () => {
    mocks.apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ avatarUrl: "https://cdn.sfs.test/nueva?token=xyz" }),
    });
    render(<ProfileForm />);
    await screen.findByText("MC");

    fireEvent.change(inputDeFoto(), { target: { files: [archivoDeImagen()] } });

    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalled());
    const [url, opciones] = mocks.apiFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth/me/avatar");
    expect(opciones.method).toBe("POST");
    expect(opciones.body).toBeInstanceOf(FormData);
    expect((opciones.body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("muestra la foto nueva sin recargar la página", async () => {
    mocks.apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ avatarUrl: "https://cdn.sfs.test/nueva?token=xyz" }),
    });
    render(<ProfileForm />);
    await screen.findByText("MC");

    fireEvent.change(inputDeFoto(), { target: { files: [archivoDeImagen()] } });

    const foto = await screen.findByRole("img", { name: /foto de perfil/i });
    expect(foto).toHaveAttribute("src", "https://cdn.sfs.test/nueva?token=xyz");
  });

  it("avisa al usuario cuando el servidor rechaza la imagen", async () => {
    mocks.apiFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "El archivo debe ser una imagen" }),
    });
    render(<ProfileForm />);
    await screen.findByText("MC");

    fireEvent.change(inputDeFoto(), { target: { files: [archivoDeImagen()] } });

    expect(await screen.findByText(/el archivo debe ser una imagen/i)).toBeInTheDocument();
  });

  it("rechaza en el cliente una imagen que pasa el máximo, sin llamar al servidor", async () => {
    render(<ProfileForm />);
    await screen.findByText("MC");

    const gigante = archivoDeImagen();
    Object.defineProperty(gigante, "size", { value: TAMANO_MAXIMO_DE_IMAGEN_BYTES + 1 });
    fireEvent.change(inputDeFoto(), { target: { files: [gigante] } });

    expect(await screen.findByText(/no debe superar 10MB/i)).toBeInTheDocument();
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("rechaza en el cliente un archivo que no es imagen, sin llamar al servidor", async () => {
    render(<ProfileForm />);
    await screen.findByText("MC");

    const pdf = new File([new Uint8Array([1])], "cv.pdf", { type: "application/pdf" });
    fireEvent.change(inputDeFoto(), { target: { files: [pdf] } });

    expect(await screen.findByText(/solo se permiten imágenes/i)).toBeInTheDocument();
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });
});
