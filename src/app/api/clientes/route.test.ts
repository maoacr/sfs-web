// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  limit: vi.fn(),
  saldosPendientesDe: vi.fn(),
  insertado: vi.fn(),
  usuarioFindFirst: vi.fn(),
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
    query: { usuarios: { findFirst: mocks.usuarioFindFirst } },
    insert: () => ({
      values: (valores: Record<string, unknown>) => {
        mocks.insertado(valores);
        return { returning: async () => [{ id: "cliente-nuevo", ...valores }] };
      },
    }),
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

import { GET, POST } from "./route";

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
  mocks.usuarioFindFirst.mockResolvedValue(undefined);
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

describe("POST /api/clientes — registro rápido desde el mostrador", () => {
  function alta(cuerpo: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/clientes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // `apiHandler` exige CSRF en los métodos que escriben: el header tiene
        // que coincidir con la cookie.
        "x-csrf-token": "token-csrf",
        cookie: "sfs_token=x; csrf_token=token-csrf",
      },
      body: JSON.stringify(cuerpo),
    });
  }

  const MINIMO = { primerNombre: "Pedro", apellidos: "Sin Cuenta" };

  it("alcanza con nombre y apellido: en el mostrador no se puede pedir más", async () => {
    const respuesta = await POST(alta(MINIMO));

    expect(respuesta.status).toBe(201);
    expect(mocks.insertado).toHaveBeenCalledTimes(1);
  });

  it("la cuenta nace SIN contraseña: el dueño no elige credenciales ajenas", async () => {
    await POST(alta(MINIMO));

    const fila = mocks.insertado.mock.calls[0][0];
    expect(fila.passwordHash ?? null).toBeNull();
  });

  it("y siempre como PLAYER: no es un camino para fabricar dueños", async () => {
    await POST(alta({ ...MINIMO, role: "OWNER", rol: "OWNER" }));

    expect(mocks.insertado.mock.calls[0][0].rol).toBe("PLAYER");
  });

  it("sin email guarda null, no un string vacío que ocuparía el índice único", async () => {
    await POST(alta(MINIMO));

    expect(mocks.insertado.mock.calls[0][0].email).toBeNull();
  });

  it("con email lo normaliza, que es como lo va a buscar el login de Google", async () => {
    await POST(alta({ ...MINIMO, email: "  Pedro@GMAIL.com " }));

    expect(mocks.insertado.mock.calls[0][0].email).toBe("pedro@gmail.com");
  });

  it("un email ya registrado no se pisa: la cuenta de otro no se toca", async () => {
    mocks.usuarioFindFirst.mockResolvedValue({ id: "ya-existe", nombre: "Pedro Luis" });

    const respuesta = await POST(alta({ ...MINIMO, email: "pedro@gmail.com" }));

    expect(respuesta.status).toBe(409);
    expect(mocks.insertado).not.toHaveBeenCalled();
  });

  it("y ofrece esa cuenta para vincular, en vez de dejar al mostrador sin salida", async () => {
    mocks.usuarioFindFirst.mockResolvedValue({ id: "ya-existe", nombre: "Pedro Luis" });

    const respuesta = await POST(alta({ ...MINIMO, email: "pedro@gmail.com" }));
    const cuerpo = await respuesta.json();

    expect(cuerpo.clienteExistente).toMatchObject({ id: "ya-existe" });
  });

  it("del titular existente sólo dice el primer nombre, nada más", async () => {
    mocks.usuarioFindFirst.mockResolvedValue({
      id: "ya-existe", nombre: "Pedro Luis", apellido: "Ramírez", telefono: "3001112233",
    });

    const respuesta = await POST(alta({ ...MINIMO, email: "pedro@gmail.com" }));
    const { clienteExistente } = await respuesta.json();

    expect(clienteExistente.primerNombre).toBe("Pedro");
    // Apellido y teléfono NO viajan: el dueño tipeó un email, no se ganó la
    // ficha completa de una persona que nunca pisó su cancha.
    expect(clienteExistente.apellidos).toBeUndefined();
    expect(clienteExistente.telefono).toBeUndefined();
  });

  it("avisa si esa cuenta debe plata, que es lo que va a bloquear la reserva", async () => {
    mocks.usuarioFindFirst.mockResolvedValue({ id: "ya-existe", nombre: "Pedro" });
    mocks.saldosPendientesDe.mockResolvedValue(new Map([["ya-existe", 40000]]));

    const respuesta = await POST(alta({ ...MINIMO, email: "pedro@gmail.com" }));
    const { clienteExistente } = await respuesta.json();

    expect(clienteExistente.saldoPendiente).toBe(40000);
  });

  it("y si no debe nada, cero explícito", async () => {
    mocks.usuarioFindFirst.mockResolvedValue({ id: "ya-existe", nombre: "Pedro" });

    const respuesta = await POST(alta({ ...MINIMO, email: "pedro@gmail.com" }));
    const { clienteExistente } = await respuesta.json();

    expect(clienteExistente.saldoPendiente).toBe(0);
  });

  it("sin email no pregunta por duplicados: varios nulos conviven", async () => {
    await POST(alta(MINIMO));

    expect(mocks.usuarioFindFirst).not.toHaveBeenCalled();
  });

  it("devuelve al cliente listo para elegirlo, con saldo cero", async () => {
    const respuesta = await POST(alta(MINIMO));
    const creado = await respuesta.json();

    expect(creado.id).toBe("cliente-nuevo");
    expect(creado.primerNombre).toBe("Pedro");
    expect(creado.apellidos).toBe("Sin Cuenta");
    expect(creado.saldoPendiente).toBe(0);
  });

  it("junta los dos nombres en la columna `nombre`, como el registro normal", async () => {
    await POST(alta({ ...MINIMO, segundoNombre: "José" }));

    expect(mocks.insertado.mock.calls[0][0].nombre).toBe("Pedro José");
  });

  it("un jugador no puede crear clientes", async () => {
    mocks.getAuthUser.mockResolvedValue({ sub: "otro", email: "j@sfs.test", role: "PLAYER" });

    const respuesta = await POST(alta(MINIMO));

    expect(respuesta.status).toBe(403);
    expect(mocks.insertado).not.toHaveBeenCalled();
  });

  it("sin nombre no se crea nada: la reserva no se podría ni leer", async () => {
    const respuesta = await POST(alta({ apellidos: "Solo Apellido" }));

    expect(respuesta.status).toBe(400);
    expect(mocks.insertado).not.toHaveBeenCalled();
  });
});
