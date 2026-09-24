import { NextResponse } from "next/server";
import { db, usuarios } from "@sfs/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signAccessToken, signRefreshToken } from "@/lib/jwt";
import { apiHandler } from "@/lib/api-handler";
import { registerSchema, type RegisterInput } from "@/lib/schemas";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { setCsrfCookie } from "@/lib/csrf";

/**
 * POST /api/auth/register
 */
export const POST = apiHandler<RegisterInput>(
  async (_request, _ctx, { body }) => {
    if (!body) {
      return NextResponse.json({ error: "Datos requeridos" }, { status: 400 });
    }

    const {
      email,
      password,
      primerNombre,
      segundoNombre,
      apellidos,
      apodo,
      telefono,
      codigoPais,
      role,
      instagram,
      tiktok,
      twitter,
      facebook,
    } = body;

    const emailClean = email.toLowerCase().trim();

    const existing = await db.query.usuarios.findFirst({
      where: eq(usuarios.email, emailClean),
    });

    if (existing) {
      return NextResponse.json(
        { error: "El email ya está registrado" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const nombreCompleto = segundoNombre ? `${primerNombre} ${segundoNombre}` : primerNombre;

    const [user] = await db
      .insert(usuarios)
      .values({
        email: emailClean,
        passwordHash,
        nombre: nombreCompleto,
        apellido: apellidos,
        apodo: apodo || null,
        telefono: telefono || null,
        codigoPais,
        rol: role,
        instagram: instagram || null,
        tiktok: tiktok || null,
        twitter: twitter || null,
        facebook: facebook || null,
      })
      .returning();

    const tokenPayload = {
      sub: user.id,
      email: user.email,
      role,
    };

    const accessToken = await signAccessToken(tokenPayload);
    const refreshToken = await signRefreshToken(user.id);

    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          nombre: `${user.nombre} ${user.apellido}`.trim(),
          apodo: user.apodo,
          role: user.rol,
        },
      },
      { status: 201 }
    );

    response.cookies.set("sfs_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 15 * 60,
    });

    response.cookies.set("sfs_refresh", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    setCsrfCookie(response);

    return response;
  },
  {
    bodySchema: registerSchema,
    rateLimit: RATE_LIMITS.AUTH_REGISTER,
    requireCsrf: false,
  }
);
