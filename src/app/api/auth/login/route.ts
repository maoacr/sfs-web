import { NextResponse } from "next/server";
import { db, usuarios } from "@sfs/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signAccessToken, signRefreshToken } from "@/lib/jwt";
import { apiHandler } from "@/lib/api-handler";
import { loginSchema, type LoginInput } from "@/lib/schemas";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { setCsrfCookie } from "@/lib/csrf";
import { setSessionCookies } from "@/lib/cookies";

/**
 * POST /api/auth/login
 */
export const POST = apiHandler<LoginInput>(
  async (_request, _ctx, { body }) => {
    if (!body) {
      return NextResponse.json({ error: "Datos requeridos" }, { status: 400 });
    }

    const { email, password } = body;

    const user = await db.query.usuarios.findFirst({
      where: eq(usuarios.email, email.toLowerCase().trim()),
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "Email o contraseña incorrectos" },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Email o contraseña incorrectos" },
        { status: 401 }
      );
    }

    if (user.rol === "ADMIN") {
      return NextResponse.json(
        { error: "Este tipo de cuenta no tiene acceso a la app" },
        { status: 403 }
      );
    }

    const tokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.rol,
    };

    const accessToken = await signAccessToken(tokenPayload);
    const refreshToken = await signRefreshToken(user.id);

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        nombre: `${user.nombre} ${user.apellido}`.trim(),
        apodo: user.apodo,
        role: user.rol,
      },
    });

    setSessionCookies(response, { accessToken, refreshToken });
    setCsrfCookie(response);

    return response;
  },
  {
    bodySchema: loginSchema,
    rateLimit: RATE_LIMITS.AUTH_LOGIN,
    requireCsrf: false,
  }
);
