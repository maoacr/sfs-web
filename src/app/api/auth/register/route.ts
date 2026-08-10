import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import bcrypt from "bcryptjs";
import { signAccessToken, signRefreshToken } from "@/lib/jwt";
import { apiHandler } from "@/lib/api-handler";
import { registerSchema, type RegisterInput } from "@/lib/schemas";
import { RATE_LIMITS } from "@/lib/rate-limit";

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
      codigoPais,
      telefono,
      role,
      instagram,
      tiktok,
      twitter,
      facebook,
    } = body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "El email ya está registrado" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        primerNombre,
        segundoNombre: segundoNombre || null,
        apellidos,
        apodo: apodo || null,
        codigoPais: codigoPais || "+57",
        telefono: telefono || null,
        role,
        instagram: instagram || null,
        tiktok: tiktok || null,
        twitter: twitter || null,
        facebook: facebook || null,
      },
    });

    const tokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await signAccessToken(tokenPayload);
    const refreshToken = await signRefreshToken(user.id);

    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          nombre: `${user.primerNombre} ${user.segundoNombre ?? ""} ${user.apellidos}`.trim(),
          apodo: user.apodo,
          role: user.role,
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

    return response;
  },
  {
    bodySchema: registerSchema,
    rateLimit: RATE_LIMITS.AUTH_REGISTER,
    requireCsrf: false,
  }
);
