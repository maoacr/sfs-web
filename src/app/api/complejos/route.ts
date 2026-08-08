import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { getAuthUser, AuthError } from "@/lib/auth-api";

export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);

    const complejos = await prisma.complejo.findMany({
      where: { tenantId: user.sub, deletedAt: null },
      include: {
        _count: { select: { canchas: true } },
        canchas: { select: { id: true, nombre: true, tipo: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(complejos);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);
    const body = await request.json();

    if (!body.nombre || !body.direccion) {
      return NextResponse.json({ error: "Nombre y dirección son requeridos" }, { status: 400 });
    }

    const complejo = await prisma.complejo.create({
      data: {
        tenantId: user.sub,
        nombre: body.nombre,
        direccion: body.direccion,
        descripcion: body.descripcion || null,
        telefono: body.telefono || null,
        email: body.email || null,
        instagram: body.instagram || null,
        tiktok: body.tiktok || null,
        twitter: body.twitter || null,
        facebook: body.facebook || null,
        lat: body.lat || null,
        lng: body.lng || null,
      },
      include: { _count: { select: { canchas: true } } },
    });

    return NextResponse.json(complejo, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
