import { NextResponse } from "next/server";
import { db, equipos } from "@sfs/db";
import { eq } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import { updateEquipoSchema } from "@/lib/schemas";
import { toApiUsuario, USUARIO_PUBLICO } from "@/lib/db-mappers";

async function puedeEditar(equipoId: string, userId: string) {
  const equipo = await db.query.equipos.findFirst({
    where: eq(equipos.id, equipoId),
    with: { miembros: { columns: { userId: true, rol: true } } },
  });
  if (!equipo) return null;
  const miembro = equipo.miembros.find((m) => m.userId === userId);
  return { equipo, esCapitan: equipo.creadorId === userId || miembro?.rol === "CAPITAN" };
}

/**
 * GET /api/equipos/:id
 */
export const GET = apiHandler(
  async (_request, ctx, _validated) => {
    const { id } = ctx.params;

    const equipo = await db.query.equipos.findFirst({
      where: eq(equipos.id, id),
      with: { miembros: { with: { user: { columns: USUARIO_PUBLICO } } } },
    });

    if (!equipo) {
      return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      ...equipo,
      miembros: equipo.miembros.map((m) => ({ ...m, user: toApiUsuario(m.user) })),
      _count: { miembros: equipo.miembros.length },
    });
  },
  { requireAuth: true }
);

/**
 * PATCH /api/equipos/:id
 *
 * Actualiza nombre, foto o descripción. Solo el capitán/creador.
 */
export const PATCH = apiHandler(
  async (_request, ctx, { body }) => {
    const { id } = ctx.params;

    const acceso = await puedeEditar(id, ctx.user!.sub);
    if (!acceso) {
      return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
    }
    if (!acceso.esCapitan) {
      return NextResponse.json({ error: "Solo el capitán puede editar el equipo" }, { status: 403 });
    }

    const [updated] = await db.update(equipos).set(body ?? {}).where(eq(equipos.id, id)).returning();

    return NextResponse.json(updated);
  },
  {
    requireAuth: true,
    bodySchema: updateEquipoSchema,
  }
);

/**
 * DELETE /api/equipos/:id
 *
 * Elimina el equipo. Solo el creador.
 */
export const DELETE = apiHandler(
  async (_request, ctx, _validated) => {
    const { id } = ctx.params;

    const equipo = await db.query.equipos.findFirst({
      where: eq(equipos.id, id),
      columns: { creadorId: true },
    });

    if (!equipo) {
      return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
    }
    if (equipo.creadorId !== ctx.user!.sub) {
      return NextResponse.json({ error: "Solo el creador puede eliminar el equipo" }, { status: 403 });
    }

    await db.delete(equipos).where(eq(equipos.id, id));

    return NextResponse.json({ ok: true });
  },
  { requireAuth: true }
);
