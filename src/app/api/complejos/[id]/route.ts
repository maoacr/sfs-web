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

    const datos = body ?? {};
    const updateData: Partial<typeof complejos.$inferInsert> = {};

    if (datos.nombre !== undefined) updateData.nombre = datos.nombre;
    if (datos.tipoVia !== undefined) updateData.tipoVia = datos.tipoVia;
    if (datos.numeroVia !== undefined) updateData.numeroVia = datos.numeroVia;
    if (datos.numeroSec !== undefined) updateData.numeroSec = datos.numeroSec;
    if (datos.complemento !== undefined) updateData.complemento = datos.complemento;
    if (datos.ciudad !== undefined) updateData.ciudad = datos.ciudad ?? "";
    if (datos.departamento !== undefined) updateData.departamento = datos.departamento ?? "";
    if (datos.tipoVia !== undefined || datos.numeroVia !== undefined) {
      updateData.direccion = formatAddress({ ...existente, ...updateData });
    }
    if (datos.descripcion !== undefined) updateData.descripcion = datos.descripcion;
    if (datos.telefono !== undefined) updateData.telefono = datos.telefono;
    if (datos.email !== undefined) updateData.email = datos.email || null;
    if (datos.instagram !== undefined) updateData.instagram = datos.instagram;
    if (datos.tiktok !== undefined) updateData.tiktok = datos.tiktok;
    if (datos.twitter !== undefined) updateData.twitter = datos.twitter;
    if (datos.facebook !== undefined) updateData.facebook = datos.facebook;
    if (datos.zonaHoraria !== undefined) updateData.zonaHoraria = datos.zonaHoraria;
    if (datos.lat !== undefined) updateData.latitud = datos.lat === null ? null : String(datos.lat);
    if (datos.lng !== undefined) updateData.longitud = datos.lng === null ? null : String(datos.lng);

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
