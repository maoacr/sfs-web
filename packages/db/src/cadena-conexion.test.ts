// @vitest-environment node
import { describe, it, expect } from "vitest";
import { extraerHostDeConexion } from "./cadena-conexion";

describe("extraerHostDeConexion", () => {
  it("devuelve host y puerto del session pooler", () => {
    expect(
      extraerHostDeConexion(
        "postgresql://postgres.ivqlbqvhrhosfovkihkv:clave@aws-0-us-east-2.pooler.supabase.com:5432/postgres"
      )
    ).toBe("aws-0-us-east-2.pooler.supabase.com:5432");
  });

  it("devuelve host y puerto de la conexión directa", () => {
    expect(
      extraerHostDeConexion(
        "postgresql://postgres:clave@db.ivqlbqvhrhosfovkihkv.supabase.co:5432/postgres"
      )
    ).toBe("db.ivqlbqvhrhosfovkihkv.supabase.co:5432");
  });

  // La razón de existir de esta función: distinguir producción (us-east-1) de
  // desarrollo (us-east-2) antes de aplicar migraciones. Si los dos hosts no
  // se distinguen, la función no sirve para nada.
  it("distingue las regiones de los dos entornos", () => {
    const produccion = extraerHostDeConexion(
      "postgresql://postgres.nbjnrpktkbrjapamdyvc:clave@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
    );
    const desarrollo = extraerHostDeConexion(
      "postgresql://postgres.ivqlbqvhrhosfovkihkv:clave@aws-0-us-east-2.pooler.supabase.com:5432/postgres"
    );

    expect(produccion).toContain("us-east-1");
    expect(desarrollo).toContain("us-east-2");
    expect(produccion).not.toBe(desarrollo);
  });

  // El parser de WHATWG corta en el ÚLTIMO arroba, así que una contraseña con
  // "@" no corre el host. Sin esto, el log mostraría un host inventado.
  it("no se confunde si la contraseña tiene un arroba", () => {
    expect(extraerHostDeConexion("postgresql://postgres:cla@ve@host.com:5432/db")).toBe(
      "host.com:5432"
    );
  });

  it("cae a un texto explícito cuando la cadena no se puede interpretar", () => {
    expect(extraerHostDeConexion("no-es-una-url")).toBe("(no se pudo interpretar la URL)");
    expect(extraerHostDeConexion("")).toBe("(no se pudo interpretar la URL)");
  });

  // El contrato que importa: esto se imprime en pantalla y en los logs de un
  // workflow público. Jamás puede salir una credencial, ni entera ni partida.
  // Una contraseña con "/" rompe el parseo, y el fallback tiene que tragarse
  // el error en vez de devolver el pedazo que alcanzó a leer.
  it("nunca devuelve parte de la contraseña, ni cuando el parseo falla", () => {
    const conBarra = "postgresql://postgres:cla/ve@host.com:5432/db";

    const resultado = extraerHostDeConexion(conBarra);

    expect(resultado).toBe("(no se pudo interpretar la URL)");
    expect(resultado).not.toContain("cla");
    expect(resultado).not.toContain("ve");
  });

  it("tolera una cadena sin puerto", () => {
    expect(extraerHostDeConexion("postgresql://postgres:clave@host.interno/db")).toBe(
      "host.interno"
    );
  });
});
