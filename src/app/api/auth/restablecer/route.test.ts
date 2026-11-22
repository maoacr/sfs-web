// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  valoresDelUpdate: vi.fn(),
  hash: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  eq: (columna: string, valor: unknown) => ({ columna, valor }),
}));

vi.mock("@sfs/db", () => ({
  db: {
    query: { usuarios: { findFirst: mocks.findFirst } },
    update: () => ({
      set: (valores: Record<string, unknown>) => {
        mocks.valoresDelUpdate(valores);
        return { where: () => Promise.resolve(undefined) };
      },
    }),
  },
  usuarios: { id: "id", email: "email" },
}));

// bcrypt real son ~300ms por hash. Lo que importa verificar es NUESTRO
// contrato: que se hashee, con los mismos rounds que usa el registro, y que
// se guarde el resultado y nunca el texto plano.
vi.mock("bcryptjs", () => ({ default: { hash: mocks.hash } }));

import { POST } from "./route";
import { firmarTokenReset } from "@/lib/reset-token";

const HASH_ACTUAL = "$2b$12$hash-actual";
const ID = "11111111-1111-4111-8111-111111111111";
const NUEVA = "unaclavenueva";

function fila(cambios: Record<string, unknown> = {}) {
  return { id: ID, email: "jugador@gmail.com", rol: "PLAYER", passwordHash: HASH_ACTUAL, ...cambios };
}

let contadorIp = 0;
function peticion(cuerpo: unknown) {
  contadorIp += 1;
  return new NextRequest("http://localhost/api/auth/restablecer", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.2.0.${contadorIp}`,
    },
    body: JSON.stringify(cuerpo),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = "secreto-de-sesion-para-tests";
  mocks.findFirst.mockResolvedValue(fila());
  mocks.hash.mockResolvedValue("$2b$12$hash-nuevo");
});

describe("POST /api/auth/restablecer", () => {
  it("exige una contraseña que cumpla el mínimo", async () => {
    const token = await firmarTokenReset(ID, HASH_ACTUAL);

    const res = await POST(peticion({ token, password: "corta" }));

    expect(res.status).toBe(400);
    expect(mocks.valoresDelUpdate).not.toHaveBeenCalled();
  });

  it("guarda el hash y nunca el texto plano", async () => {
    const token = await firmarTokenReset(ID, HASH_ACTUAL);

    const res = await POST(peticion({ token, password: NUEVA }));

    expect(res.status).toBe(200);
    expect(mocks.hash).toHaveBeenCalledWith(NUEVA, 12);
    expect(mocks.valoresDelUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: "$2b$12$hash-nuevo" })
    );
  });

  /**
   * La cuenta conserva las dos puertas: el link probó el email, no hay motivo
   * para desvincular Google.
   */
  it("no toca el vínculo con Google", async () => {
    const token = await firmarTokenReset(ID, HASH_ACTUAL);

    await POST(peticion({ token, password: NUEVA }));

    expect(mocks.valoresDelUpdate).toHaveBeenCalledWith(
      expect.not.objectContaining({ googleSub: expect.anything() })
    );
  });

  it("rechaza un token que no se puede leer", async () => {
    const res = await POST(peticion({ token: "no-es-un-token", password: NUEVA }));

    expect(res.status).toBe(400);
    expect(mocks.valoresDelUpdate).not.toHaveBeenCalled();
  });

  /**
   * El corazón del diseño sin tabla: restablecer cambia el password_hash, la
   * huella que lleva el token deja de coincidir y el mismo link muere.
   */
  it("no acepta el mismo token dos veces", async () => {
    const token = await firmarTokenReset(ID, HASH_ACTUAL);

    expect((await POST(peticion({ token, password: NUEVA }))).status).toBe(200);

    // Segundo intento: la cuenta ya tiene el hash nuevo.
    mocks.findFirst.mockResolvedValue(fila({ passwordHash: "$2b$12$hash-nuevo" }));
    mocks.valoresDelUpdate.mockClear();

    expect((await POST(peticion({ token, password: NUEVA }))).status).toBe(400);
    expect(mocks.valoresDelUpdate).not.toHaveBeenCalled();
  });

  it("rechaza un token de una cuenta que ya no existe", async () => {
    const token = await firmarTokenReset(ID, HASH_ACTUAL);
    mocks.findFirst.mockResolvedValue(null);

    expect((await POST(peticion({ token, password: NUEVA }))).status).toBe(400);
    expect(mocks.valoresDelUpdate).not.toHaveBeenCalled();
  });

  it("no restablece una cuenta ADMIN", async () => {
    const token = await firmarTokenReset(ID, HASH_ACTUAL);
    mocks.findFirst.mockResolvedValue(fila({ rol: "ADMIN" }));

    expect((await POST(peticion({ token, password: NUEVA }))).status).toBe(400);
    expect(mocks.valoresDelUpdate).not.toHaveBeenCalled();
  });

  it("da el mismo mensaje para todos los rechazos", async () => {
    const tokenBueno = await firmarTokenReset(ID, HASH_ACTUAL);
    mocks.findFirst.mockResolvedValue(null);
    const porCuentaAusente = await (await POST(peticion({ token: tokenBueno, password: NUEVA }))).json();
    const porTokenRoto = await (await POST(peticion({ token: "roto", password: NUEVA }))).json();

    // Distinguirlos le diría a un atacante si el token era legítimo.
    expect(porCuentaAusente.error).toBe(porTokenRoto.error);
  });
});
