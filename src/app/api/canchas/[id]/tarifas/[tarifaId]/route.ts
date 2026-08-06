import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { getAuthUser, AuthError } from "@/lib/auth-api";

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

    const cancha = await prisma.cancha.findFirst({
      where: { id, tenantId: user.sub },
    });
    if (!cancha) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.precioBase !== undefined) data.precioBase = body.precioBase;
    if (body.factor !== undefined) data.factor = body.factor;
    if (body.diaSemana !== undefined) data.diaSemana = body.diaSemana;
    if (body.horaInicio) data.horaInicio = new Date(`1970-01-01T${body.horaInicio}.000Z`);
    if (body.horaFin) data.horaFin = new Date(`1970-01-01T${body.horaFin}.000Z`);

    const tarifa = await prisma.tarifa.update({
      where: { id: tarifaId, canchaId: id },
      data,
    });

    return NextResponse.json(tarifa);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
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

    const cancha = await prisma.cancha.findFirst({
      where: { id, tenantId: user.sub },
    });
    if (!cancha) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    await prisma.tarifa.delete({ where: { id: tarifaId, canchaId: id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
