import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { apiHandler } from "@/lib/api-handler";
import {
  crearEquipoSchema,
  updateEquipoSchema,
  type CrearEquipoInput,
} from "@/lib/schemas";

/**
 * GET /api/equipos
 *
 * Lista los equipos del usuario autenticado (creados o como miembro).
 */
export const GET = apiHandler(
  async (_request, ctx, _validated) => {
    const user = ctx.user!;

    const equipos = await prisma.equipo.findMany({
      where: {
        OR: [
          { creadorId: user.sub },
          { miembros: { some: { userId: user.sub } } },
        ],
      },
      include: {
        _count: { select: { miembros: true } },
        miembros: {
          where: { userId: user.sub },
          select: { rol: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      equipos.map((e) => ({
        ...e,
        miRol: e.miembros[0]?.rol || (e.creadorId === user.sub ? "CAPITAN" : null),
        miembros: undefined,
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

    const equipo = await prisma.equipo.create({
      data: {
        nombre: body.nombre,
        fotoUrl: body.fotoUrl || null,
        descripcion: body.descripcion || null,
        creadorId: user.sub,
        miembros: {
          create: { userId: user.sub, rol: "CAPITAN" },
        },
      },
      include: {
        _count: { select: { miembros: true } },
      },
    });

    return NextResponse.json(equipo, { status: 201 });
  },
  {
    requireAuth: true,
    bodySchema: crearEquipoSchema,
  }
);
