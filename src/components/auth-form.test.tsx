import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// El formulario importa el cliente de Supabase sólo para el botón de Google.
// No es lo que se prueba acá, pero sin esto el módulo revienta al cargar.
vi.mock("@/lib/supabase-browser", () => ({
  getSupabaseBrowser: () => ({ auth: { signInWithOAuth: vi.fn() } }),
}));

import { AuthForm } from "@/components/auth-form";

const campo = (nombre: RegExp) => screen.getByLabelText(nombre) as HTMLInputElement;

/** `fireEvent` alcanza: todos los inputs del formulario son controlados. */
const escribir = (nombre: RegExp, valor: string) =>
  fireEvent.change(campo(nombre), { target: { value: valor } });

const enviar = () =>
  fireEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));

/**
 * El registro marca `required` también en primer nombre y apellidos. Sin
 * llenarlos, la validación nativa del form bloquea el submit y `handleSubmit`
 * nunca corre — el test mediría el browser, no nuestro código.
 */
function completarRegistro(password: string, confirmacion: string) {
  escribir(/primer nombre/i, "Mario");
  escribir(/apellidos/i, "Crespo");
  escribir(/^email$/i, "jugador@gmail.com");
  escribir(/^contraseña$/i, password);
  escribir(/repetir contraseña/i, confirmacion);
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ user: { role: "PLAYER" } }) }))
  );
  // El submit exitoso navega; en jsdom eso no se puede hacer, así que se
  // reemplaza la asignación por un espía.
  Object.defineProperty(window, "location", {
    value: { href: "", origin: "http://localhost:3000" },
    writable: true,
  });
});

describe("AuthForm — ver la contraseña", () => {
  it("empieza enmascarada", () => {
    render(<AuthForm mode="register" />);
    expect(campo(/^contraseña$/i).type).toBe("password");
  });

  it("el botón la revela y la vuelve a ocultar", async () => {
    render(<AuthForm mode="register" />);

    fireEvent.click(screen.getAllByRole("button", { name: /mostrar contraseña/i })[0]);
    expect(campo(/^contraseña$/i).type).toBe("text");

    fireEvent.click(screen.getAllByRole("button", { name: /ocultar contraseña/i })[0]);
    expect(campo(/^contraseña$/i).type).toBe("password");
  });

  it("también está disponible en el login", () => {
    render(<AuthForm mode="login" />);
    expect(screen.getByRole("button", { name: /mostrar contraseña/i })).toBeInTheDocument();
  });
});

describe("AuthForm — confirmación de contraseña", () => {
  it("el login no pide confirmación", () => {
    render(<AuthForm mode="login" />);
    expect(screen.queryByLabelText(/repetir contraseña/i)).not.toBeInTheDocument();
  });

  it("el registro sí la pide", () => {
    render(<AuthForm mode="register" />);
    expect(screen.getByLabelText(/repetir contraseña/i)).toBeInTheDocument();
  });

  /**
   * Lo que de verdad importa: si no coinciden, la request NO sale. Sin esto
   * el usuario se registraría con una contraseña que no es la que cree.
   */
  it("no manda nada al servidor si las dos no coinciden", async () => {
    render(<AuthForm mode="register" />);

    completarRegistro("unaclavelarga", "unaclavedistinta");
    enviar();

    expect(await screen.findByText(/no coinciden/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("manda la request cuando coinciden", async () => {
    render(<AuthForm mode="register" />);

    completarRegistro("unaclavelarga", "unaclavelarga");
    enviar();

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/auth/register", expect.anything())
    );
  });

  /**
   * La confirmación es una verificación del formulario, no una regla del
   * dominio: `/api/auth/register` sólo conoce `password`.
   */
  it("no incluye la confirmación en el body", async () => {
    render(<AuthForm mode="register" />);

    completarRegistro("unaclavelarga", "unaclavelarga");
    enviar();

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [, opciones] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const enviado = JSON.parse((opciones as { body: string }).body);
    expect(enviado).not.toHaveProperty("confirmacion");
    expect(enviado.password).toBe("unaclavelarga");
  });
});
