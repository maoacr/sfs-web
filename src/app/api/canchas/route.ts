import { NextResponse } from "next/server";
import { db, canchas, complejos } from "@sfs/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import {
  createCanchaSchema,
  type CreateCanchaInput,
} from "@/lib/schemas";
import { tipoCanchaToDb, toApiCancha, toApiComplejo } from "@/lib/db-mappers";

/**
 * GET /api/canchas
 */
export const GET = apiHandler(
  async (request, ctx, _validated) => {
    const user = ctx.user!;
    const { searchParams } = new URL(request.url);
    const activas = searchParams.get("activas") === "true";

    const canchasList = await db.query.canchas.findMany({
      where: and(
        eq(canchas.tenantId, user.sub),
        activas ? isNull(canchas.deletedAt) : undefined
      ),
      with: {
        complejo: true,
        imagenes: {
          orderBy: (img, { asc }) => [asc(img.orden)],
        },
        slots: {
          orderBy: (s, { asc }) => [asc(s.diaSemana)],
        },
        tarifas: true,
      },
      orderBy: [desc(canchas.createdAt)],
    });

    return NextResponse.json(
      canchasList.map((c) => ({ ...toApiCancha(c), complejo: toApiComplejo(c.complejo) }))
    );
  },
  { requireAuth: true, requiredRole: "OWNER" }
);

/**
 * POST /api/canchas
 */
export const POST = apiHandler<CreateCanchaInput>(
  async (_request, ctx, { body }) => {
    if (!body) {
      return NextResponse.json({ error: "Datos requeridos" }, { status: 400 });
    }

    const {
      nombre,
      tipo,
      capacidad,
      complejoId,
      descripcion,
      servicios,
      duracionSlotMinutos,
    } = body;

    const complejo = await db.query.complejos.findFirst({
      where: and(
        eq(complejos.id, complejoId),
        eq(complejos.tenantId, ctx.user!.sub),
        isNull(complejos.deletedAt)
      ),
      columns: { id: true },
    });

    if (!complejo) {
      return NextResponse.json(
        { error: "Complejo no encontrado" },
        { status: 404 }
      );
    }

    const [cancha] = await db
      .insert(canchas)
      .values({
        tenantId: ctx.user!.sub,
        complejoId,
        nombre,
        tipo: tipoCanchaToDb(tipo),
        capacidad,
        descripcion: descripcion || null,
        servicios: servicios || [],
        duracionSlotMinutos: duracionSlotMinutos ?? 60,
      })
      .returning();

    return NextResponse.json(toApiCancha(cancha), { status: 201 });
  },
  {
    requireAuth: true,
    requiredRole: "OWNER",
    bodySchema: createCanchaSchema,
  }
);
