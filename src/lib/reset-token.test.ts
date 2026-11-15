// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SignJWT, jwtVerify } from "jose";
import { firmarTokenReset, leerTokenReset, huellaPassword } from "@/lib/reset-token";

const SECRETO_SESION = "secreto-de-sesion-para-tests";
const USUARIO = "11111111-1111-4111-8111-111111111111";
const HASH_A = "$2b$10$hash-viejo";
const HASH_B = "$2b$10$hash-nuevo";

beforeEach(() => {
  // El módulo lee la env var DENTRO de la función, no en module load: por eso
  // alcanza con asignarla acá y no hace falta `vi.hoisted`.
  process.env.JWT_SECRET = SECRETO_SESION;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("huellaPassword", () => {
  it("cambia cuando cambia la contraseña", () => {
    expect(huellaPassword(HASH_A)).not.toBe(huellaPassword(HASH_B));
  });

  it("es estable para el mismo hash", () => {
    expect(huellaPassword(HASH_A)).toBe(huellaPassword(HASH_A));
  });

  it("distingue una cuenta sin contraseña de una con contraseña", () => {
    expect(huellaPassword(null)).not.toBe(huellaPassword(HASH_A));
  });

  it("no expone el hash de la contraseña", () => {
    // La huella viaja dentro del token, y el token viaja por email.
    expect(huellaPassword(HASH_A)).not.toContain(HASH_A);
  });
});

describe("firmarTokenReset / leerTokenReset", () => {
  it("lee el usuario y la huella de un token válido", async () => {
    const token = await firmarTokenReset(USUARIO, HASH_A);
    const leido = await leerTokenReset(token);

    expect(leido?.usuarioId).toBe(USUARIO);
    expect(leido?.huella).toBe(huellaPassword(HASH_A));
  });

  it("no lee un token manipulado", async () => {
    const token = await firmarTokenReset(USUARIO, HASH_A);
    const manipulado = token.slice(0, -4) + "AAAA";

    expect(await leerTokenReset(manipulado)).toBeNull();
  });

  it("no lee basura", async () => {
    expect(await leerTokenReset("no-es-un-token")).toBeNull();
    expect(await leerTokenReset("")).toBeNull();
  });

  it("no lee un token firmado con otro secreto", async () => {
    const token = await firmarTokenReset(USUARIO, HASH_A);
    process.env.JWT_SECRET = "otro-secreto-completamente-distinto";

    expect(await leerTokenReset(token)).toBeNull();
  });

  it("deja de valer a los 30 minutos", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-14T12:00:00Z"));
    const token = await firmarTokenReset(USUARIO, HASH_A);

    vi.setSystemTime(new Date("2026-11-14T12:29:00Z"));
    expect(await leerTokenReset(token)).not.toBeNull();

    vi.setSystemTime(new Date("2026-11-14T12:31:00Z"));
    expect(await leerTokenReset(token)).toBeNull();
  });
});

/**
 * La parte que de verdad importa. `getAuthUser` hace `jwtVerify` con
 * JWT_SECRET y castea el payload sin mirar su forma: cualquier token que
 * verifique ahí se convierte en una sesión autenticada. Si el token de
 * recuperación compartiera la clave, un link enviado por email sería un pase
 * de sesión. Los dos dominios tienen que estar separados criptográficamente.
 */
describe("separación de dominio entre reset y sesión", () => {
  it("un token de reset NO verifica como token de sesión", async () => {
    const token = await firmarTokenReset(USUARIO, HASH_A);
    const claveSesion = new TextEncoder().encode(SECRETO_SESION);

    await expect(jwtVerify(token, claveSesion)).rejects.toThrow();
  });

  it("un token de sesión NO se lee como token de reset", async () => {
    const claveSesion = new TextEncoder().encode(SECRETO_SESION);
    const tokenDeSesion = await new SignJWT({ sub: USUARIO, email: "a@b.c", role: "PLAYER" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(claveSesion);

    expect(await leerTokenReset(tokenDeSesion)).toBeNull();
  });
});

describe("un solo uso", () => {
  it("la huella del token deja de coincidir cuando la contraseña cambió", async () => {
    const token = await firmarTokenReset(USUARIO, HASH_A);
    const leido = await leerTokenReset(token);

    // Así es como el route lo detecta: compara la huella que afirma el token
    // contra la huella del estado actual de la cuenta.
    expect(leido?.huella).toBe(huellaPassword(HASH_A));
    expect(leido?.huella).not.toBe(huellaPassword(HASH_B));
  });
});
