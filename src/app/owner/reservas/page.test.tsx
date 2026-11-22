import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import OwnerReservas from "./page";

const apiFetch = vi.fn();
vi.mock("@/lib/api-client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...(a as [])) }));

function reserva(over: Record<string, unknown> = {}) {
  return {
    id: "reserva-1",
    cancha: { nombre: "Cancha 1", tipo: "FUTBOL_5", complejo: { nombre: "Norte", zonaHoraria: "America/Bogota" } },
    player: { primerNombre: "Juan", apellidos: "Pérez", apodo: null, telefono: "3001234567" },
    slotInicio: "2026-11-18T02:00:00.000Z",
    slotFin: "2026-11-18T03:00:00.000Z",
    montoTotal: 160000,
    montoPagado: 160000,
    saldoPendiente: 0,
    estado: "CONFIRMADA",
    ...over,
  };
}

function montarCon(lista: unknown[]) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
    ok: true,
    json: async () => (url.includes("/api/complejos") ? [] : lista),
  })));
  return render(<OwnerReservas />);
}

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
});

describe("OwnerReservas — acciones sobre una reserva", () => {
  it("las acciones dicen qué hacen, no son un símbolo suelto", async () => {
    montarCon([reserva()]);

    expect(await screen.findByRole("button", { name: /marcar.*jugada/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeInTheDocument();
  });

  it("cada acción dice sobre qué reserva actúa", async () => {
    montarCon([reserva()]);

    expect(await screen.findByRole("button", { name: /marcar.*jugada/i }))
      .toHaveAccessibleName(/juan pérez/i);
  });

  it("marcar como jugada no pide confirmación: no es destructivo", async () => {
    montarCon([reserva()]);

    fireEvent.click(await screen.findByRole("button", { name: /marcar.*jugada/i }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const [, opciones] = apiFetch.mock.calls[0] as unknown as [string, { body: string }];
    expect(JSON.parse(opciones.body)).toEqual({ estado: "COMPLETADA" });
  });

  it("cancelar SÍ pide confirmación antes de tocar nada", async () => {
    montarCon([reserva()]);

    fireEvent.click(await screen.findByRole("button", { name: /cancelar/i }));

    expect(apiFetch).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("al confirmar, cancela", async () => {
    montarCon([reserva()]);

    fireEvent.click(await screen.findByRole("button", { name: /cancelar/i }));
    const dialogo = within(screen.getByRole("dialog"));
    fireEvent.click(dialogo.getByRole("button", { name: /sí, cancelar/i }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const [, opciones] = apiFetch.mock.calls[0] as unknown as [string, { body: string }];
    expect(JSON.parse(opciones.body)).toEqual({ estado: "CANCELADA" });
  });

  it("avisa que hay plata de por medio antes de cancelar", async () => {
    montarCon([reserva({ montoPagado: 160000 })]);

    fireEvent.click(await screen.findByRole("button", { name: /cancelar/i }));

    expect(within(screen.getByRole("dialog")).getByText(/reembols/i)).toBeInTheDocument();
  });

  it("una reserva ya jugada no se vuelve a marcar como jugada", async () => {
    montarCon([reserva({ estado: "COMPLETADA" })]);

    await screen.findByText(/cancha 1/i);
    expect(screen.queryByRole("button", { name: /marcar.*jugada/i })).not.toBeInTheDocument();
  });

  it("sobre una reserva cancelada no se ofrece ninguna acción", async () => {
    montarCon([reserva({ estado: "CANCELADA" })]);

    await screen.findByText(/cancha 1/i);
    expect(screen.queryByRole("button", { name: /marcar.*jugada/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^cancelar la reserva/i })).not.toBeInTheDocument();
  });

  it("una reserva con pago parcial también se puede marcar jugada", async () => {
    montarCon([reserva({ estado: "PAGO_PARCIAL", montoPagado: 80000, saldoPendiente: 80000 })]);

    expect(await screen.findByRole("button", { name: /marcar.*jugada/i })).toBeInTheDocument();
  });
});

describe("OwnerReservas — cliente de una reserva manual", () => {
  const CLIENTE = { id: "cliente-1", primerNombre: "Ana", apellidos: "Gómez", telefono: "3009999999" };

  const CANCHA_OPT = { id: "cancha-1", nombre: "Cancha 1", tipo: "FUTBOL_5" };

  function montarModal(clientes: unknown[] = []) {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes("/api/clientes") ? clientes : url.includes("/api/canchas") ? [CANCHA_OPT] : [],
    })));
    render(<OwnerReservas />);
    fireEvent.click(screen.getByRole("button", { name: /\+ Nueva/i }));
  }

  async function elegirCancha() {
    const select = await screen.findByLabelText(/cancha/i);
    fireEvent.change(select, { target: { value: "cancha-1" } });
  }

  it("busca clientes mientras se escribe", async () => {
    montarModal([CLIENTE]);
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: "ana" } });

    expect(await screen.findByRole("button", { name: /ana gómez/i })).toBeInTheDocument();
  });

  it("no busca con menos de dos letras: devolvería media base", async () => {
    montarModal([CLIENTE]);
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: "a" } });

    await waitFor(() => {
      const llamadas = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
      expect(llamadas.filter(([u]) => String(u).includes("/api/clientes"))).toHaveLength(0);
    });
  });

  it("al elegir un cliente avisa que la reserva queda vinculada", async () => {
    montarModal([CLIENTE]);
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: "ana" } });
    fireEvent.click(await screen.findByRole("button", { name: /ana gómez/i }));

    expect(screen.getByText(/va a ver en su app/i)).toBeInTheDocument();
  });

  it("sin cliente del sistema no deja crear: la reserva necesita un titular", async () => {
    montarModal([]);
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: "Pedro Nuevo" } });

    expect(await screen.findByText(/no está registrado/i)).toBeInTheDocument();
    // El camino es registrarlo, no agendar a nombre del dueño: esa deuda le
    // caía a él y lo bloqueaba para agendar.
    expect(screen.getByRole("button", { name: /crear/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /registrar a esta persona/i })).toBeInTheDocument();
  });

  it("manda playerId cuando se eligió a alguien del sistema", async () => {
    montarModal([CLIENTE]);
    await elegirCancha();
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: "ana" } });
    fireEvent.click(await screen.findByRole("button", { name: /ana gómez/i }));
    fireEvent.click(screen.getByRole("button", { name: /crear/i }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const [, opciones] = apiFetch.mock.calls[0] as unknown as [string, { body: string }];
    const cuerpo = JSON.parse(opciones.body);
    expect(cuerpo.playerId).toBe("cliente-1");
    expect(cuerpo.invitadoNombre).toBeUndefined();
  });

  it("nunca manda invitadoNombre: ese camino dejaba la deuda en el dueño", async () => {
    montarModal([]);
    await elegirCancha();
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: "Pedro Nuevo" } });
    fireEvent.click(screen.getByRole("button", { name: /crear/i }));

    await waitFor(() => expect(apiFetch).not.toHaveBeenCalled());
  });
});

describe("OwnerReservas — cómo se cobró la reserva manual", () => {
  const CANCHA_OPT = { id: "cancha-1", nombre: "Cancha 1", tipo: "FUTBOL_5" };

  const CLIENTE_AL_DIA = {
    id: "cliente-1", primerNombre: "Ana", apellidos: "Gómez",
    telefono: null, saldoPendiente: 0,
  };

  function montarModal() {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes("/api/clientes") ? [CLIENTE_AL_DIA] : url.includes("/api/canchas") ? [CANCHA_OPT] : [],
    })));
    render(<OwnerReservas />);
    fireEvent.click(screen.getByRole("button", { name: /\+ Nueva/i }));
  }

  /**
   * Agenda eligiendo a un cliente del sistema. Hace falta elegirlo: desde que
   * se retiró el camino del invitado, una reserva sin titular no se crea.
   */
  async function crearEligiendoCliente() {
    fireEvent.change(await screen.findByLabelText(/^cancha$/i), { target: { value: "cancha-1" } });
    fireEvent.change(screen.getByLabelText(/^cliente/i), { target: { value: "ana" } });
    fireEvent.click(await screen.findByRole("button", { name: /ana gómez/i }));
    fireEvent.click(screen.getByRole("button", { name: /crear/i }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const [, opciones] = apiFetch.mock.calls[0] as unknown as [string, { body: string }];
    return JSON.parse(opciones.body);
  }

  it("por defecto cobra todo en efectivo: es exactamente lo que hacía antes", async () => {
    montarModal();

    const cuerpo = await crearEligiendoCliente();

    expect(cuerpo.metodo).toBe("EFECTIVO");
    // Sin montoPagado el servidor asume el total, que es el precio que él
    // calcula y el navegador no conoce.
    expect(cuerpo.montoPagado).toBeUndefined();
  });

  it("deja elegir el método y anotar la entidad", async () => {
    montarModal();
    fireEvent.change(await screen.findByLabelText(/método/i), { target: { value: "TRANSFERENCIA" } });
    fireEvent.change(screen.getByLabelText(/entidad/i), { target: { value: "Nequi" } });

    const cuerpo = await crearEligiendoCliente();

    expect(cuerpo.metodo).toBe("TRANSFERENCIA");
    expect(cuerpo.entidad).toBe("Nequi");
  });

  it("el efectivo no pide entidad: no hay institución detrás", async () => {
    montarModal();
    await screen.findByLabelText(/método/i);

    expect(screen.queryByLabelText(/entidad/i)).not.toBeInTheDocument();
  });

  it("un abono manda el monto que entró", async () => {
    montarModal();
    fireEvent.change(await screen.findByLabelText(/^cobro$/i), { target: { value: "ABONO" } });
    fireEvent.change(screen.getByLabelText(/monto/i), { target: { value: "80000" } });

    const cuerpo = await crearEligiendoCliente();

    expect(cuerpo.montoPagado).toBe(80000);
    expect(cuerpo.metodo).toBe("EFECTIVO");
  });

  it("sin cobrar manda cero y NINGÚN método: no hubo plata que clasificar", async () => {
    montarModal();
    fireEvent.change(await screen.findByLabelText(/^cobro$/i), { target: { value: "NADA" } });

    const cuerpo = await crearEligiendoCliente();

    expect(cuerpo.montoPagado).toBe(0);
    expect(cuerpo.metodo).toBeUndefined();
    expect(cuerpo.entidad).toBeUndefined();
  });

  it("sin cobrar no pregunta cómo se cobró", async () => {
    montarModal();
    fireEvent.change(await screen.findByLabelText(/^cobro$/i), { target: { value: "NADA" } });

    expect(screen.queryByLabelText(/método/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/monto/i)).not.toBeInTheDocument();
  });

  it("avisa que la reserva queda debiendo, que es lo que va a pasar", async () => {
    montarModal();
    fireEvent.change(await screen.findByLabelText(/^cobro$/i), { target: { value: "NADA" } });

    expect(screen.getByText(/queda debiendo/i)).toBeInTheDocument();
  });
});

describe("OwnerReservas — saldo pendiente del cliente, antes de llenar el formulario", () => {
  const CANCHA_OPT = { id: "cancha-1", nombre: "Cancha 1", tipo: "FUTBOL_5" };
  const DEUDOR = {
    id: "cliente-1", primerNombre: "Ana", apellidos: "Gómez",
    telefono: "3009999999", saldoPendiente: 50000,
  };
  const AL_DIA = { ...DEUDOR, saldoPendiente: 0 };

  function montarModal(clientes: unknown[]) {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes("/api/clientes") ? clientes : url.includes("/api/canchas") ? [CANCHA_OPT] : [],
    })));
    render(<OwnerReservas />);
    fireEvent.click(screen.getByRole("button", { name: /\+ Nueva/i }));
  }

  async function elegir(clientes: unknown[]) {
    montarModal(clientes);
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: "ana" } });
    fireEvent.click(await screen.findByRole("button", { name: /ana gómez/i }));
  }

  it("avisa del saldo al elegir al cliente, no después de mandar el formulario", async () => {
    await elegir([DEUDOR]);

    expect(screen.getByText(/saldo pendiente/i)).toBeInTheDocument();
  });

  it("dice cuánto debe: 'tiene saldo' no le sirve a nadie en el mostrador", async () => {
    await elegir([DEUDOR]);

    expect(screen.getByText(/50\.000/)).toBeInTheDocument();
  });

  it("no deja agendarle: la regla es que deber bloquea", async () => {
    await elegir([DEUDOR]);

    expect(screen.getByRole("button", { name: /crear/i })).toBeDisabled();
  });

  it("al cliente al día no le dice nada y lo deja agendar", async () => {
    await elegir([AL_DIA]);

    expect(screen.queryByText(/saldo pendiente/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crear/i })).not.toBeDisabled();
  });

  it("a quien no está en el sistema no se le inventa un saldo", async () => {
    montarModal([]);
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: "Pedro Nuevo" } });

    expect(await screen.findByText(/no está registrado/i)).toBeInTheDocument();
    // No tiene cuenta, así que no puede deber nada. Que no se pueda agendar es
    // por falta de titular, no por saldo, y lo cubre otro test.
    expect(screen.queryByText(/saldo pendiente/i)).not.toBeInTheDocument();
  });

  it("si se borra al deudor elegido, el aviso de saldo se va solo", async () => {
    await elegir([DEUDOR]);
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: "Otro" } });

    // El bloqueo por saldo es derivado del cliente elegido, no estado propio:
    // deseleccionarlo lo levanta sin que nadie lo resetee.
    expect(screen.queryByText(/saldo pendiente/i)).not.toBeInTheDocument();
  });

  it("ni siquiera intenta el POST con un deudor elegido", async () => {
    await elegir([DEUDOR]);
    fireEvent.click(screen.getByRole("button", { name: /crear/i }));

    await waitFor(() => expect(apiFetch).not.toHaveBeenCalled());
  });
});

describe("OwnerReservas — registrar en el momento a quien no está en el sistema", () => {
  const CANCHA_OPT = { id: "cancha-1", nombre: "Cancha 1", tipo: "FUTBOL_5" };

  function montarModal(clientes: unknown[] = []) {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes("/api/clientes") ? clientes : url.includes("/api/canchas") ? [CANCHA_OPT] : [],
    })));
    render(<OwnerReservas />);
    fireEvent.click(screen.getByRole("button", { name: /\+ Nueva/i }));
  }

  async function buscarDesconocido() {
    montarModal([]);
    fireEvent.change(screen.getByLabelText(/^cliente/i), { target: { value: "Pedro Gómez" } });
    return screen.findByRole("button", { name: /registrar a esta persona/i });
  }

  it("ofrece registrarlo en vez de dejar la reserva colgada de un nombre", async () => {
    expect(await buscarDesconocido()).toBeInTheDocument();
  });

  it("al registrarlo, el formulario llega con lo que ya se tipeó", async () => {
    fireEvent.click(await buscarDesconocido());

    expect(screen.getByLabelText(/^nombre/i)).toHaveValue("Pedro");
    expect(screen.getByLabelText(/apellidos/i)).toHaveValue("Gómez");
  });

  it("el cliente registrado queda elegido y la reserva se vincula a su cuenta", async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "cliente-nuevo", primerNombre: "Pedro", apellidos: "Gómez",
        telefono: null, saldoPendiente: 0,
      }),
    });

    fireEvent.click(await buscarDesconocido());
    fireEvent.click(screen.getByRole("button", { name: /^registrar$/i }));

    await waitFor(() => expect(screen.getByText(/va a ver en su app/i)).toBeInTheDocument());

    await elegirCanchaEnModal();
    fireEvent.click(screen.getByRole("button", { name: /crear/i }));

    await waitFor(() => {
      const alta = apiFetch.mock.calls.find(([url]) => String(url) === "/api/reservas");
      expect(alta).toBeTruthy();
    });
    const [, opciones] = apiFetch.mock.calls.find(([url]) => String(url) === "/api/reservas") as unknown as [string, { body: string }];
    const cuerpo = JSON.parse(opciones.body);
    expect(cuerpo.playerId).toBe("cliente-nuevo");
    expect(cuerpo.invitadoNombre).toBeUndefined();
  });

  it("se puede volver sin registrar a nadie", async () => {
    fireEvent.click(await buscarDesconocido());
    fireEvent.click(screen.getByRole("button", { name: /volver/i }));

    expect(await screen.findByRole("button", { name: /registrar a esta persona/i })).toBeInTheDocument();
  });

  async function elegirCanchaEnModal() {
    const select = await screen.findByLabelText(/cancha/i);
    fireEvent.change(select, { target: { value: "cancha-1" } });
  }
});
