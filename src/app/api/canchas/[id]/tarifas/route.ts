import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { getAuthUser, AuthError } from "@/lib/auth-api";

/**
 * POST /api/canchas/[id]/tarifas
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

    const tarifa = await prisma.tarifa.create({
      data: {
        canchaId: id,
        precioBase: body.precioBase,
        diaSemana: body.diaSemana ?? null,
        horaInicio: body.horaInicio ? new Date(`1970-01-01T${body.horaInicio}.000Z`) : null,
        horaFin: body.horaFin ? new Date(`1970-01-01T${body.horaFin}.000Z`) : null,
        factor: body.factor ?? 1.0,
      },
    });

    return NextResponse.json(tarifa, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
