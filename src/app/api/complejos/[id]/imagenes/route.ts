import { NextResponse } from "next/server";
import { db, complejos, imagenesComplejos } from "@sfs/db";
import { and, eq } from "drizzle-orm";
import { getAuthUser, AuthError } from "@/lib/auth-api";
import { uploadImage, deleteImage } from "@/lib/storage";

async function esComplejoDelDueno(complejoId: string, userId: string) {
  const complejo = await db.query.complejos.findFirst({
    where: and(eq(complejos.id, complejoId), eq(complejos.tenantId, userId)),
    columns: { id: true },
  });
  return !!complejo;
}

/**
 * POST /api/complejos/[id]/imagenes
 * Sube una imagen para un complejo.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    if (!(await esComplejoDelDueno(id, user.sub))) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });

    const url = await uploadImage(file, `complejos/${id}`, "photo");

    const [imagen] = await db
      .insert(imagenesComplejos)
      .values({ complejoId: id, url, orden: "0" })
      .returning();

    return NextResponse.json(imagen, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("POST /api/complejos/[id]/imagenes error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * DELETE /api/complejos/[id]/imagenes?id=imagenId
 * Elimina una imagen de un complejo.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    if (!(await esComplejoDelDueno(id, user.sub))) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const imagenId = new URL(request.url).searchParams.get("id");
    if (!imagenId) return NextResponse.json({ error: "ID de imagen requerido" }, { status: 400 });

    const imagen = await db.query.imagenesComplejos.findFirst({
      where: and(eq(imagenesComplejos.id, imagenId), eq(imagenesComplejos.complejoId, id)),
    });
    if (!imagen) return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });

    await deleteImage(imagen.url);
    await db.delete(imagenesComplejos).where(eq(imagenesComplejos.id, imagenId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("DELETE /api/complejos/[id]/imagenes error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
