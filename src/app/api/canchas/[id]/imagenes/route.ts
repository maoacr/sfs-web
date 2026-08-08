import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { getAuthUser, AuthError } from "@/lib/auth-api";
import { uploadImage, deleteImage } from "@/lib/storage";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    const cancha = await prisma.cancha.findFirst({ where: { id, tenantId: user.sub } });
    if (!cancha) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });

    const url = await uploadImage(file, `canchas/${id}`, "photo");

    const imagen = await prisma.imagenCancha.create({
      data: { canchaId: id, url, orden: 0 },
    });

    return NextResponse.json(imagen, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
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

    const cancha = await prisma.cancha.findFirst({ where: { id, tenantId: user.sub } });
    if (!cancha) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const imagenId = searchParams.get("id");
    if (!imagenId) return NextResponse.json({ error: "ID de imagen requerido" }, { status: 400 });

    const imagen = await prisma.imagenCancha.findFirst({ where: { id: imagenId, canchaId: id } });
    if (!imagen) return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });

    await deleteImage(imagen.url);
    await prisma.imagenCancha.delete({ where: { id: imagenId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
