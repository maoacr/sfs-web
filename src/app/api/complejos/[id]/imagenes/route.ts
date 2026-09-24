import { NextResponse } from "next/server";
import { db, imagenesComplejos } from "@sfs/db";
import { and, eq } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import { esUuid } from "@/lib/uuid";
import { uploadImage, deleteImage } from "@/lib/storage";
import { complejoDelDueno } from "@/lib/consultas";

/**
 * POST /api/complejos/[id]/imagenes (multipart: file)
 */
export const POST = apiHandler(
  async (request, ctx, _validated) => {
    const { id } = ctx.params;
    if (!(await complejoDelDueno(id, ctx.user!.sub))) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }

    const url = await uploadImage(file, `complejos/${id}`, "photo");

    const [imagen] = await db
      .insert(imagenesComplejos)
      .values({ complejoId: id, url, orden: "0" })
      .returning();

    return NextResponse.json(imagen, { status: 201 });
  },
  { requireAuth: true, requiredRole: "OWNER" }
);

/**
 * DELETE /api/complejos/[id]/imagenes?id=imagenId
 */
export const DELETE = apiHandler(
  async (request, ctx, _validated) => {
    const { id } = ctx.params;
    if (!(await complejoDelDueno(id, ctx.user!.sub))) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const imagenId = new URL(request.url).searchParams.get("id");
    if (!esUuid(imagenId)) return NextResponse.json({ error: "ID de imagen inválido" }, { status: 400 });

    const imagen = await db.query.imagenesComplejos.findFirst({
      where: and(eq(imagenesComplejos.id, imagenId), eq(imagenesComplejos.complejoId, id)),
    });
    if (!imagen) return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });

    await deleteImage(imagen.url);
    await db.delete(imagenesComplejos).where(eq(imagenesComplejos.id, imagenId));

    return NextResponse.json({ ok: true });
  },
  { requireAuth: true, requiredRole: "OWNER" }
);
