import { NextResponse } from "next/server";
import { db, slotConfigs } from "@sfs/db";
import { eq, and } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import { updateSlotSchema, type UpdateSlotInput } from "@/lib/schemas";
import { canchaDelDueno } from "@/lib/consultas";

/**
 * PUT /api/canchas/[id]/slots/[slotId]
 */
export const PUT = apiHandler<UpdateSlotInput>(
  async (_request, ctx, { body }) => {
    const { id, slotId } = ctx.params;
    if (!(await canchaDelDueno(id, ctx.user!.sub))) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }

    const [slot] = await db
      .update(slotConfigs)
      .set(body ?? {})
      .where(and(eq(slotConfigs.id, slotId), eq(slotConfigs.canchaId, id)))
      .returning();

    if (!slot) {
      return NextResponse.json({ error: "Horario no encontrado" }, { status: 404 });
    }

    return NextResponse.json(slot);
  },
  { requireAuth: true, requiredRole: "OWNER", bodySchema: updateSlotSchema }
);

/**
 * DELETE /api/canchas/[id]/slots/[slotId]
 */
export const DELETE = apiHandler(
  async (_request, ctx, _validated) => {
    const { id, slotId } = ctx.params;
    if (!(await canchaDelDueno(id, ctx.user!.sub))) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }

    await db.delete(slotConfigs).where(and(eq(slotConfigs.id, slotId), eq(slotConfigs.canchaId, id)));

    return NextResponse.json({ ok: true });
  },
  { requireAuth: true, requiredRole: "OWNER" }
);
