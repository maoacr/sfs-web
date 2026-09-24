import { NextResponse } from "next/server";
import { db, usuarios } from "@sfs/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signAccessToken, signRefreshToken } from "@/lib/jwt";
import { apiHandler } from "@/lib/api-handler";
import { loginSchema, type LoginInput } from "@/lib/schemas";
import { RATE_LIMITS } from "@/lib/rate-limit";

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

    return response;
  },
  {
    bodySchema: loginSchema,
    rateLimit: RATE_LIMITS.AUTH_LOGIN,
    requireCsrf: false,
  }
);
