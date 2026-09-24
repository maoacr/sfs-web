import { NextResponse } from "next/server";
import { db, complejos, canchas } from "@sfs/db";
import { eq, and, isNull } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import { updateComplejoSchema, type UpdateComplejoInput } from "@/lib/schemas";
import { formatAddress } from "@/lib/address";
import { toApiCancha, toApiComplejo } from "@/lib/db-mappers";
import { complejoDelDueno } from "@/lib/consultas";

/**
 * GET /api/complejos/[id]
 */
export const GET = apiHandler(
  async (_request, ctx, _validated) => {
    const complejo = await db.query.complejos.findFirst({
      where: and(
        eq(complejos.id, ctx.params.id),
        eq(complejos.tenantId, ctx.user!.sub),
        isNull(complejos.deletedAt)
      ),
      with: {
        imagenes: { orderBy: (img, { asc }) => [asc(img.orden)] },
        canchas: { where: isNull(canchas.deletedAt) },
      },
    });

    if (!complejo) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ...toApiComplejo(complejo), canchas: complejo.canchas.map(toApiCancha) });
  },
  { requireAuth: true, requiredRole: "OWNER" }
);

/**
 * PUT /api/complejos/[id]
 */
export const PUT = apiHandler<UpdateComplejoInput>(
  async (_request, ctx, { body }) => {
    const { id } = ctx.params;
    const existente = await complejoDelDueno(id, ctx.user!.sub);
    if (!existente) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const b = body ?? {};
    const updateData: Partial<typeof complejos.$inferInsert> = {};

    if (b.nombre !== undefined) updateData.nombre = b.nombre;
    if (b.tipoVia !== undefined) updateData.tipoVia = b.tipoVia;
    if (b.numeroVia !== undefined) updateData.numeroVia = b.numeroVia;
    if (b.numeroSec !== undefined) updateData.numeroSec = b.numeroSec;
    if (b.complemento !== undefined) updateData.complemento = b.complemento;
    if (b.ciudad !== undefined) updateData.ciudad = b.ciudad ?? "";
    if (b.departamento !== undefined) updateData.departamento = b.departamento ?? "";
    if (b.tipoVia !== undefined || b.numeroVia !== undefined) {
      updateData.direccion = formatAddress({ ...existente, ...updateData });
    }
    if (b.descripcion !== undefined) updateData.descripcion = b.descripcion;
    if (b.telefono !== undefined) updateData.telefono = b.telefono;
    if (b.email !== undefined) updateData.email = b.email || null;
    if (b.instagram !== undefined) updateData.instagram = b.instagram;
    if (b.tiktok !== undefined) updateData.tiktok = b.tiktok;
    if (b.twitter !== undefined) updateData.twitter = b.twitter;
    if (b.facebook !== undefined) updateData.facebook = b.facebook;
    if (b.zonaHoraria !== undefined) updateData.zonaHoraria = b.zonaHoraria;
    if (b.lat !== undefined) updateData.latitud = b.lat === null ? null : String(b.lat);
    if (b.lng !== undefined) updateData.longitud = b.lng === null ? null : String(b.lng);

    const [updated] = await db.update(complejos).set(updateData).where(eq(complejos.id, id)).returning();

    return NextResponse.json(toApiComplejo(updated));
  },
  { requireAuth: true, requiredRole: "OWNER", bodySchema: updateComplejoSchema }
);

/**
 * DELETE /api/complejos/[id]
 */
export const DELETE = apiHandler(
  async (_request, ctx, _validated) => {
    const { id } = ctx.params;
    if (!(await complejoDelDueno(id, ctx.user!.sub))) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    await db.update(complejos).set({ deletedAt: new Date() }).where(eq(complejos.id, id));

    return NextResponse.json({ ok: true });
  },
  { requireAuth: true, requiredRole: "OWNER" }
);
