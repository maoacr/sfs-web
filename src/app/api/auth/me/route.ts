import { NextResponse } from "next/server";
import { db, usuarios } from "@sfs/db";
import { eq } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import { updateProfileSchema } from "@/lib/schemas";
import { setCsrfCookie } from "@/lib/csrf";
import { signedUrlFor, AVATAR_URL_TTL_SEGUNDOS } from "@/lib/storage";

/**
 * GET /api/auth/me
 * Obtiene el perfil del usuario autenticado.
 */
export const GET = apiHandler(
  async (request, ctx, _validated) => {
    const user = await db.query.usuarios.findFirst({
      where: eq(usuarios.id, ctx.user!.sub),
      columns: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        apodo: true,
        telefono: true,
        codigoPais: true,
        rol: true,
        instagram: true,
        tiktok: true,
        twitter: true,
        facebook: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        primerNombre: user.nombre.split(" ")[0] || user.nombre,
        segundoNombre: user.nombre.split(" ").slice(1).join(" ") || null,
        apellidos: user.apellido,
        apodo: user.apodo,
        telefono: user.telefono,
        codigoPais: user.codigoPais,
        role: user.rol,
        instagram: user.instagram,
        tiktok: user.tiktok,
        twitter: user.twitter,
        facebook: user.facebook,
        // En la columna vive la ruta del objeto privado; al cliente solo le
        // viaja una URL firmada que vence.
        avatarUrl: await signedUrlFor(user.avatarUrl ?? "", AVATAR_URL_TTL_SEGUNDOS),
        createdAt: user.createdAt,
      },
    });

    setCsrfCookie(response, request.cookies.get("csrf_token")?.value);

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
    const updateData: Partial<typeof usuarios.$inferInsert> = {};

    if (body?.primerNombre || body?.segundoNombre) {
      const primerNombre = body.primerNombre || "";
      const segundoNombre = body.segundoNombre || "";
      updateData.nombre = `${primerNombre} ${segundoNombre}`.trim();
    }
    if (body?.apellidos) updateData.apellido = body.apellidos;
    if (body?.apodo !== undefined) updateData.apodo = body.apodo;
    if (body?.telefono !== undefined) updateData.telefono = body.telefono;
    if (body?.codigoPais !== undefined) updateData.codigoPais = body.codigoPais;
    if (body?.instagram !== undefined) updateData.instagram = body.instagram;
    if (body?.tiktok !== undefined) updateData.tiktok = body.tiktok;
    if (body?.twitter !== undefined) updateData.twitter = body.twitter;
    if (body?.facebook !== undefined) updateData.facebook = body.facebook;

    const [updated] = await db
      .update(usuarios)
      .set(updateData)
      .where(eq(usuarios.id, userId))
      .returning();

    return NextResponse.json({
      user: {
        id: updated.id,
        email: updated.email,
        primerNombre: updated.nombre.split(" ")[0] || updated.nombre,
        segundoNombre: updated.nombre.split(" ").slice(1).join(" ") || null,
        apellidos: updated.apellido,
        apodo: updated.apodo,
        telefono: updated.telefono,
        role: updated.rol,
      },
    });
  },
  {
    requireAuth: true,
    bodySchema: updateProfileSchema,
  }
);
