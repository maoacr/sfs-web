import { NextResponse } from "next/server";
import { db, usuarios } from "@sfs/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { apiHandler } from "@/lib/api-handler";
import { restablecerSchema, type RestablecerInput } from "@/lib/schemas";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { leerTokenReset, huellaPassword } from "@/lib/reset-token";

/** Un solo mensaje para todos los rechazos: ver el comentario de abajo. */
const LINK_INVALIDO = "Este link ya no sirve. Pedí uno nuevo desde la pantalla de ingreso.";

/**
 * POST /api/auth/restablecer
 *
 * Usa el link. No inicia sesión a propósito: después de cambiar la contraseña
 * la persona entra por la puerta normal, y así el link no es también un pase.
 *
 * Todos los rechazos comparten mensaje y status. Distinguir "token vencido" de
 * "cuenta inexistente" le confirmaría a quien prueba tokens cuáles eran
 * legítimos.
 */
export const POST = apiHandler<RestablecerInput>(
  async (_request, _ctx, { body }) => {
    if (!body) {
      return NextResponse.json({ error: "Datos requeridos" }, { status: 400 });
    }

    const rechazo = NextResponse.json({ error: LINK_INVALIDO }, { status: 400 });

    // Firma, vencimiento y propósito. No alcanza: todavía falta comprobar que
    // el token hable del estado ACTUAL de la cuenta.
    const leido = await leerTokenReset(body.token);
    if (!leido) return rechazo;

    const usuario = await db.query.usuarios.findFirst({
      where: eq(usuarios.id, leido.usuarioId),
    });
    if (!usuario || usuario.rol === "ADMIN") return rechazo;

    // Acá muere el token usado: restablecer cambió el password_hash, así que
    // la huella que el token afirma ya no coincide con la de la cuenta.
    if (leido.huella !== huellaPassword(usuario.passwordHash)) return rechazo;

    // Mismos rounds que el registro: una contraseña puesta por este camino no
    // vale menos que una puesta al crear la cuenta.
    const passwordHash = await bcrypt.hash(body.password, 12);

    // Sólo el hash. `google_sub` queda intacto: el link probó la propiedad del
    // email, no hay motivo para quitarle la puerta de Google.
    await db.update(usuarios).set({ passwordHash }).where(eq(usuarios.id, usuario.id));

    return NextResponse.json({
      mensaje: "Tu contraseña quedó actualizada. Ya podés iniciar sesión.",
    });
  },
  {
    bodySchema: restablecerSchema,
    rateLimit: RATE_LIMITS.AUTH_RECUPERAR,
    requireCsrf: false,
  }
);
