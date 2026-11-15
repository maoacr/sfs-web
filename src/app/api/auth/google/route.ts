import { NextResponse } from "next/server";
import { db, usuarios } from "@sfs/db";
import { eq } from "drizzle-orm";
import { signAccessToken, signRefreshToken } from "@/lib/jwt";
import { apiHandler } from "@/lib/api-handler";
import { googleAuthSchema, type GoogleAuthInput } from "@/lib/schemas";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { setCsrfCookie } from "@/lib/csrf";
import { setSessionCookies } from "@/lib/cookies";
import { getSupabase } from "@/lib/supabase";
import { enviarEmail } from "@/lib/email";
import {
  decidirVinculo,
  nombreDesdeGoogle,
  type CuentaExistente,
  type IdentidadGoogle,
} from "@/lib/google-auth";

/**
 * POST /api/auth/google
 *
 * El puente entre la identidad de Google (que negocia Supabase) y la sesión de
 * SFS (que seguimos emitiendo nosotros, igual que en `/api/auth/login`).
 *
 * Supabase es acá un BROKER de identidad, no el dueño de la sesión: su fila en
 * `auth.users` es un recibo que nadie consulta. La fuente de verdad del
 * dominio sigue siendo `public.usuarios`, que es la que tiene las FKs de
 * reservas, pagos y partidos.
 *
 * Lo único que aceptamos del browser es el access token. El email, el nombre y
 * el `sub` los leemos del token ya verificado contra Supabase — si viniesen en
 * el body, cualquiera podría entrar como cualquiera.
 */
export const POST = apiHandler<GoogleAuthInput>(
  async (_request, _ctx, { body }) => {
    if (!body) {
      return NextResponse.json({ error: "Datos requeridos" }, { status: 400 });
    }

    // ─── 1. Verificar el token contra Supabase ──────────────────────────────

    const { data, error } = await getSupabase().auth.getUser(body.accessToken);
    const supabaseUser = data?.user;

    if (error || !supabaseUser) {
      return NextResponse.json(
        { error: "Sesión de Google inválida o expirada" },
        { status: 401 }
      );
    }

    // ─── 2. Traducir el usuario de Supabase a nuestra identidad ─────────────

    const identidadGoogle = supabaseUser.identities?.find(
      (i) => i.provider === "google"
    );

    if (!identidadGoogle) {
      return NextResponse.json(
        { error: "Esta sesión no viene de Google" },
        { status: 400 }
      );
    }

    const metadata = (supabaseUser.user_metadata ?? {}) as Record<string, unknown>;
    const datosIdentidad = (identidadGoogle.identity_data ?? {}) as Record<string, unknown>;
    const email = supabaseUser.email?.toLowerCase().trim();

    if (!email) {
      return NextResponse.json(
        { error: "Google no compartió un email con nosotros" },
        { status: 400 }
      );
    }

    const identidad: IdentidadGoogle = {
      // `identities[].id` es el `sub` del proveedor, no el uuid de Supabase.
      sub: identidadGoogle.id,
      email,
      // Sólo el claim explícito de Google cuenta como prueba. No caemos a
      // `email_confirmed_at`, que Supabase setea por su cuenta y nos haría
      // saltear nuestra propia regla.
      emailVerificado:
        datosIdentidad.email_verified === true || metadata.email_verified === true,
      nombrePila: (datosIdentidad.given_name ?? metadata.given_name ?? null) as string | null,
      apellidos: (datosIdentidad.family_name ?? metadata.family_name ?? null) as string | null,
      nombreCompleto: (datosIdentidad.full_name ?? metadata.full_name ?? metadata.name ?? null) as
        | string
        | null,
      avatarUrl: (datosIdentidad.avatar_url ?? metadata.avatar_url ?? metadata.picture ?? null) as
        | string
        | null,
    };

    // ─── 3. Buscar a quién corresponde y decidir ────────────────────────────

    const [porGoogleSub, porEmail] = await Promise.all([
      db.query.usuarios.findFirst({ where: eq(usuarios.googleSub, identidad.sub) }),
      db.query.usuarios.findFirst({ where: eq(usuarios.email, identidad.email) }),
    ]);

    const resumen = (fila: typeof porEmail): CuentaExistente | null =>
      fila ? { id: fila.id, rol: fila.rol, tienePassword: fila.passwordHash !== null } : null;

    const accion = decidirVinculo(identidad, {
      porGoogleSub: resumen(porGoogleSub),
      porEmail: resumen(porEmail),
    });

    if (accion.tipo === "RECHAZAR") {
      return NextResponse.json({ error: accion.motivo }, { status: 403 });
    }

    // ─── 4. Ejecutar ────────────────────────────────────────────────────────

    let usuario: NonNullable<typeof porEmail>;

    if (accion.tipo === "ENTRAR") {
      usuario = porGoogleSub!;
    } else if (accion.tipo === "VINCULAR") {
      const [actualizado] = await db
        .update(usuarios)
        .set({
          googleSub: identidad.sub,
          // Google probó la propiedad del email; nuestro registro no prueba
          // nada. La contraseña anterior deja de valer.
          ...(accion.anularPassword ? { passwordHash: null } : {}),
          // No pisamos un avatar que el usuario haya elegido.
          ...(porEmail!.avatarUrl ? {} : { avatarUrl: identidad.avatarUrl }),
        })
        .where(eq(usuarios.id, accion.usuarioId))
        .returning();

      usuario = actualizado;

      if (accion.anularPassword) {
        await enviarEmail(
          usuario.email,
          "Tu cuenta de SFS ahora inicia sesión con Google",
          `<p>Hola ${usuario.nombre},</p>
           <p>Vinculamos tu cuenta de SFS a tu cuenta de Google. Desde ahora entrás con el botón <strong>Continuar con Google</strong>.</p>
           <p>Por seguridad, <strong>la contraseña que tenía esta cuenta quedó anulada</strong>.</p>
           <p style="color:#71717a;font-size:14px">Si no fuiste vos, escribinos: alguien había registrado una cuenta con tu email.</p>`
        );
      }
    } else {
      const { nombre, apellido } = nombreDesdeGoogle(identidad);
      const [creado] = await db
        .insert(usuarios)
        .values({
          email: identidad.email,
          googleSub: identidad.sub,
          // Sin contraseña: esta cuenta entra sólo por Google.
          passwordHash: null,
          nombre,
          apellido,
          avatarUrl: identidad.avatarUrl ?? null,
          // `rol` cae en su default PLAYER. Un dueño necesita datos de complejo
          // que Google no nos da, así que sigue pasando por el registro.
        })
        .returning();

      usuario = creado;
    }

    // ─── 5. Emitir NUESTRA sesión ───────────────────────────────────────────

    const rol = usuario.rol as "OWNER" | "PLAYER";
    const accessToken = await signAccessToken({
      sub: usuario.id,
      email: usuario.email,
      role: rol,
    });
    const refreshToken = await signRefreshToken(usuario.id);

    const response = NextResponse.json({
      user: {
        id: usuario.id,
        email: usuario.email,
        nombre: `${usuario.nombre} ${usuario.apellido}`.trim(),
        apodo: usuario.apodo,
        role: rol,
      },
    });

    setSessionCookies(response, { accessToken, refreshToken });
    setCsrfCookie(response);

    return response;
  },
  {
    bodySchema: googleAuthSchema,
    rateLimit: RATE_LIMITS.AUTH_LOGIN,
    // La credencial es el access token verificado contra Supabase, no la
    // cookie — igual que login y register, que también establecen sesión.
    requireCsrf: false,
  }
);
