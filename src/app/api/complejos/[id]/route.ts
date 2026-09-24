import { NextResponse } from "next/server";
import { db, complejos, canchas } from "@sfs/db";
import { eq, and, isNull } from "drizzle-orm";
import { getAuthUser, AuthError } from "@/lib/auth-api";
import { formatAddress } from "@/lib/address";
import { toApiCancha, toApiComplejo } from "@/lib/db-mappers";

/**
 * GET /api/complejos/[id]
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    const complejo = await db.query.complejos.findFirst({
      where: and(eq(complejos.id, id), eq(complejos.tenantId, user.sub), isNull(complejos.deletedAt)),
      with: {
        imagenes: {
          orderBy: (img, { asc }) => [asc(img.orden)],
        },
        canchas: {
          where: isNull(canchas.deletedAt),
        },
      },
    });

    if (!complejo) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      ...toApiComplejo(complejo),
      canchas: complejo.canchas.map(toApiCancha),
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("GET /api/complejos/[id] error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * PUT /api/complejos/[id]
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    const existente = await db.query.complejos.findFirst({
      where: and(eq(complejos.id, id), eq(complejos.tenantId, user.sub)),
    });

    if (!existente) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Partial<typeof complejos.$inferInsert> = {};

    if (body.nombre !== undefined) updateData.nombre = body.nombre;
    if (body.tipoVia !== undefined) updateData.tipoVia = body.tipoVia;
    if (body.numeroVia !== undefined) updateData.numeroVia = body.numeroVia;
    if (body.numeroSec !== undefined) updateData.numeroSec = body.numeroSec;
    if (body.complemento !== undefined) updateData.complemento = body.complemento;
    if (body.ciudad !== undefined) updateData.ciudad = body.ciudad ?? "";
    if (body.departamento !== undefined) updateData.departamento = body.departamento ?? "";
    if (body.tipoVia !== undefined || body.numeroVia !== undefined) {
      updateData.direccion = formatAddress({ ...existente, ...updateData });
    }
    if (body.descripcion !== undefined) updateData.descripcion = body.descripcion;
    if (body.telefono !== undefined) updateData.telefono = body.telefono;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.instagram !== undefined) updateData.instagram = body.instagram;
    if (body.tiktok !== undefined) updateData.tiktok = body.tiktok;
    if (body.twitter !== undefined) updateData.twitter = body.twitter;
    if (body.facebook !== undefined) updateData.facebook = body.facebook;
    if (body.lat !== undefined) updateData.latitud = body.lat !== null ? String(body.lat) : null;
    if (body.lng !== undefined) updateData.longitud = body.lng !== null ? String(body.lng) : null;

    const [updated] = await db
      .update(complejos)
      .set(updateData)
      .where(eq(complejos.id, id))
      .returning();

    return NextResponse.json(toApiComplejo(updated));
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("PUT /api/complejos/[id] error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * DELETE /api/complejos/[id]
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    const existente = await db.query.complejos.findFirst({
      where: and(eq(complejos.id, id), eq(complejos.tenantId, user.sub)),
    });

    if (!existente) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    await db
      .update(complejos)
      .set({ deletedAt: new Date() })
      .where(eq(complejos.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("DELETE /api/complejos/[id] error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
