// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  findFirst: vi.fn(),
  enviarEmail: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  eq: (columna: string, valor: unknown) => ({ columna, valor }),
}));

vi.mock("@sfs/db", () => ({
  db: { query: { usuarios: { findFirst: h.findFirst } } },
  usuarios: { id: "id", email: "email" },
}));

vi.mock("@/lib/email", () => ({ enviarEmail: h.enviarEmail }));

import { POST } from "./route";
import { leerTokenReset, huellaPassword } from "@/lib/reset-token";

const HASH = "$2b$12$hash-actual";
const ID = "11111111-1111-4111-8111-111111111111";

function fila(cambios: Record<string, unknown> = {}) {
  return {
    id: ID,
    email: "jugador@gmail.com",
    rol: "PLAYER",
    passwordHash: HASH,
    nombre: "Mario",
    ...cambios,
  };
}

let contadorIp = 0;
function peticion(cuerpo: unknown = { email: "jugador@gmail.com" }, ipFija?: string) {
  contadorIp += 1;
  return new NextRequest("http://localhost/api/auth/recuperar", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ipFija ?? `10.1.0.${contadorIp}`,
    },
    body: JSON.stringify(cuerpo),
  });
}

/** El html del mail es el único lugar donde aparece el token. */
function tokenDelMail(): string {
  const [, , html] = h.enviarEmail.mock.calls[0] as [string, string, string];
  return /token=([\w.-]+)/.exec(html)?.[1] ?? "";
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = "secreto-de-sesion-para-tests";
  h.findFirst.mockResolvedValue(null);
  h.enviarEmail.mockResolvedValue(undefined);
});

describe("POST /api/auth/recuperar", () => {
  it("valida el email antes de tocar la base", async () => {
    const res = await POST(peticion({ email: "no-es-un-email" }));

    expect(res.status).toBe(400);
    expect(h.findFirst).not.toHaveBeenCalled();
  });

  /**
   * La respuesta es idéntica exista o no la cuenta. Distinguirlas convertiría
   * este endpoint en un oráculo de qué emails están registrados.
   */
  it("responde lo mismo exista o no la cuenta", async () => {
    h.findFirst.mockResolvedValue(null);
    const sinCuenta = await POST(peticion());
    const cuerpoSinCuenta = await sinCuenta.json();

    h.findFirst.mockResolvedValue(fila());
    const conCuenta = await POST(peticion());
    const cuerpoConCuenta = await conCuenta.json();

    expect(sinCuenta.status).toBe(conCuenta.status);
    expect(cuerpoSinCuenta).toEqual(cuerpoConCuenta);
  });

  it("no manda ningún mail si la cuenta no existe", async () => {
    h.findFirst.mockResolvedValue(null);

    await POST(peticion());

    expect(h.enviarEmail).not.toHaveBeenCalled();
  });

  it("manda el mail con un link que lleva un token legible", async () => {
    h.findFirst.mockResolvedValue(fila());

    const res = await POST(peticion());

    expect(res.status).toBe(200);
    expect(h.enviarEmail).toHaveBeenCalledWith(
      "jugador@gmail.com",
      expect.stringContaining("contraseña"),
      expect.stringContaining("/auth/restablecer?token=")
    );

    const leido = await leerTokenReset(tokenDelMail());
    expect(leido?.usuarioId).toBe(ID);
    expect(leido?.huella).toBe(huellaPassword(HASH));
  });

  /**
   * Decisión tomada a propósito: el link prueba la propiedad del email, que es
   * la misma prueba que da Google. Negarle una contraseña la dejaría sin
   * salida si pierde acceso a su cuenta de Google.
   */
  it("también atiende a una cuenta que hoy entra sólo con Google", async () => {
    h.findFirst.mockResolvedValue(fila({ passwordHash: null }));

    await POST(peticion());

    expect(h.enviarEmail).toHaveBeenCalled();
    const leido = await leerTokenReset(tokenDelMail());
    expect(leido?.huella).toBe(huellaPassword(null));
  });

  it("no le manda nada a una cuenta ADMIN, pero responde igual", async () => {
    h.findFirst.mockResolvedValue(fila({ rol: "ADMIN" }));

    const res = await POST(peticion());

    expect(res.status).toBe(200);
    expect(h.enviarEmail).not.toHaveBeenCalled();
  });

  it("corta con 429 al cuarto intento desde la misma IP", async () => {
    const ip = "203.0.113.77";
    const estados: number[] = [];
    for (let intento = 0; intento < 4; intento += 1) {
      estados.push((await POST(peticion(undefined, ip))).status);
    }

    expect(estados.slice(0, 3)).not.toContain(429);
    expect(estados[3]).toBe(429);
  });
});
