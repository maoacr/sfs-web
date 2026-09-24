import { NextResponse } from "next/server";
import { db, partidos } from "@sfs/db";
import { desc } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import { toApiCancha } from "@/lib/db-mappers";
import { partidosDelUsuario } from "@/lib/partidos";

/**
 * GET /api/me/partidos
 *
 * Retorna los partidos del usuario (creados o donde es jugador),
 * con progreso de pago grupal.
 */
export const GET = apiHandler(
  async (_request, ctx, _validated) => {
    const user = ctx.user!;

    const lista = await db.query.partidos.findMany({
      where: partidosDelUsuario(user.sub),
      with: {
        reserva: {
          columns: {
            id: true,
            slotInicio: true,
            montoTotal: true,
            montoPagado: true,
            saldoPendiente: true,
            estado: true,
          },
          with: {
            cancha: {
              columns: { nombre: true, tipo: true },
              with: { complejo: { columns: { nombre: true, zonaHoraria: true } } },
            },
          },
        },
        equipoA: { columns: { id: true, nombre: true } },
        equipoB: { columns: { id: true, nombre: true } },
        jugadores: { columns: { id: true } },
      },
      orderBy: [desc(partidos.createdAt)],
    });

    return NextResponse.json(
      lista.map((p) => {
        const total = Number(p.reserva.montoTotal);
        const pagado = Number(p.reserva.montoPagado);
        return {
          id: p.id,
          cancha: toApiCancha(p.reserva.cancha),
          fecha: p.reserva.slotInicio,
          equipoA: p.equipoA,
          equipoB: p.equipoB,
          estado: p.reserva.estado,
          total,
          pagado,
          pendiente: Number(p.reserva.saldoPendiente),
          progreso: total > 0 ? Math.round((pagado / total) * 100) : 0,
          jugadores: p.jugadores.length,
          soyCreador: p.creadorId === user.sub,
        };
      })
    );
  },
  { requireAuth: true }
);
