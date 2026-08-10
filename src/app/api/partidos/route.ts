import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { apiHandler } from "@/lib/api-handler";
import { crearPartidoSchema, type CrearPartidoInput } from "@/lib/schemas";
import { notificarCambioReserva } from "@/lib/event-listeners";

/**
 * GET /api/partidos?fecha=YYYY-MM-DD&ciudad=Medellin
 *
 * Lista partidos públicos. Sin filtros, devuelve los del usuario autenticado.
 */
export const GET = apiHandler(
  async (request, ctx, _validated) => {
    const user = ctx.user!;
    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get("fecha");
    const ciudad = searchParams.get("ciudad");

    // Si hay filtros públicos, no requiere auth estricto
    if (fecha || ciudad) {
      const where: Record<string, unknown> = {};
      if (fecha) {
        const inicio = new Date(fecha + "T00:00:00.000Z");
        const fin = new Date(fecha + "T23:59:59.999Z");
        where.reserva = { slotInicio: { gte: inicio, lte: fin } };
      }
      if (ciudad) {
        where.reserva = {
          ...(where.reserva as any || {}),
          cancha: { complejo: { ciudad: { contains: ciudad, mode: "insensitive" } } },
        };
      }

      const partidos = await prisma.partido.findMany({
        where,
        include: {
          reserva: {
            select: { slotInicio: true, slotFin: true, montoTotal: true, montoPagado: true },
          },
          equipoA: { select: { id: true, nombre: true } },
          equipoB: { select: { id: true, nombre: true } },
          _count: { select: { jugadores: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      return NextResponse.json(partidos);
    }

    // Partidos del usuario
    const partidos = await prisma.partido.findMany({
      where: {
        OR: [
          { creadorId: user.sub },
          { jugadores: { some: { userId: user.sub } } },
        ],
      },
      include: {
        reserva: {
          select: {
            id: true,
            slotInicio: true,
            slotFin: true,
            montoTotal: true,
            montoPagado: true,
            saldoPendiente: true,
            estado: true,
            cancha: { select: { nombre: true, tipo: true, complejo: { select: { nombre: true } } } },
          },
        },
        equipoA: { select: { id: true, nombre: true } },
        equipoB: { select: { id: true, nombre: true } },
        _count: { select: { jugadores: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(partidos);
  },
  { requireAuth: true }
);

/**
 * POST /api/partidos
 *
 * Crea un partido asociado a una reserva existente.
 * Opcionalmente asigna equipos e invita jugadores.
 */
export const POST = apiHandler<CrearPartidoInput>(
  async (request, ctx, { body }) => {
    if (!body) {
      return NextResponse.json({ error: "Datos requeridos" }, { status: 400 });
    }

    const user = ctx.user!;
    const { reservaId, equipoAId, equipoBId, jugadores } = body;

    // Verificar que la reserva existe y pertenece al usuario
    const reserva = await prisma.reserva.findFirst({
      where: {
        id: reservaId,
        OR: [{ playerId: user.sub }, { tenantId: user.sub }],
      },
    });

    if (!reserva) {
      return NextResponse.json(
        { error: "Reserva no encontrada o no tenés acceso" },
        { status: 404 }
      );
    }

    // Verificar que no existe ya un partido para esta reserva
    const existente = await prisma.partido.findUnique({
      where: { reservaId },
    });

    if (existente) {
      return NextResponse.json(
        { error: "Ya existe un partido para esta reserva" },
        { status: 409 }
      );
    }

    // Crear partido con jugadores
    const partido = await prisma.partido.create({
      data: {
        reservaId,
        creadorId: user.sub,
        equipoAId: equipoAId || null,
        equipoBId: equipoBId || null,
        jugadores: {
          create: (jugadores || []).map((userId) => ({ userId })),
        },
      },
      include: {
        reserva: {
          select: {
            slotInicio: true,
            slotFin: true,
            cancha: { select: { nombre: true, complejo: { select: { nombre: true } } } },
          },
        },
        jugadores: {
          include: {
            user: { select: { id: true, primerNombre: true, apellidos: true, apodo: true } },
          },
        },
      },
    });

    return NextResponse.json(partido, { status: 201 });
  },
  {
    requireAuth: true,
    bodySchema: crearPartidoSchema,
  }
);
