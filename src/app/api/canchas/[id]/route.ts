import { NextResponse } from "next/server";
import { db, canchas, complejos, imagenesCanchas, slotConfigs, tarifas } from "@sfs/db";
import { eq, and, isNull, asc } from "drizzle-orm";
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

    const cancha = await db.query.canchas.findFirst({
      where: and(eq(canchas.id, id), eq(canchas.tenantId, user.sub)),
      with: {
        complejo: true,
        imagenes: {
          orderBy: (img, { asc }) => [asc(img.orden)],
        },
        slots: {
          orderBy: (s, { asc }) => [asc(s.diaSemana)],
        },
        tarifas: {
          with: {
            promociones: true,
          },
        },
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

    const existente = await db.query.canchas.findFirst({
      where: and(eq(canchas.id, id), eq(canchas.tenantId, user.sub)),
    });

    if (!existente) {
      return NextResponse.json(
        { error: "Cancha no encontrada" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updateData: Partial<typeof canchas.$inferInsert> = {};

    if (body.nombre !== undefined) updateData.nombre = body.nombre;
    if (body.tipo !== undefined) updateData.tipo = body.tipo;
    if (body.capacidad !== undefined) updateData.capacidad = body.capacidad;
    if (body.descripcion !== undefined) updateData.descripcion = body.descripcion;
    if (body.servicios !== undefined) updateData.servicios = body.servicios;
    if (body.duracionSlotMinutos !== undefined) updateData.duracionSlotMinutos = body.duracionSlotMinutos;

    const [cancha] = await db
      .update(canchas)
      .set(updateData)
      .where(eq(canchas.id, id))
      .returning();

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

    const existente = await db.query.canchas.findFirst({
      where: and(eq(canchas.id, id), eq(canchas.tenantId, user.sub)),
    });

    if (!existente) {
      return NextResponse.json(
        { error: "Cancha no encontrada" },
        { status: 404 }
      );
    }

    await db
      .update(canchas)
      .set({ deletedAt: new Date() })
      .where(eq(canchas.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("DELETE /api/canchas/[id] error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
