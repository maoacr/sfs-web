import { NextResponse } from "next/server";
import { db, usuarios } from "@sfs/db";
import { eq } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import {
  uploadPrivateImage,
  signedUrlFor,
  deletePrivateImage,
  AVATAR_URL_TTL_SEGUNDOS,
} from "@/lib/storage";
import { TAMANO_MAXIMO_DE_IMAGEN_BYTES, TAMANO_MAXIMO_DE_IMAGEN_MB } from "@/lib/imagenes";

/**
 * POST /api/auth/me/avatar (multipart: file)
 *
 * Sube la foto de perfil del usuario autenticado. Cualquier rol puede tener
 * foto, así que no se pide `requiredRole`.
 *
 * La foto va al bucket PRIVADO: es la cara de una persona, no una cancha. En
 * `usuarios.avatarUrl` se guarda la RUTA del objeto y no una URL, porque la
 * URL firmada vence y persistirla dejaría perfiles con links muertos.
 */
export const POST = apiHandler(
  async (request, ctx) => {
    const usuarioId = ctx.user!.sub;

    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "El archivo debe ser una imagen" }, { status: 400 });
    }
    // Antes de tocar sharp: decodificar un archivo enorme se come la memoria
    // del proceso, y el límite del cliente no es una garantía.
    if (file.size > TAMANO_MAXIMO_DE_IMAGEN_BYTES) {
      return NextResponse.json(
        { error: `La imagen no debe superar ${TAMANO_MAXIMO_DE_IMAGEN_MB}MB` },
        { status: 400 }
      );
    }

    const actual = await db.query.usuarios.findFirst({
      where: eq(usuarios.id, usuarioId),
      columns: { avatarUrl: true },
    });

    const ruta = await uploadPrivateImage(file, `usuarios/${usuarioId}`, "profile");
    await db.update(usuarios).set({ avatarUrl: ruta }).where(eq(usuarios.id, usuarioId));

    // Recién ahora se borra la vieja: si el borrado falla, el perfil ya quedó
    // apuntando a la foto nueva. Al revés, un fallo al subir dejaría al usuario
    // sin ninguna de las dos.
    if (actual?.avatarUrl) {
      await deletePrivateImage(actual.avatarUrl);
    }

    return NextResponse.json(
      { avatarUrl: await signedUrlFor(ruta, AVATAR_URL_TTL_SEGUNDOS) },
      { status: 201 }
    );
  },
  { requireAuth: true }
);
