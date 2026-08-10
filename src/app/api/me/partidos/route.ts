import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { apiHandler } from "@/lib/api-handler";

/**
 * GET /api/me/partidos
 *
 * Retorna los partidos del usuario (creados o donde es jugador),
 * con progreso de pago grupal.
 */
export const GET = apiHandler(
  async (_request, ctx, _validated) => {
    const user = ctx.user!;

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
            cancha: {
              select: {
                nombre: true,
                tipo: true,
                complejo: { select: { nombre: true } },
              },
            },
          },
        },
        equipoA: { select: { id: true, nombre: true } },
        equipoB: { select: { id: true, nombre: true } },
        _count: { select: { jugadores: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      partidos.map((p) => ({
        id: p.id,
        cancha: p.reserva.cancha,
        fecha: p.reserva.slotInicio,
        equipoA: p.equipoA,
        equipoB: p.equipoB,
        estado: p.reserva.estado,
        total: Number(p.reserva.montoTotal),
        pagado: Number(p.reserva.montoPagado),
        pendiente: Number(p.reserva.saldoPendiente),
        progreso: Math.round((Number(p.reserva.montoPagado) / Number(p.reserva.montoTotal)) * 100),
        jugadores: p._count.jugadores,
        soyCreador: p.creadorId === user.sub,
      }))
    );
  },
  { requireAuth: true }
);
