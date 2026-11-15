import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RecuperarPage from "./page";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        mensaje: "Si ese email tiene una cuenta, te mandamos un link para restablecer tu contraseña.",
      }),
    }))
  );
});

const pedir = () => fireEvent.click(screen.getByRole("button", { name: /mandarme el link/i }));

describe("RecuperarPage", () => {
  it("pide el email", () => {
    render(<RecuperarPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it("manda el email al endpoint", async () => {
    render(<RecuperarPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "jugador@gmail.com" },
    });
    pedir();

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [ruta, opciones] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(ruta).toBe("/api/auth/recuperar");
    expect(JSON.parse((opciones as { body: string }).body)).toEqual({
      email: "jugador@gmail.com",
    });
  });

  /**
   * La pantalla repite el mensaje del servidor y no dice si la cuenta existe:
   * decirlo filtraría por la interfaz lo que el endpoint se cuida de no
   * filtrar.
   */
  it("repite el mensaje genérico del servidor, sin confirmar si la cuenta existe", async () => {
    render(<RecuperarPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "noexiste@gmail.com" },
    });
    pedir();

    expect(await screen.findByText(/si ese email tiene una cuenta/i)).toBeInTheDocument();
    expect(screen.queryByText(/no está registrado/i)).not.toBeInTheDocument();
  });
});
