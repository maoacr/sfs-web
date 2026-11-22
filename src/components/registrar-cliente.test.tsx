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

describe("RegistrarCliente — el email ya tiene cuenta", () => {
  const CONFLICTO = {
    ok: false,
    json: async () => ({
      error: "Ese email ya tiene una cuenta en SFS.",
      clienteExistente: { id: "ya-existe", primerNombre: "Pedro", saldoPendiente: 0 },
    }),
  };

  async function chocarConCuentaExistente() {
    apiFetch.mockResolvedValue(CONFLICTO);
    const handlers = montar("Pedro Gómez");
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "pedro@gmail.com" } });
    fireEvent.click(screen.getByRole("button", { name: /^registrar$/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    return handlers;
  }

  it("ofrece usar esa cuenta en vez de dejar un error muerto", async () => {
    await chocarConCuentaExistente();

    expect(screen.getByRole("button", { name: /usar esa cuenta/i })).toBeInTheDocument();
  });

  it("muestra el email y el primer nombre, para confirmar que es quien está enfrente", async () => {
    await chocarConCuentaExistente();

    const aviso = screen.getByRole("alert");
    expect(aviso).toHaveTextContent(/pedro/i);
    expect(aviso).toHaveTextContent(/pedro@gmail\.com/);
  });

  it("al aceptar, la reserva se vincula a ESA cuenta y no se crea una segunda", async () => {
    const { onRegistrado } = await chocarConCuentaExistente();

    fireEvent.click(screen.getByRole("button", { name: /usar esa cuenta/i }));

    expect(onRegistrado).toHaveBeenCalledTimes(1);
    expect(onRegistrado.mock.calls[0][0]).toMatchObject({ id: "ya-existe", primerNombre: "Pedro" });
    // Un solo POST: el del intento que chocó. No se insiste ni se duplica.
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it("si esa cuenta debe plata, lo dice antes de vincularla", async () => {
    apiFetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: "Ese email ya tiene una cuenta en SFS.",
        clienteExistente: { id: "ya-existe", primerNombre: "Pedro", saldoPendiente: 40000 },
      }),
    });
    montar("Pedro Gómez");
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "pedro@gmail.com" } });
    fireEvent.click(screen.getByRole("button", { name: /^registrar$/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/40\.000/));
  });

  it("y el saldo viaja al modal, que es quien bloquea la reserva", async () => {
    apiFetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: "Ese email ya tiene una cuenta en SFS.",
        clienteExistente: { id: "ya-existe", primerNombre: "Pedro", saldoPendiente: 40000 },
      }),
    });
    const { onRegistrado } = montar("Pedro Gómez");
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "pedro@gmail.com" } });
    fireEvent.click(screen.getByRole("button", { name: /^registrar$/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /usar esa cuenta/i }));

    expect(onRegistrado.mock.calls[0][0].saldoPendiente).toBe(40000);
  });

  it("un error común sigue siendo un error, sin ofrecer cuentas", async () => {
    apiFetch.mockResolvedValue({ ok: false, json: async () => ({ error: "Apodo inválido" }) });
    montar("Pedro Gómez");

    fireEvent.click(screen.getByRole("button", { name: /^registrar$/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/apodo inválido/i));
    expect(screen.queryByRole("button", { name: /usar esa cuenta/i })).not.toBeInTheDocument();
  });
});
