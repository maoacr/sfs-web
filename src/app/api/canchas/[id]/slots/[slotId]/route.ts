import { NextResponse } from "next/server";
import { db, canchas, slotConfigs } from "@sfs/db";
import { eq, and } from "drizzle-orm";
import { getAuthUser, AuthError } from "@/lib/auth-api";

/**
 * PUT /api/canchas/[id]/slots/[slotId]
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; slotId: string }> }
) {
  try {
    const user = await getAuthUser(request);
    const { id, slotId } = await params;

    // Verificar que la cancha pertenece al dueño
    const cancha = await db.query.canchas.findFirst({
      where: and(eq(canchas.id, id), eq(canchas.tenantId, user.sub)),
    });
    if (!cancha) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const body = await request.json();
    const updateData: Partial<typeof slotConfigs.$inferInsert> = {};

    if (body.horaApertura) updateData.horaApertura = body.horaApertura;
    if (body.horaCierre) updateData.horaCierre = body.horaCierre;
    if (body.diaSemana !== undefined) updateData.diaSemana = Number(body.diaSemana);

    const [slot] = await db
      .update(slotConfigs)
      .set(updateData)
      .where(and(eq(slotConfigs.id, slotId), eq(slotConfigs.canchaId, id)))
      .returning();

    return NextResponse.json(slot);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * DELETE /api/canchas/[id]/slots/[slotId]
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; slotId: string }> }
) {
  try {
    const user = await getAuthUser(request);
    const { id, slotId } = await params;

    const cancha = await db.query.canchas.findFirst({
      where: and(eq(canchas.id, id), eq(canchas.tenantId, user.sub)),
    });
    if (!cancha) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    await db
      .delete(slotConfigs)
      .where(and(eq(slotConfigs.id, slotId), eq(slotConfigs.canchaId, id)));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
