// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// `email.ts` construye el cliente de Resend al cargar el módulo y queda en
// null sin API key. `vi.hoisted` corre ANTES de los imports, que es la única
// ventana para que el módulo se cargue con cliente.
const mocks = vi.hoisted(() => {
  process.env.RESEND_API_KEY = "re_de_prueba";
  return { enviar: vi.fn() };
});

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.enviar };
  },
}));

import { notificarPorEmail } from "@/lib/email";

const EVENTO = {
  tipo: "RESERVA_CREADA" as const,
  reservaId: "reserva-1",
  canchaNombre: "Cancha 1",
  complejoNombre: "Norte",
  slotInicio: new Date("2026-11-22T14:00:00.000Z"),
  slotFin: new Date("2026-11-22T15:00:00.000Z"),
  zonaHoraria: "America/Bogota",
  playerId: "jugador-1",
  playerNombre: "Juan Pérez",
  playerEmail: "juan@sfs.test" as string | null,
  tenantId: "dueno-1",
  tenantEmail: "dueno@sfs.test" as string | null,
};

/** A quién se le mandó mail, en el orden en que se mandaron. */
function destinatarios(): string[] {
  return mocks.enviar.mock.calls.flatMap(([payload]) => {
    const para = (payload as { to?: string | string[] })?.to;
    return Array.isArray(para) ? para : para ? [para] : [];
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enviar.mockResolvedValue({ data: { id: "mail-1" }, error: null });
});

describe("notificarPorEmail — un cliente del mostrador no tiene a dónde recibir", () => {
  it("al jugador sin email no se le manda nada", async () => {
    await notificarPorEmail({ ...EVENTO, playerEmail: null });

    expect(destinatarios()).not.toContain("juan@sfs.test");
  });

  it("y que al jugador le falte el email no le corta el mail al dueño", async () => {
    // `RESERVA_CREADA` no manda nada al dueño por diseño —sólo le avisa cuando
    // el pago se confirma—, así que el caso se prueba con un evento que sí.
    await notificarPorEmail({ ...EVENTO, tipo: "RESERVA_CONFIRMADA", playerEmail: null });

    expect(destinatarios()).toContain("dueno@sfs.test");
    expect(destinatarios()).not.toContain("juan@sfs.test");
  });

  it("no revienta ni deja el evento a medio procesar", async () => {
    await expect(
      notificarPorEmail({ ...EVENTO, playerEmail: null })
    ).resolves.toBeUndefined();
  });

  it("con email, al jugador le llega como siempre", async () => {
    await notificarPorEmail(EVENTO);

    expect(destinatarios()).toContain("juan@sfs.test");
  });

  it("sin email de nadie no manda un solo mail", async () => {
    await notificarPorEmail({ ...EVENTO, playerEmail: null, tenantEmail: null });

    expect(mocks.enviar).not.toHaveBeenCalled();
  });
});
