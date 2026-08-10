import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { apiHandler } from "@/lib/api-handler";
import { updateEquipoSchema } from "@/lib/schemas";

/**
 * GET /api/equipos/:id
 */
export const GET = apiHandler(
  async (request, _ctx, _validated) => {
    const id = request.url.split("/equipos/")[1]?.split("?")[0];
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const equipo = await prisma.equipo.findUnique({
      where: { id },
      include: {
        miembros: {
          include: {
            user: { select: { id: true, primerNombre: true, apellidos: true, apodo: true } },
          },
        },
        _count: { select: { miembros: true } },
      },
    });

    if (!equipo) {
      return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
    }

    return NextResponse.json(equipo);
  },
  { requireAuth: true }
);

/**
 * PATCH /api/equipos/:id
 *
 * Actualiza nombre, foto o descripción. Solo el capitán/creador.
 */
export const PATCH = apiHandler(
  async (request, ctx, { body }) => {
    const user = ctx.user!;
    const id = request.url.split("/equipos/")[1]?.split("?")[0];
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const equipo = await prisma.equipo.findUnique({
      where: { id },
      include: { miembros: { where: { userId: user.sub } } },
    });

    if (!equipo) {
      return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
    }

    const miembro = equipo.miembros[0];
    if (equipo.creadorId !== user.sub && miembro?.rol !== "CAPITAN") {
      return NextResponse.json(
        { error: "Solo el capitán puede editar el equipo" },
        { status: 403 }
      );
    }

    const updated = await prisma.equipo.update({
      where: { id },
      data: body as any,
    });

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
  async (request, ctx, _validated) => {
    const user = ctx.user!;
    const id = request.url.split("/equipos/")[1]?.split("?")[0];
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const equipo = await prisma.equipo.findUnique({ where: { id } });

    if (!equipo) {
      return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
    }

    if (equipo.creadorId !== user.sub) {
      return NextResponse.json(
        { error: "Solo el creador puede eliminar el equipo" },
        { status: 403 }
      );
    }

    await prisma.equipo.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  },
  { requireAuth: true }
);
