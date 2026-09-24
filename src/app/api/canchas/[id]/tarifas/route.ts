import { NextResponse } from "next/server";
import { db, canchas, tarifas } from "@sfs/db";
import { and, eq } from "drizzle-orm";
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

    const cancha = await db.query.canchas.findFirst({
      where: and(eq(canchas.id, id), eq(canchas.tenantId, user.sub)),
      columns: { id: true },
    });
    if (!cancha) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const body = await request.json();

    const [tarifa] = await db
      .insert(tarifas)
      .values({
        canchaId: id,
        precioBase: String(body.precioBase),
        diaSemana: body.diaSemana ?? null,
        horaInicio: body.horaInicio || null,
        horaFin: body.horaFin || null,
        factor: String(body.factor ?? 1),
      })
      .returning();

    return NextResponse.json(tarifa, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("POST /api/canchas/[id]/tarifas error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
