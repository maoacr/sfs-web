import { NextResponse } from "next/server";
import { db, complejos, canchas } from "@sfs/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import {
  createComplejoSchema,
  type CreateComplejoInput,
} from "@/lib/schemas";
import { formatAddress } from "@/lib/address";
import { toApiCancha, toApiComplejo } from "@/lib/db-mappers";

/**
 * GET /api/complejos
 */
export const GET = apiHandler(
  async (_request, ctx, _validated) => {
    const list = await db.query.complejos.findMany({
      where: and(eq(complejos.tenantId, ctx.user!.sub), isNull(complejos.deletedAt)),
      with: {
        canchas: {
          where: isNull(canchas.deletedAt),
          with: {
            imagenes: {
              where: (img, { eq }) => eq(img.principal, true),
              limit: 1,
            },
          },
        },
        imagenes: {
          orderBy: (img, { asc }) => [asc(img.orden)],
        },
      },
      orderBy: [desc(complejos.createdAt)],
    });

    return NextResponse.json(
      list.map((c) => ({ ...toApiComplejo(c), canchas: c.canchas.map(toApiCancha) }))
    );
  },
  { requireAuth: true, requiredRole: "OWNER" }
);

/**
 * POST /api/complejos
 */
export const POST = apiHandler<CreateComplejoInput>(
  async (_request, ctx, { body }) => {
    if (!body) {
      return NextResponse.json({ error: "Datos requeridos" }, { status: 400 });
    }

    const direccionCompleta = formatAddress(body);

    const [created] = await db
      .insert(complejos)
      .values({
        tenantId: ctx.user!.sub,
        nombre: body.nombre,
        slug: body.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        direccion: direccionCompleta,
        tipoVia: body.tipoVia,
        numeroVia: body.numeroVia,
        numeroSec: body.numeroSec || null,
        complemento: body.complemento || null,
        ciudad: body.ciudad || "Bogotá",
        departamento: body.departamento || "Cundinamarca",
        descripcion: body.descripcion || null,
        telefono: body.telefono || null,
        email: body.email || null,
        instagram: body.instagram || null,
        tiktok: body.tiktok || null,
        twitter: body.twitter || null,
        facebook: body.facebook || null,
        zonaHoraria: body.zonaHoraria,
        latitud: body.lat !== undefined ? String(body.lat) : null,
        longitud: body.lng !== undefined ? String(body.lng) : null,
      })
      .returning();

    return NextResponse.json(toApiComplejo(created), { status: 201 });
  },
  {
    requireAuth: true,
    requiredRole: "OWNER",
    bodySchema: createComplejoSchema,
  }
);
