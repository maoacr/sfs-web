import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { apiHandler } from "@/lib/api-handler";
import {
  createCanchaSchema,
  type CreateCanchaInput,
} from "@/lib/schemas";

/**
 * GET /api/canchas
 */
export const GET = apiHandler(
  async (request, ctx, _validated) => {
    const user = ctx.user!;
    const { searchParams } = new URL(request.url);
    const activas = searchParams.get("activas") === "true";

    const canchas = await prisma.cancha.findMany({
      where: {
        tenantId: user.sub,
        ...(activas ? { deletedAt: null } : {}),
      },
      include: {
        complejo: true,
        imagenes: { orderBy: { orden: "asc" } },
        slots: { orderBy: { diaSemana: "asc" } },
        tarifas: true,
        _count: { select: { reservas: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(canchas);
  },
  { requireAuth: true, requiredRole: "OWNER" }
);

/**
 * POST /api/canchas
 */
export const POST = apiHandler<CreateCanchaInput>(
  async (_request, _ctx, { body }) => {
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

    const complejo = await prisma.complejo.findFirst({
      where: { id: complejoId },
    });

    if (!complejo) {
      return NextResponse.json(
        { error: "Complejo no encontrado" },
        { status: 404 }
      );
    }

    const cancha = await prisma.cancha.create({
      data: {
        complejoId,
        nombre,
        tipo,
        capacidad,
        descripcion: descripcion || null,
        servicios: servicios || [],
        duracionSlotMinutos: duracionSlotMinutos ?? 60,
      } as any, // tenantId injected by middleware
      include: {
        complejo: true,
        imagenes: true,
        slots: true,
        tarifas: true,
      },
    });

    return NextResponse.json(cancha, { status: 201 });
  },
  {
    requireAuth: true,
    requiredRole: "OWNER",
    bodySchema: createCanchaSchema,
  }
);
