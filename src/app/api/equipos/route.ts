import { NextResponse } from "next/server";
import { db, equipos, equipoMiembros } from "@sfs/db";
import { desc, eq, inArray, or } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import { crearEquipoSchema, type CrearEquipoInput } from "@/lib/schemas";

/**
 * GET /api/equipos
 *
 * Lista los equipos del usuario autenticado (creados o como miembro).
 */
export const GET = apiHandler(
  async (_request, ctx, _validated) => {
    const user = ctx.user!;

    const lista = await db.query.equipos.findMany({
      where: or(
        eq(equipos.creadorId, user.sub),
        inArray(
          equipos.id,
          db
            .select({ id: equipoMiembros.equipoId })
            .from(equipoMiembros)
            .where(eq(equipoMiembros.userId, user.sub))
        )
      ),
      with: { miembros: { columns: { userId: true, rol: true } } },
      orderBy: [desc(equipos.createdAt)],
    });

    return NextResponse.json(
      lista.map(({ miembros, ...e }) => ({
        ...e,
        _count: { miembros: miembros.length },
        miRol:
          miembros.find((m) => m.userId === user.sub)?.rol ||
          (e.creadorId === user.sub ? "CAPITAN" : null),
      }))
    );
  },
  { requireAuth: true }
);

/**
 * POST /api/equipos
 *
 * Crea un nuevo equipo. El creador se agrega automáticamente como CAPITAN.
 */
export const POST = apiHandler<CrearEquipoInput>(
  async (_request, ctx, { body }) => {
    if (!body) {
      return NextResponse.json({ error: "Datos requeridos" }, { status: 400 });
    }

    const user = ctx.user!;

    const equipo = await db.transaction(async (tx) => {
      const [creado] = await tx
        .insert(equipos)
        .values({
          nombre: body.nombre,
          fotoUrl: body.fotoUrl || null,
          descripcion: body.descripcion || null,
          creadorId: user.sub,
        })
        .returning();
      await tx.insert(equipoMiembros).values({ equipoId: creado.id, userId: user.sub, rol: "CAPITAN" });
      return creado;
    });

    return NextResponse.json({ ...equipo, _count: { miembros: 1 } }, { status: 201 });
  },
  {
    requireAuth: true,
    bodySchema: crearEquipoSchema,
  }
);
