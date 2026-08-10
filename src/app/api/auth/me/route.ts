import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import bcrypt from "bcryptjs";
import { apiHandler } from "@/lib/api-handler";
import { updateProfileSchema } from "@/lib/schemas";
import { generateCsrfToken } from "@/lib/csrf";

/**
 * GET /api/auth/me
 * Obtiene el perfil del usuario autenticado.
 */
export const GET = apiHandler(
  async (_request, ctx, _validated) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.user!.sub },
      select: {
        id: true,
        email: true,
        primerNombre: true,
        segundoNombre: true,
        apellidos: true,
        apodo: true,
        codigoPais: true,
        telefono: true,
        role: true,
        instagram: true,
        tiktok: true,
        twitter: true,
        facebook: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const response = NextResponse.json({ user });

    // Incluir CSRF token para que el frontend lo cachee
    const csrfToken = generateCsrfToken();
    response.cookies.set("csrf_token", csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    response.headers.set("X-CSRF-Token", csrfToken);

    return response;
  },
  { requireAuth: true }
);

/**
 * PATCH /api/auth/me
 * Actualiza el perfil del usuario autenticado.
 */
export const PATCH = apiHandler(
  async (_request, ctx, { body }) => {
    const userId = ctx.user!.sub;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: body!,
      select: {
        id: true,
        email: true,
        primerNombre: true,
        segundoNombre: true,
        apellidos: true,
        apodo: true,
        codigoPais: true,
        telefono: true,
        role: true,
      },
    });

    return NextResponse.json({ user: updated });
  },
  {
    requireAuth: true,
    bodySchema: updateProfileSchema,
  }
);
