import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { apiHandler } from "@/lib/api-handler";
import { createReservaSchema, type CreateReservaInput } from "@/lib/schemas";
import { notificarCambioReserva } from "@/lib/event-listeners";
import { liberarReservasExpiradas } from "@/lib/ttl";
import { RATE_LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/reservas
 */
export const POST = apiHandler<CreateReservaInput>(
  async (_request, ctx, { body }) => {
    if (!body) {
      return NextResponse.json({ error: "Datos requeridos" }, { status: 400 });
    }

    const user = ctx.user!;
    const { canchaId, slotInicio, slotFin, playerId } = body;

    // Limpiar reservas expiradas (fire-and-forget)
    liberarReservasExpiradas().catch(() => {});

    const cancha = await prisma.cancha.findFirst({
      where: { id: canchaId, deletedAt: null },
      include: { complejo: true },
    });

    if (!cancha) {
      return NextResponse.json({ error: "Cancha no encontrada" }, { status: 404 });
    }

    // Verificar solapamiento
    const conflicto = await prisma.reserva.findFirst({
      where: {
        canchaId,
        estado: { in: ["PENDIENTE_PAGO", "CONFIRMADA"] },
        slotInicio: { lt: new Date(slotFin) },
        slotFin: { gt: new Date(slotInicio) },
      },
    });

    if (conflicto) {
      return NextResponse.json(
        { error: "El slot ya está reservado" },
        { status: 409 }
      );
    }

    let finalPlayerId = user.sub;
    let finalTenantId = cancha.tenantId;

    if (user.role === "OWNER") {
      finalPlayerId = playerId || user.sub;
      finalTenantId = user.sub;
    }

    // Calcular precio
    const tarifa = await prisma.tarifa.findFirst({
      where: { canchaId, diaSemana: null },
    });
    const montoTotal = tarifa
      ? Number(tarifa.precioBase) * Number(tarifa.factor)
      : 0;

    const reserva = await prisma.reserva.create({
      data: {
        tenantId: finalTenantId,
        canchaId,
        playerId: finalPlayerId,
        slotInicio: new Date(slotInicio),
        slotFin: new Date(slotFin),
        montoTotal,
        estado: user.role === "OWNER" ? "CONFIRMADA" : "PENDIENTE_PAGO",
      },
      include: {
        cancha: { include: { complejo: true } },
        player: {
          select: { id: true, primerNombre: true, apellidos: true, email: true },
        },
        tenant: { select: { id: true, email: true } },
      },
    });

    const eventTipo =
      user.role === "OWNER" ? "RESERVA_CONFIRMADA" : "RESERVA_CREADA";
    notificarCambioReserva({
      tipo: eventTipo as any,
      reservaId: reserva.id,
      canchaNombre: reserva.cancha.nombre,
      complejoNombre: reserva.cancha.complejo.nombre,
      slotInicio: reserva.slotInicio,
      slotFin: reserva.slotFin,
      playerId: reserva.playerId,
      playerNombre: `${reserva.player.primerNombre} ${reserva.player.apellidos || ""}`.trim(),
      playerEmail: reserva.player.email,
      tenantId: reserva.tenantId,
      tenantEmail: reserva.tenant.email,
    });

    return NextResponse.json(reserva, { status: 201 });
  },
  {
    requireAuth: true,
    bodySchema: createReservaSchema,
    rateLimit: RATE_LIMITS.STRICT,
  }
);

/**
 * GET /api/reservas
 */
export const GET = apiHandler(
  async (request, ctx, _validated) => {
    const user = ctx.user!;
    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get("fecha");
    const estado = searchParams.get("estado");

    const where: Record<string, unknown> = {};

    if (user.role === "OWNER") {
      where.tenantId = user.sub;
    } else {
      where.playerId = user.sub;
    }

    if (fecha) {
      const inicio = new Date(fecha + "T00:00:00.000Z");
      const fin = new Date(fecha + "T23:59:59.999Z");
      where.slotInicio = { gte: inicio, lte: fin };
    }

    if (estado) {
      where.estado = estado;
    }

    const reservas = await prisma.reserva.findMany({
      where,
      include: {
        cancha: {
          select: {
            nombre: true,
            tipo: true,
            complejo: { select: { nombre: true } },
          },
        },
        player: {
          select: {
            primerNombre: true,
            apellidos: true,
            apodo: true,
            telefono: true,
          },
        },
      },
      orderBy: { slotInicio: "asc" },
    });

    return NextResponse.json(reservas);
  },
  { requireAuth: true }
);
