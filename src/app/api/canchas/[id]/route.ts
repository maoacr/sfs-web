import { NextResponse } from "next/server";
import { db, canchas } from "@sfs/db";
import { eq, and } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import { updateCanchaSchema, type UpdateCanchaInput } from "@/lib/schemas";
import { tipoCanchaToDb, toApiCancha, toApiComplejo } from "@/lib/db-mappers";
import { canchaDelDueno } from "@/lib/consultas";

/**
 * GET /api/canchas/[id]
 * Obtiene una cancha específica (solo del dueño).
 */
export const GET = apiHandler(
  async (_request, ctx, _validated) => {
    const cancha = await db.query.canchas.findFirst({
      where: and(eq(canchas.id, ctx.params.id), eq(canchas.tenantId, ctx.user!.sub)),
      with: {
        complejo: true,
        imagenes: { orderBy: (img, { asc }) => [asc(img.orden)] },
        slots: { orderBy: (s, { asc }) => [asc(s.diaSemana)] },
        tarifas: { with: { promociones: true } },
      },
    });

    if (!cancha) {
      return NextResponse.json({ error: "Cancha no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ ...toApiCancha(cancha), complejo: toApiComplejo(cancha.complejo) });
  },
  { requireAuth: true, requiredRole: "OWNER" }
);

/**
 * PUT /api/canchas/[id]
 * Actualiza una cancha existente.
 */
export const PUT = apiHandler<UpdateCanchaInput>(
  async (_request, ctx, { body }) => {
    const { id } = ctx.params;
    if (!(await canchaDelDueno(id, ctx.user!.sub))) {
      return NextResponse.json({ error: "Cancha no encontrada" }, { status: 404 });
    }

    const { tipo, ...resto } = body ?? {};
    const [cancha] = await db
      .update(canchas)
      .set({ ...resto, ...(tipo ? { tipo: tipoCanchaToDb(tipo) } : {}) })
      .where(eq(canchas.id, id))
      .returning();

    return NextResponse.json(toApiCancha(cancha));
  },
  { requireAuth: true, requiredRole: "OWNER", bodySchema: updateCanchaSchema }
);

/**
 * DELETE /api/canchas/[id]
 * Soft delete de una cancha.
 */
export const DELETE = apiHandler(
  async (_request, ctx, _validated) => {
    const { id } = ctx.params;
    if (!(await canchaDelDueno(id, ctx.user!.sub))) {
      return NextResponse.json({ error: "Cancha no encontrada" }, { status: 404 });
    }

    await db.update(canchas).set({ deletedAt: new Date() }).where(eq(canchas.id, id));

    return NextResponse.json({ ok: true });
  },
  { requireAuth: true, requiredRole: "OWNER" }
);
