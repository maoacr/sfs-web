/**
 * Regla de vínculo entre una identidad de Google y una cuenta de SFS.
 *
 * Esto es la parte que de verdad importa de "iniciar sesión con Google": no el
 * baile de OAuth, sino decidir A QUÉ FILA de `usuarios` corresponde la persona
 * que acaba de autenticarse. Si esa decisión se equivoca, o duplicás personas,
 * o le entregás una cuenta ajena a alguien.
 *
 * Vive acá, puro y sin I/O, porque es una regla de negocio y se testea sola.
 * El route de `/api/auth/google` hace las consultas y ejecuta lo que ésta
 * decide.
 *
 * ── Por qué el password se ANULA al vincular ──────────────────────────────
 *
 * `/api/auth/register` crea cuentas sin verificar que el email sea tuyo. Sin
 * eso, vincular por email sería un vector de apropiación de cuentas:
 *
 *   1. El atacante registra `victima@gmail.com` con una password propia.
 *   2. La víctima real entra con Google; el email coincide y vinculamos.
 *   3. El atacante conserva una password válida de la cuenta que la víctima usa.
 *
 * Google SÍ prueba la propiedad del email (`email_verified`); nuestro registro
 * no prueba nada. La identidad verificada gana: vinculamos, anulamos el
 * `password_hash` anterior y avisamos por email. El atacante queda afuera y la
 * dueña real del buzón queda dueña de la cuenta.
 *
 * Cuando el registro verifique emails, esta anulación se puede suavizar.
 */

export interface IdentidadGoogle {
  /** `sub` de Google: el identificador estable. El email puede cambiar; esto no. */
  sub: string;
  email: string;
  /** `email_verified` del token de Google. Es la única prueba de propiedad que tenemos. */
  emailVerificado: boolean;
  nombrePila?: string | null;
  apellidos?: string | null;
  nombreCompleto?: string | null;
  avatarUrl?: string | null;
}

/** Lo mínimo que la regla necesita saber de una fila de `usuarios`. */
export interface CuentaExistente {
  id: string;
  rol: "OWNER" | "PLAYER" | "ADMIN";
  tienePassword: boolean;
}

export type AccionVinculo =
  /** Ya está vinculada: emitimos sesión y listo. */
  | { tipo: "ENTRAR"; usuarioId: string }
  /** Existe la cuenta pero no estaba vinculada a este `sub`. */
  | { tipo: "VINCULAR"; usuarioId: string; anularPassword: boolean }
  /** Nadie en el sistema: alta nueva. */
  | { tipo: "CREAR" }
  | { tipo: "RECHAZAR"; motivo: string };

export interface CuentasEncontradas {
  porGoogleSub?: CuentaExistente | null;
  porEmail?: CuentaExistente | null;
}

export function decidirVinculo(
  identidad: IdentidadGoogle,
  encontradas: CuentasEncontradas
): AccionVinculo {
  // Invariante de SFS: un email que entra por Google está verificado. Sin esa
  // prueba no vinculamos ni creamos nada — es justamente el caso que convierte
  // el vínculo por email en una apropiación de cuenta.
  if (!identidad.emailVerificado) {
    return {
      tipo: "RECHAZAR",
      motivo:
        "Google no confirmó que este email sea tuyo. Iniciá sesión con email y contraseña.",
    };
  }

  const { porGoogleSub, porEmail } = encontradas;

  // El `sub` manda sobre el email: si cambió su email en Google, sigue siendo
  // la misma persona y la misma cuenta.
  const cuenta = porGoogleSub ?? porEmail;

  if (cuenta?.rol === "ADMIN") {
    // Misma puerta cerrada que en `/api/auth/login`.
    return { tipo: "RECHAZAR", motivo: "Este tipo de cuenta no tiene acceso a la app" };
  }

  if (porGoogleSub) {
    return { tipo: "ENTRAR", usuarioId: porGoogleSub.id };
  }

  if (porEmail) {
    return {
      tipo: "VINCULAR",
      usuarioId: porEmail.id,
      anularPassword: porEmail.tienePassword,
    };
  }

  return { tipo: "CREAR" };
}

/**
 * `usuarios.nombre` y `usuarios.apellido` son NOT NULL, y Google no garantiza
 * mandar ninguno de los dos. Siempre devolvemos algo insertable.
 *
 * `apellido` puede quedar vacío a propósito: preferimos un dato ausente y
 * honesto antes que inventar uno.
 */
export function nombreDesdeGoogle(identidad: IdentidadGoogle): {
  nombre: string;
  apellido: string;
} {
  const pila = identidad.nombrePila?.trim();
  const apellidos = identidad.apellidos?.trim();

  if (pila) {
    return { nombre: pila, apellido: apellidos || "" };
  }

  const completo = identidad.nombreCompleto?.trim();
  if (completo) {
    const [primero, ...resto] = completo.split(/\s+/);
    return { nombre: primero, apellido: resto.join(" ") };
  }

  return { nombre: identidad.email.split("@")[0], apellido: "" };
}
