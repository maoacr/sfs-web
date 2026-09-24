import { NextResponse } from "next/server";
import { db, slotConfigs } from "@sfs/db";
import { eq, asc } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import { createSlotSchema, type CreateSlotInput } from "@/lib/schemas";
import { canchaDelDueno } from "@/lib/consultas";

/**
 * GET /api/canchas/[id]/slots
 */
export const GET = apiHandler(
  async (_request, ctx, _validated) => {
    const { id } = ctx.params;
    if (!(await canchaDelDueno(id, ctx.user!.sub))) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }

    const slots = await db.query.slotConfigs.findMany({
      where: eq(slotConfigs.canchaId, id),
      orderBy: [asc(slotConfigs.diaSemana)],
    });

    return NextResponse.json(slots);
  },
  { requireAuth: true, requiredRole: "OWNER" }
);

/**
 * POST /api/canchas/[id]/slots
 */
export const POST = apiHandler<CreateSlotInput>(
  async (_request, ctx, { body }) => {
    const { id } = ctx.params;
    if (!body) {
      return NextResponse.json({ error: "Datos requeridos" }, { status: 400 });
    }
    if (!(await canchaDelDueno(id, ctx.user!.sub))) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }

    const [slot] = await db
      .insert(slotConfigs)
      .values({
        canchaId: id,
        diaSemana: body.diaSemana,
        horaApertura: body.horaApertura,
        horaCierre: body.horaCierre,
      })
      .returning();

    return NextResponse.json(slot, { status: 201 });
  },
  { requireAuth: true, requiredRole: "OWNER", bodySchema: createSlotSchema }
);
