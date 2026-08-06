import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { getAuthUser, AuthError } from "@/lib/auth-api";

/**
 * GET /api/canchas/[id]/slots
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    // Verificar propiedad
    const cancha = await prisma.cancha.findFirst({
      where: { id, tenantId: user.sub },
    });
    if (!cancha) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const slots = await prisma.slotConfig.findMany({
      where: { canchaId: id },
      orderBy: { diaSemana: "asc" },
    });

    return NextResponse.json(slots);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * POST /api/canchas/[id]/slots
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    const cancha = await prisma.cancha.findFirst({
      where: { id, tenantId: user.sub },
    });
    if (!cancha) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const body = await request.json();

    const slot = await prisma.slotConfig.create({
      data: {
        canchaId: id,
        diaSemana: body.diaSemana,
        horaApertura: new Date(`1970-01-01T${body.horaApertura || "08:00:00"}.000Z`),
        horaCierre: new Date(`1970-01-01T${body.horaCierre || "23:00:00"}.000Z`),
      },
    });

    return NextResponse.json(slot, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
