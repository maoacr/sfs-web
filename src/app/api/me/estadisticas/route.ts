import { NextResponse } from "next/server";
import { db, canchas, reservas, partidos } from "@sfs/db";
import { and, count, countDistinct, eq, inArray, isNull, ne } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import { ESTADOS_EFECTIVOS } from "@/lib/consultas";
import { partidosDelUsuario } from "@/lib/partidos";

/**
 * GET /api/me/estadisticas
 *
 * Dueño: canchas activas y clientes (jugadores distintos con reservas efectivas).
 * Jugador: reservas efectivas y partidos (creados o donde juega).
 */
export const GET = apiHandler(
  async (_request, ctx, _validated) => {
    const user = ctx.user!;

    if (user.role === "OWNER") {
      const [[{ totalCanchas }], [{ clientes }]] = await Promise.all([
        db
          .select({ totalCanchas: count() })
          .from(canchas)
          .where(and(eq(canchas.tenantId, user.sub), isNull(canchas.deletedAt))),
        db
          .select({ clientes: countDistinct(reservas.playerId) })
          .from(reservas)
          .where(
            and(
              eq(reservas.tenantId, user.sub),
              // Las reservas manuales del dueño quedan a su propio nombre.
              ne(reservas.playerId, user.sub),
              inArray(reservas.estado, ESTADOS_EFECTIVOS)
            )
          ),
      ]);
      return NextResponse.json({ canchas: totalCanchas, clientes });
    }

    const [[{ totalReservas }], [{ totalPartidos }]] = await Promise.all([
      db
        .select({ totalReservas: count() })
        .from(reservas)
        .where(and(eq(reservas.playerId, user.sub), inArray(reservas.estado, ESTADOS_EFECTIVOS))),
      db.select({ totalPartidos: count() }).from(partidos).where(partidosDelUsuario(user.sub)),
    ]);
    return NextResponse.json({ reservas: totalReservas, partidos: totalPartidos });
  },
  { requireAuth: true }
);
