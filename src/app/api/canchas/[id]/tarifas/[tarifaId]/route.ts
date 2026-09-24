import { NextResponse } from "next/server";
import { db, canchas, tarifas } from "@sfs/db";
import { and, eq } from "drizzle-orm";
import { getAuthUser, AuthError } from "@/lib/auth-api";

async function esCanchaDelDueno(canchaId: string, userId: string) {
  const cancha = await db.query.canchas.findFirst({
    where: and(eq(canchas.id, canchaId), eq(canchas.tenantId, userId)),
    columns: { id: true },
  });
  return !!cancha;
}

/**
 * PUT /api/canchas/[id]/tarifas/[tarifaId]
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; tarifaId: string }> }
) {
  try {
    const user = await getAuthUser(request);
    const { id, tarifaId } = await params;

    if (!(await esCanchaDelDueno(id, user.sub))) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }

    const body = await request.json();
    const data: Partial<typeof tarifas.$inferInsert> = {};

    if (body.precioBase !== undefined) data.precioBase = String(body.precioBase);
    if (body.factor !== undefined) data.factor = String(body.factor);
    if (body.diaSemana !== undefined) data.diaSemana = body.diaSemana;
    if (body.horaInicio) data.horaInicio = body.horaInicio;
    if (body.horaFin) data.horaFin = body.horaFin;

    const [tarifa] = await db
      .update(tarifas)
      .set(data)
      .where(and(eq(tarifas.id, tarifaId), eq(tarifas.canchaId, id)))
      .returning();

    if (!tarifa) return NextResponse.json({ error: "Tarifa no encontrada" }, { status: 404 });

    return NextResponse.json(tarifa);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("PUT /api/canchas/[id]/tarifas/[tarifaId] error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * DELETE /api/canchas/[id]/tarifas/[tarifaId]
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; tarifaId: string }> }
) {
  try {
    const user = await getAuthUser(request);
    const { id, tarifaId } = await params;

    if (!(await esCanchaDelDueno(id, user.sub))) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }

    await db.delete(tarifas).where(and(eq(tarifas.id, tarifaId), eq(tarifas.canchaId, id)));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("DELETE /api/canchas/[id]/tarifas/[tarifaId] error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
