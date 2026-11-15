import { describe, it, expect } from "vitest";
import {
  decidirVinculo,
  nombreDesdeGoogle,
  type CuentaExistente,
  type IdentidadGoogle,
} from "@/lib/google-auth";

const identidad = (over: Partial<IdentidadGoogle> = {}): IdentidadGoogle => ({
  sub: "google-sub-123",
  email: "jugador@gmail.com",
  emailVerificado: true,
  ...over,
});

const cuenta = (over: Partial<CuentaExistente> = {}): CuentaExistente => ({
  id: "11111111-1111-1111-1111-111111111111",
  rol: "PLAYER",
  tienePassword: false,
  ...over,
});

describe("decidirVinculo — la regla de vínculo entre Google y una cuenta SFS", () => {
  it("rechaza si Google no verificó el email, aunque no exista ninguna cuenta", () => {
    const accion = decidirVinculo(identidad({ emailVerificado: false }), {});

    expect(accion.tipo).toBe("RECHAZAR");
  });

  it("rechaza email no verificado incluso cuando ya hay cuenta con ese email", () => {
    const accion = decidirVinculo(identidad({ emailVerificado: false }), {
      porEmail: cuenta({ tienePassword: true }),
    });

    expect(accion.tipo).toBe("RECHAZAR");
  });

  it("entra directo cuando el google_sub ya está vinculado a una cuenta", () => {
    const accion = decidirVinculo(identidad(), {
      porGoogleSub: cuenta({ id: "sub-match" }),
    });

    expect(accion).toEqual({ tipo: "ENTRAR", usuarioId: "sub-match" });
  });

  it("el google_sub manda sobre el email: si el usuario cambió su email en Google, sigue siendo su cuenta", () => {
    const accion = decidirVinculo(identidad({ email: "nuevo@gmail.com" }), {
      porGoogleSub: cuenta({ id: "cuenta-de-siempre" }),
      porEmail: cuenta({ id: "otra-cuenta-distinta" }),
    });

    expect(accion).toEqual({ tipo: "ENTRAR", usuarioId: "cuenta-de-siempre" });
  });

  it("vincula y ANULA el password cuando existe una cuenta con password para ese email verificado", () => {
    const accion = decidirVinculo(identidad(), {
      porEmail: cuenta({ id: "cuenta-con-password", tienePassword: true }),
    });

    expect(accion).toEqual({
      tipo: "VINCULAR",
      usuarioId: "cuenta-con-password",
      anularPassword: true,
    });
  });

  it("vincula sin anular nada si la cuenta del email no tenía password", () => {
    const accion = decidirVinculo(identidad(), {
      porEmail: cuenta({ id: "cuenta-sin-password", tienePassword: false }),
    });

    expect(accion).toEqual({
      tipo: "VINCULAR",
      usuarioId: "cuenta-sin-password",
      anularPassword: false,
    });
  });

  it("crea cuenta nueva cuando no hay nada que vincular", () => {
    const accion = decidirVinculo(identidad(), {});

    expect(accion).toEqual({ tipo: "CREAR" });
  });

  it("rechaza cuentas ADMIN — misma puerta cerrada que en el login con password", () => {
    expect(decidirVinculo(identidad(), { porGoogleSub: cuenta({ rol: "ADMIN" }) }).tipo).toBe("RECHAZAR");
    expect(decidirVinculo(identidad(), { porEmail: cuenta({ rol: "ADMIN" }) }).tipo).toBe("RECHAZAR");
  });
});

describe("nombreDesdeGoogle — `nombre` y `apellido` son NOT NULL, siempre hay que devolver algo", () => {
  it("usa given_name y family_name cuando Google los manda", () => {
    expect(
      nombreDesdeGoogle(identidad({ nombrePila: "Carlos", apellidos: "Gómez Pérez" }))
    ).toEqual({ nombre: "Carlos", apellido: "Gómez Pérez" });
  });

  it("parte el nombre completo cuando no vienen los campos separados", () => {
    expect(nombreDesdeGoogle(identidad({ nombreCompleto: "Carlos Gómez Pérez" }))).toEqual({
      nombre: "Carlos",
      apellido: "Gómez Pérez",
    });
  });

  it("cae al usuario del email cuando Google no manda ningún nombre", () => {
    expect(nombreDesdeGoogle(identidad({ email: "carlitos.gomez@gmail.com" }))).toEqual({
      nombre: "carlitos.gomez",
      apellido: "",
    });
  });

  it("tolera un nombre completo de una sola palabra", () => {
    expect(nombreDesdeGoogle(identidad({ nombreCompleto: "Ronaldinho" }))).toEqual({
      nombre: "Ronaldinho",
      apellido: "",
    });
  });

  it("recorta espacios y no devuelve strings vacíos como nombre", () => {
    expect(nombreDesdeGoogle(identidad({ nombrePila: "  Carlos  ", apellidos: "   " }))).toEqual({
      nombre: "Carlos",
      apellido: "",
    });
  });
});
