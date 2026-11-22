// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  limit: vi.fn(),
  saldosPendientesDe: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  and: (...partes: unknown[]) => ({ and: partes }),
  eq: (columna: unknown, valor: unknown) => ({ eq: [columna, valor] }),
  or: (...partes: unknown[]) => ({ or: partes }),
  ilike: (columna: unknown, patron: unknown) => ({ ilike: [columna, patron] }),
  sql: (plantilla: unknown) => ({ sql: plantilla }),
}));

vi.mock("@sfs/db", () => ({
  db: {
    selectDistinct: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({ limit: mocks.limit }),
        }),
      }),
    }),
  },
  reservas: { playerId: "player_id", tenantId: "tenant_id" },
  usuarios: { id: "id", nombre: "nombre", apellido: "apellido", apodo: "apodo", telefono: "telefono" },
}));

vi.mock("@/lib/saldo", () => ({ saldosPendientesDe: mocks.saldosPendientesDe }));

vi.mock("@/lib/auth-api", async () => {
  const real = await vi.importActual<typeof import("@/lib/auth-api")>("@/lib/auth-api");
  return { ...real, getAuthUser: mocks.getAuthUser };
});

import { GET } from "./route";

const DUENO = "11111111-1111-1111-1111-111111111111";

function consulta(query: string) {
  return new NextRequest(`http://localhost/api/clientes${query}`, {
    method: "GET",
    headers: { cookie: "sfs_token=x" },
  });
}

function cliente(over: Record<string, unknown> = {}) {
  return {
    id: "cliente-1",
    nombre: "Ana María",
    apellido: "Gómez",
    apodo: null,
    telefono: "3009999999",
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthUser.mockResolvedValue({ sub: DUENO, email: "d@sfs.test", role: "OWNER" });
  mocks.limit.mockResolvedValue([cliente()]);
  mocks.saldosPendientesDe.mockResolvedValue(new Map());
});

describe("GET /api/clientes — el saldo viaja con el cliente", () => {
  it("dice cuánto debe cada cliente, para poder avisar antes de agendarle", async () => {
    mocks.saldosPendientesDe.mockResolvedValue(new Map([["cliente-1", 50000]]));

    const respuesta = await GET(consulta("?q=ana"));
    const [encontrado] = await respuesta.json();

    expect(encontrado.saldoPendiente).toBe(50000);
  });

  it("quien no debe nada viene en cero, no en undefined: la UI no tiene que adivinar", async () => {
    const respuesta = await GET(consulta("?q=ana"));
    const [encontrado] = await respuesta.json();

    expect(encontrado.saldoPendiente).toBe(0);
  });

  it("pregunta el saldo de los clientes encontrados en una sola consulta", async () => {
    mocks.limit.mockResolvedValue([cliente(), cliente({ id: "cliente-2", nombre: "Ana Luisa" })]);

    await GET(consulta("?q=ana"));

    expect(mocks.saldosPendientesDe).toHaveBeenCalledTimes(1);
    expect(mocks.saldosPendientesDe).toHaveBeenCalledWith(["cliente-1", "cliente-2"]);
  });

  it("sin resultados devuelve la lista vacía", async () => {
    mocks.limit.mockResolvedValue([]);

    const respuesta = await GET(consulta("?q=zzz"));

    expect(await respuesta.json()).toEqual([]);
    // Que un lote vacío no toque la base es responsabilidad de
    // `saldosPendientesDe`, y está testeado ahí.
    expect(mocks.saldosPendientesDe).toHaveBeenCalledWith([]);
  });

  it("con menos de dos letras no busca ni pregunta saldos", async () => {
    const respuesta = await GET(consulta("?q=a"));

    expect(await respuesta.json()).toEqual([]);
    expect(mocks.limit).not.toHaveBeenCalled();
    expect(mocks.saldosPendientesDe).not.toHaveBeenCalled();
  });

  it("sigue devolviendo el nombre partido que espera la UI", async () => {
    const respuesta = await GET(consulta("?q=ana"));
    const [encontrado] = await respuesta.json();

    expect(encontrado.primerNombre).toBe("Ana");
    expect(encontrado.apellidos).toBe("Gómez");
  });

  it("un jugador no puede cosechar la cartera de un complejo", async () => {
    mocks.getAuthUser.mockResolvedValue({ sub: "otro", email: "j@sfs.test", role: "PLAYER" });

    const respuesta = await GET(consulta("?q=ana"));

    expect(respuesta.status).toBe(403);
    expect(mocks.saldosPendientesDe).not.toHaveBeenCalled();
  });
});
