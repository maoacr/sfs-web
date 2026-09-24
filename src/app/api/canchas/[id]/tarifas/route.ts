import { NextResponse } from "next/server";
import { db, tarifas } from "@sfs/db";
import { apiHandler } from "@/lib/api-handler";
import { createTarifaSchema, type CreateTarifaInput } from "@/lib/schemas";
import { canchaDelDueno } from "@/lib/consultas";

/**
 * POST /api/canchas/[id]/tarifas
 */
export const POST = apiHandler<CreateTarifaInput>(
  async (_request, ctx, { body }) => {
    const { id } = ctx.params;
    if (!body) {
      return NextResponse.json({ error: "Datos requeridos" }, { status: 400 });
    }
    if (!(await canchaDelDueno(id, ctx.user!.sub))) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }

    const [tarifa] = await db
      .insert(tarifas)
      .values({
        canchaId: id,
        precioBase: String(body.precioBase),
        diaSemana: body.diaSemana ?? null,
        horaInicio: body.horaInicio ?? null,
        horaFin: body.horaFin ?? null,
        factor: String(body.factor),
      })
      .returning();

    return NextResponse.json(tarifa, { status: 201 });
  },
  { requireAuth: true, requiredRole: "OWNER", bodySchema: createTarifaSchema }
);
