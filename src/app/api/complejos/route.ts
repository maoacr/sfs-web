import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { apiHandler } from "@/lib/api-handler";
import {
  createComplejoSchema,
  type CreateComplejoInput,
} from "@/lib/schemas";

/**
 * GET /api/complejos
 */
export const GET = apiHandler(
  async (_request, ctx, _validated) => {
    const complejos = await prisma.complejo.findMany({
      where: { tenantId: ctx.user!.sub, deletedAt: null },
      include: {
        canchas: {
          where: { deletedAt: null },
          include: { imagenes: { where: { principal: true }, take: 1 } },
        },
        imagenes: { orderBy: { orden: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(complejos);
  },
  { requireAuth: true, requiredRole: "OWNER" }
);

/**
 * POST /api/complejos
 */
export const POST = apiHandler<CreateComplejoInput>(
  async (_request, _ctx, { body }) => {
    if (!body) {
      return NextResponse.json({ error: "Datos requeridos" }, { status: 400 });
    }

    const complejo = await prisma.complejo.create({
      data: {
        ...body,
        email: body.email || null,
      } as any, // tenantId + owner injected by middleware
      include: { canchas: true, imagenes: true },
    });

    return NextResponse.json(complejo, { status: 201 });
  },
  {
    requireAuth: true,
    requiredRole: "OWNER",
    bodySchema: createComplejoSchema,
  }
);
