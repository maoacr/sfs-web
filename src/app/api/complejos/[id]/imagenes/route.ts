import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { getAuthUser, AuthError } from "@/lib/auth-api";
import { uploadImage, deleteImage } from "@/lib/storage";

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

    const complejo = await prisma.complejo.findFirst({ where: { id, tenantId: user.sub } });
    if (!complejo) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });

    const url = await uploadImage(file, `complejos/${id}`);

    const imagen = await prisma.complejoImagen.create({
      data: { complejoId: id, url, orden: 0 },
    });

    return NextResponse.json(imagen, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
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

    const complejo = await prisma.complejo.findFirst({ where: { id, tenantId: user.sub } });
    if (!complejo) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const imagenId = searchParams.get("id");
    if (!imagenId) return NextResponse.json({ error: "ID de imagen requerido" }, { status: 400 });

    const imagen = await prisma.complejoImagen.findFirst({ where: { id: imagenId, complejoId: id } });
    if (!imagen) return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });

    await deleteImage(imagen.url);
    await prisma.complejoImagen.delete({ where: { id: imagenId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
