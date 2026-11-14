import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

/**
 * Token de recuperación de contraseña.
 *
 * ── Por qué una clave DERIVADA y no `JWT_SECRET` ──────────────────────────
 *
 * `getAuthUser` verifica la cookie de sesión con `jwtVerify(token, JWT_SECRET)`
 * y castea el payload sin mirar su forma. Cualquier token que verifique ahí se
 * convierte en una sesión autenticada. Si el token de recuperación compartiera
 * esa clave, un link enviado por email sería un pase de sesión.
 *
 * La clave sale de `JWT_SECRET` por separación de dominio: no hay que
 * configurar ni desplegar un secreto nuevo —y por lo tanto no hay forma de que
 * falte en producción—, pero un token de un dominio no verifica en el otro. Si
 * algún día se quiere rotar la clave de reset por separado, acá se cambia la
 * derivación por una env var propia.
 *
 * ── Por qué es de un solo uso sin tabla ───────────────────────────────────
 *
 * El token lleva una huella del `password_hash` que la cuenta tenía al
 * emitirlo. Restablecer cambia el hash, la huella deja de coincidir y el mismo
 * link no vuelve a funcionar. Tampoco funciona un link viejo si la persona
 * cambió la contraseña por otro camino.
 *
 * Lo que esto NO da: revocar un token antes de que se use. Mitigado con una
 * vida de 30 minutos. Si hiciera falta revocación explícita o auditoría de
 * intentos, ahí sí haría falta una tabla.
 */

const VIGENCIA = "30m";
const PROPOSITO = "reset-password";

/** La env var se lee acá y no en module load: así el módulo se testea solo. */
function clave(): Uint8Array {
  const secreto = process.env.JWT_SECRET;
  if (!secreto) throw new Error("Falta JWT_SECRET");
  return new Uint8Array(createHash("sha256").update(`${secreto}|${PROPOSITO}`).digest());
}

/**
 * Huella del estado actual de la contraseña. Va dentro del token, que viaja
 * por email: es un hash del hash, nunca el hash en sí.
 */
export function huellaPassword(passwordHash: string | null): string {
  return createHash("sha256")
    .update(`${PROPOSITO}|${passwordHash ?? "sin-password"}`)
    .digest("hex")
    .slice(0, 32);
}

export async function firmarTokenReset(
  usuarioId: string,
  passwordHash: string | null
): Promise<string> {
  return new SignJWT({ huella: huellaPassword(passwordHash), proposito: PROPOSITO })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(usuarioId)
    .setIssuedAt()
    .setExpirationTime(VIGENCIA)
    .sign(clave());
}

/**
 * Verifica firma, vencimiento y propósito. Devuelve `null` ante cualquier
 * problema: quien llama responde un único mensaje genérico, así que distinguir
 * los motivos sólo serviría para filtrar información.
 *
 * La huella se devuelve sin comparar — compararla necesita leer la cuenta, y
 * eso le toca al route.
 */
export async function leerTokenReset(
  token: string
): Promise<{ usuarioId: string; huella: string } | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, clave());

    if (payload.proposito !== PROPOSITO) return null;
    if (typeof payload.sub !== "string" || typeof payload.huella !== "string") return null;

    return { usuarioId: payload.sub, huella: payload.huella };
  } catch {
    return null;
  }
}
