import { NextResponse } from "next/server";
import { db, usuarios } from "@sfs/db";
import { eq } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import { recuperarSchema, type RecuperarInput } from "@/lib/schemas";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { enviarEmail } from "@/lib/email";
import { firmarTokenReset } from "@/lib/reset-token";

/**
 * Base del link que va en el mail.
 *
 * Sale de CONFIGURACIÓN y nunca del request. Derivarla de `Host` o de
 * `x-forwarded-host` sería cómodo —funcionaría sola en los dos entornos— y es
 * el ataque clásico contra recuperación de contraseña: un atacante manda
 * `Host: evil.com`, el mail le llega a la víctima real con un link a evil.com
 * que lleva un token válido, y le cosecha el token cuando hace click.
 *
 * En producción, si falta la variable preferimos romper antes que mandar un
 * link a localhost: ese mail gasta el único token que la persona pidió, y el
 * problema no se nota hasta que alguien se queja.
 */
function urlBase(): string {
  const configurada = process.env.APP_URL;
  if (configurada) return configurada.replace(/\/+$/, "");

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Falta APP_URL: el link de recuperación necesita una URL pública configurada."
    );
  }

  return "http://localhost:3000";
}

/**
 * POST /api/auth/recuperar
 *
 * Pide el link para volver a entrar. Hasta que esto existió, un error de
 * tipeo en el registro dejaba la cuenta muerta: no había segunda oportunidad.
 *
 * La respuesta es SIEMPRE la misma, exista o no la cuenta. Un endpoint que
 * contesta distinto es un oráculo de qué emails están registrados, y eso se
 * puede recorrer con una lista.
 */
export const POST = apiHandler<RecuperarInput>(
  async (_request, _ctx, { body }) => {
    if (!body) {
      return NextResponse.json({ error: "Datos requeridos" }, { status: 400 });
    }

    // Único cuerpo de respuesta del endpoint. Se arma antes de mirar la base
    // para que no haya forma de que una rama devuelva algo distinto.
    const respuesta = NextResponse.json({
      mensaje:
        "Si ese email tiene una cuenta, te mandamos un link para restablecer tu contraseña.",
    });

    const email = body.email.toLowerCase().trim();
    const usuario = await db.query.usuarios.findFirst({
      where: eq(usuarios.email, email),
    });

    // Misma puerta cerrada que en `/api/auth/login` y `/api/auth/google`.
    if (!usuario || usuario.rol === "ADMIN") return respuesta;

    // La huella del password_hash actual viaja dentro del token: cuando la
    // contraseña cambie, este link deja de valer (ver `lib/reset-token.ts`).
    const token = await firmarTokenReset(usuario.id, usuario.passwordHash);
    const link = `${urlBase()}/auth/restablecer?token=${token}`;

    await enviarEmail(
      usuario.email,
      "Restablecé tu contraseña de SFS",
      `<p>Hola ${usuario.nombre},</p>
       <p>Pediste volver a entrar a tu cuenta de SFS. Para elegir una contraseña nueva, entrá acá:</p>
       <p><a href="${link}" style="display:inline-block;background:#15803d;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Elegir una contraseña nueva</a></p>
       <p style="color:#71717a;font-size:14px">El link vence en 30 minutos y sirve una sola vez.</p>
       <p style="color:#71717a;font-size:14px">Si no fuiste vos, no hace falta que hagas nada: tu contraseña actual sigue funcionando.</p>`
    );

    return respuesta;
  },
  {
    bodySchema: recuperarSchema,
    rateLimit: RATE_LIMITS.AUTH_RECUPERAR,
    // Quien pide recuperar su cuenta no tiene sesión y por lo tanto tampoco
    // cookie de CSRF — igual que login, register y google.
    requireCsrf: false,
  }
);
