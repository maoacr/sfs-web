import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
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
    const cancha = await prisma.cancha.findFirst({
      where: { id, tenantId: user.sub },
    });
    if (!cancha) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.horaApertura) data.horaApertura = new Date(`1970-01-01T${body.horaApertura}.000Z`);
    if (body.horaCierre) data.horaCierre = new Date(`1970-01-01T${body.horaCierre}.000Z`);
    if (body.diaSemana !== undefined) data.diaSemana = body.diaSemana;

    const slot = await prisma.slotConfig.update({
      where: { id: slotId, canchaId: id },
      data,
    });

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

    const cancha = await prisma.cancha.findFirst({
      where: { id, tenantId: user.sub },
    });
    if (!cancha) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    await prisma.slotConfig.delete({ where: { id: slotId, canchaId: id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
