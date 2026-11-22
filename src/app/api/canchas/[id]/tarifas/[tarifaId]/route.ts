import { NextResponse } from "next/server";
import { db, tarifas } from "@sfs/db";
import { and, eq } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import { updateTarifaSchema, type UpdateTarifaInput } from "@/lib/schemas";
import { canchaDelDueno } from "@/lib/consultas";

/**
 * PUT /api/canchas/[id]/tarifas/[tarifaId]
 */
export const PUT = apiHandler<UpdateTarifaInput>(
  async (_request, ctx, { body }) => {
    const { id, tarifaId } = ctx.params;
    if (!(await canchaDelDueno(id, ctx.user!.sub))) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }

    const datos = body ?? {};
    const data: Partial<typeof tarifas.$inferInsert> = {};
    if (datos.precioBase !== undefined) data.precioBase = String(datos.precioBase);
    if (datos.factor !== undefined) data.factor = String(datos.factor);
    if (datos.diaSemana !== undefined) data.diaSemana = datos.diaSemana;
    if (datos.horaInicio !== undefined) data.horaInicio = datos.horaInicio;
    if (datos.horaFin !== undefined) data.horaFin = datos.horaFin;

    const [tarifa] = await db
      .update(tarifas)
      .set(data)
      .where(and(eq(tarifas.id, tarifaId), eq(tarifas.canchaId, id)))
      .returning();

    if (!tarifa) return NextResponse.json({ error: "Tarifa no encontrada" }, { status: 404 });

    return NextResponse.json(tarifa);
  },
  { requireAuth: true, requiredRole: "OWNER", bodySchema: updateTarifaSchema }
);

/**
 * DELETE /api/canchas/[id]/tarifas/[tarifaId]
 */
export const DELETE = apiHandler(
  async (_request, ctx, _validated) => {
    const { id, tarifaId } = ctx.params;
    if (!(await canchaDelDueno(id, ctx.user!.sub))) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }

    await db.delete(tarifas).where(and(eq(tarifas.id, tarifaId), eq(tarifas.canchaId, id)));

    return NextResponse.json({ ok: true });
  },
  { requireAuth: true, requiredRole: "OWNER" }
);
