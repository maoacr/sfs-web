import { NextResponse } from "next/server";
import { db, imagenesCanchas } from "@sfs/db";
import { and, count, eq } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import { esUuid } from "@/lib/uuid";
import { uploadImage, deleteImage } from "@/lib/storage";
import { canchaDelDueno } from "@/lib/consultas";

/**
 * POST /api/canchas/[id]/imagenes (multipart: file)
 */
export const POST = apiHandler(
  async (request, ctx, _validated) => {
    const { id } = ctx.params;
    if (!(await canchaDelDueno(id, ctx.user!.sub))) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }

    const url = await uploadImage(file, `canchas/${id}`, "photo");

    const [{ existentes }] = await db
      .select({ existentes: count() })
      .from(imagenesCanchas)
      .where(eq(imagenesCanchas.canchaId, id));

    const [imagen] = await db
      .insert(imagenesCanchas)
      .values({ canchaId: id, url, orden: existentes, principal: existentes === 0 })
      .returning();

    return NextResponse.json(imagen, { status: 201 });
  },
  { requireAuth: true, requiredRole: "OWNER" }
);

/**
 * DELETE /api/canchas/[id]/imagenes?id=imagenId
 */
export const DELETE = apiHandler(
  async (request, ctx, _validated) => {
    const { id } = ctx.params;
    if (!(await canchaDelDueno(id, ctx.user!.sub))) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const imagenId = new URL(request.url).searchParams.get("id");
    if (!esUuid(imagenId)) return NextResponse.json({ error: "ID de imagen inválido" }, { status: 400 });

    const imagen = await db.query.imagenesCanchas.findFirst({
      where: and(eq(imagenesCanchas.id, imagenId), eq(imagenesCanchas.canchaId, id)),
    });
    if (!imagen) return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });

    await deleteImage(imagen.url);
    await db.delete(imagenesCanchas).where(eq(imagenesCanchas.id, imagenId));

    return NextResponse.json({ ok: true });
  },
  { requireAuth: true, requiredRole: "OWNER" }
);
