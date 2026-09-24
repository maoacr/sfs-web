import { NextResponse } from "next/server";
import { db, canchas, imagenesCanchas } from "@sfs/db";
import { and, count, eq } from "drizzle-orm";
import { getAuthUser, AuthError } from "@/lib/auth-api";
import { uploadImage, deleteImage } from "@/lib/storage";

async function esCanchaDelDueno(canchaId: string, userId: string) {
  const cancha = await db.query.canchas.findFirst({
    where: and(eq(canchas.id, canchaId), eq(canchas.tenantId, userId)),
    columns: { id: true },
  });
  return !!cancha;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    if (!(await esCanchaDelDueno(id, user.sub))) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });

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
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("POST /api/canchas/[id]/imagenes error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    if (!(await esCanchaDelDueno(id, user.sub))) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const imagenId = new URL(request.url).searchParams.get("id");
    if (!imagenId) return NextResponse.json({ error: "ID de imagen requerido" }, { status: 400 });

    const imagen = await db.query.imagenesCanchas.findFirst({
      where: and(eq(imagenesCanchas.id, imagenId), eq(imagenesCanchas.canchaId, id)),
    });
    if (!imagen) return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });

    await deleteImage(imagen.url);
    await db.delete(imagenesCanchas).where(eq(imagenesCanchas.id, imagenId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("DELETE /api/canchas/[id]/imagenes error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
