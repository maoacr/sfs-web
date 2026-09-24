import { NextResponse } from "next/server";
import { db, canchas, slotConfigs } from "@sfs/db";
import { eq, and, asc } from "drizzle-orm";
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
    const cancha = await db.query.canchas.findFirst({
      where: and(eq(canchas.id, id), eq(canchas.tenantId, user.sub)),
    });
    if (!cancha) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const slots = await db.query.slotConfigs.findMany({
      where: eq(slotConfigs.canchaId, id),
      orderBy: [asc(slotConfigs.diaSemana)],
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

    const cancha = await db.query.canchas.findFirst({
      where: and(eq(canchas.id, id), eq(canchas.tenantId, user.sub)),
    });
    if (!cancha) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const body = await request.json();

    const [slot] = await db
      .insert(slotConfigs)
      .values({
        canchaId: id,
        diaSemana: Number(body.diaSemana),
        horaApertura: body.horaApertura || "08:00:00",
        horaCierre: body.horaCierre || "23:00:00",
      })
      .returning();

    return NextResponse.json(slot, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
