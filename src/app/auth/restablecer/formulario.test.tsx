import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FormularioRestablecer } from "./formulario";

const TOKEN = "un.token.cualquiera";

const campo = (nombre: RegExp) => screen.getByLabelText(nombre) as HTMLInputElement;
const escribir = (nombre: RegExp, valor: string) =>
  fireEvent.change(campo(nombre), { target: { value: valor } });
const guardar = () => fireEvent.click(screen.getByRole("button", { name: /guardar contraseña/i }));

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ mensaje: "Listo" }) }))
  );
});

describe("FormularioRestablecer", () => {
  it("pide otro link si el token no vino en la URL", () => {
    render(<FormularioRestablecer token="" />);

    expect(screen.getByText(/link incompleto/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/contraseña nueva/i)).not.toBeInTheDocument();
  });

  it("muestra el formulario cuando hay token", () => {
    render(<FormularioRestablecer token={TOKEN} />);

    expect(campo(/contraseña nueva/i).type).toBe("password");
    expect(screen.getByLabelText(/repetir contraseña/i)).toBeInTheDocument();
  });

  it("deja ver la contraseña, igual que en el registro", () => {
    render(<FormularioRestablecer token={TOKEN} />);

    fireEvent.click(screen.getAllByRole("button", { name: /mostrar contraseña/i })[0]);
    expect(campo(/contraseña nueva/i).type).toBe("text");
  });

  it("no manda nada si las dos no coinciden", async () => {
    render(<FormularioRestablecer token={TOKEN} />);

    escribir(/contraseña nueva/i, "unaclavelarga");
    escribir(/repetir contraseña/i, "otraclavelarga");
    guardar();

    expect(await screen.findByText(/no coinciden/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("manda el token junto con la contraseña nueva", async () => {
    render(<FormularioRestablecer token={TOKEN} />);

    escribir(/contraseña nueva/i, "unaclavelarga");
    escribir(/repetir contraseña/i, "unaclavelarga");
    guardar();

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [ruta, opciones] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(ruta).toBe("/api/auth/restablecer");
    expect(JSON.parse((opciones as { body: string }).body)).toEqual({
      token: TOKEN,
      password: "unaclavelarga",
    });
  });

  it("al terminar invita a iniciar sesión, sin dejar la sesión abierta", async () => {
    render(<FormularioRestablecer token={TOKEN} />);

    escribir(/contraseña nueva/i, "unaclavelarga");
    escribir(/repetir contraseña/i, "unaclavelarga");
    guardar();

    expect(await screen.findByText(/contraseña actualizada/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it("muestra el motivo que manda el servidor cuando el link ya no sirve", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({ error: "Este link ya no sirve." }) }))
    );
    render(<FormularioRestablecer token={TOKEN} />);

    escribir(/contraseña nueva/i, "unaclavelarga");
    escribir(/repetir contraseña/i, "unaclavelarga");
    guardar();

    expect(await screen.findByText(/ya no sirve/i)).toBeInTheDocument();
  });
});
