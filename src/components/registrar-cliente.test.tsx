import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RegistrarCliente } from "@/components/registrar-cliente";

const apiFetch = vi.fn();
vi.mock("@/lib/api-client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...(a as [])) }));

function montar(nombreTipeado = "") {
  const onRegistrado = vi.fn();
  const onCerrar = vi.fn();
  render(
    <RegistrarCliente nombreTipeado={nombreTipeado} onCerrar={onCerrar} onRegistrado={onRegistrado} />
  );
  return { onRegistrado, onCerrar };
}

const cuerpoEnviado = () => {
  const [, opciones] = apiFetch.mock.calls[0] as unknown as [string, { body: string }];
  return JSON.parse(opciones.body);
};

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ id: "cliente-nuevo", primerNombre: "Pedro", apellidos: "Gómez", telefono: null, saldoPendiente: 0 }),
  });
});

describe("RegistrarCliente", () => {
  it("aprovecha lo que el dueño ya tipeó en vez de hacerlo escribir de nuevo", () => {
    montar("Pedro Gómez");

    expect(screen.getByLabelText(/^nombre/i)).toHaveValue("Pedro");
    expect(screen.getByLabelText(/apellidos/i)).toHaveValue("Gómez");
  });

  it("con un solo nombre tipeado no inventa un apellido", () => {
    montar("Pedro");

    expect(screen.getByLabelText(/^nombre/i)).toHaveValue("Pedro");
    expect(screen.getByLabelText(/apellidos/i)).toHaveValue("");
  });

  it("alcanza con nombre y apellido: el email no es obligatorio", async () => {
    montar("Pedro Gómez");

    fireEvent.click(screen.getByRole("button", { name: /registrar/i }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(cuerpoEnviado()).toMatchObject({ primerNombre: "Pedro", apellidos: "Gómez" });
    expect(cuerpoEnviado().email).toBeUndefined();
  });

  it("explica para qué sirve el email, en vez de pedirlo sin motivo", () => {
    montar("Pedro Gómez");

    const ayuda = screen.getByText(/google/i);
    expect(ayuda).toBeInTheDocument();
    // Y que no pedirlo también es una opción válida, no una falta.
    expect(ayuda).toHaveTextContent(/sin email/i);
  });

  it("manda el email y el teléfono cuando los hay", async () => {
    montar("Pedro Gómez");
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "pedro@gmail.com" } });
    fireEvent.change(screen.getByLabelText(/teléfono/i), { target: { value: "3001234567" } });

    fireEvent.click(screen.getByRole("button", { name: /registrar/i }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(cuerpoEnviado()).toMatchObject({ email: "pedro@gmail.com", telefono: "3001234567" });
  });

  it("sin apellido no deja registrar: la reserva no se podría leer", async () => {
    montar("Pedro");

    fireEvent.click(screen.getByRole("button", { name: /registrar/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("devuelve el cliente creado para que la reserva quede vinculada", async () => {
    const { onRegistrado } = montar("Pedro Gómez");

    fireEvent.click(screen.getByRole("button", { name: /registrar/i }));

    await waitFor(() => expect(onRegistrado).toHaveBeenCalled());
    expect(onRegistrado.mock.calls[0][0]).toMatchObject({ id: "cliente-nuevo", saldoPendiente: 0 });
  });

  it("muestra el error del servidor en vez de tragárselo", async () => {
    apiFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Ese email ya tiene una cuenta en SFS." }),
    });
    montar("Pedro Gómez");

    fireEvent.click(screen.getByRole("button", { name: /registrar/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/ya tiene una cuenta/i));
  });

  it("los datos de más no estorban: están, pero plegados", () => {
    montar("Pedro Gómez");

    expect(screen.queryByLabelText(/instagram/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /más datos/i }));
    expect(screen.getByLabelText(/instagram/i)).toBeInTheDocument();
  });
});
