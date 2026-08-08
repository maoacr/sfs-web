import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { getAuthUser, AuthError } from "@/lib/auth-api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;
    const complejo = await prisma.complejo.findFirst({
      where: { id, tenantId: user.sub },
      include: { imagenes: { orderBy: { orden: "asc" } }, canchas: true },
    });
    if (!complejo) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json(complejo);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    const existente = await prisma.complejo.findFirst({ where: { id, tenantId: user.sub } });
    if (!existente) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const body = await request.json();
    const complejo = await prisma.complejo.update({
      where: { id },
      data: {
        ...(body.nombre !== undefined && { nombre: body.nombre }),
        ...(body.direccion !== undefined && { direccion: body.direccion }),
        ...(body.descripcion !== undefined && { descripcion: body.descripcion }),
        ...(body.telefono !== undefined && { telefono: body.telefono }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.instagram !== undefined && { instagram: body.instagram }),
        ...(body.tiktok !== undefined && { tiktok: body.tiktok }),
        ...(body.twitter !== undefined && { twitter: body.twitter }),
        ...(body.facebook !== undefined && { facebook: body.facebook }),
      },
    });

    return NextResponse.json(complejo);
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

    const existente = await prisma.complejo.findFirst({ where: { id, tenantId: user.sub } });
    if (!existente) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    await prisma.complejo.update({ where: { id }, data: { deletedAt: new Date() } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
