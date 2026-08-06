import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { getAuthUser, AuthError } from "@/lib/auth-api";

/**
 * GET /api/canchas/[id]
 * Obtiene una cancha específica (solo del dueño).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    const cancha = await prisma.cancha.findFirst({
      where: { id, tenantId: user.sub },
      include: {
        complejo: true,
        imagenes: { orderBy: { orden: "asc" } },
        slots: { orderBy: { diaSemana: "asc" } },
        tarifas: { include: { promociones: true } },
      },
    });

    if (!cancha) {
      return NextResponse.json(
        { error: "Cancha no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(cancha);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("GET /api/canchas/[id] error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * PUT /api/canchas/[id]
 * Actualiza una cancha existente.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    // Verificar propiedad
    const existente = await prisma.cancha.findFirst({
      where: { id, tenantId: user.sub },
    });

    if (!existente) {
      return NextResponse.json(
        { error: "Cancha no encontrada" },
        { status: 404 }
      );
    }

    const body = await request.json();

    const cancha = await prisma.cancha.update({
      where: { id },
      data: {
        ...(body.nombre !== undefined && { nombre: body.nombre }),
        ...(body.tipo !== undefined && { tipo: body.tipo }),
        ...(body.capacidad !== undefined && { capacidad: body.capacidad }),
        ...(body.descripcion !== undefined && { descripcion: body.descripcion }),
        ...(body.servicios !== undefined && { servicios: body.servicios }),
        ...(body.duracionSlotMinutos !== undefined && {
          duracionSlotMinutos: body.duracionSlotMinutos,
        }),
      },
      include: {
        imagenes: true,
        slots: true,
        tarifas: true,
      },
    });

    return NextResponse.json(cancha);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("PUT /api/canchas/[id] error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * DELETE /api/canchas/[id]
 * Soft delete de una cancha.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    const existente = await prisma.cancha.findFirst({
      where: { id, tenantId: user.sub },
    });

    if (!existente) {
      return NextResponse.json(
        { error: "Cancha no encontrada" },
        { status: 404 }
      );
    }

    await prisma.cancha.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("DELETE /api/canchas/[id] error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
