import { NextResponse } from "next/server";
import { db, reservas } from "@sfs/db";
import { and, asc, eq } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import { tipoCanchaToApi } from "@/lib/db-mappers";

/**
 * GET /api/me/saldo
 *
 * Retorna el saldo pendiente total y las reservas con pagos incompletos.
 */
export const GET = apiHandler(
  async (_request, ctx, _validated) => {
    const user = ctx.user!;

    const pendientes = await db.query.reservas.findMany({
      where: and(eq(reservas.playerId, user.sub), eq(reservas.estado, "PAGO_PARCIAL")),
      with: {
        cancha: {
          columns: { nombre: true, tipo: true },
          with: { complejo: { columns: { nombre: true } } },
        },
      },
      orderBy: [asc(reservas.slotInicio)],
    });

    const saldoTotal = pendientes.reduce((acc, r) => acc + Number(r.saldoPendiente), 0);

    return NextResponse.json({
      saldoPendiente: saldoTotal,
      bloqueado: saldoTotal > 0,
      reservasPendientes: pendientes.map((r) => {
        const montoTotal = Number(r.montoTotal);
        const montoPagado = Number(r.montoPagado);
        return {
          id: r.id,
          cancha: r.cancha.nombre,
          complejo: r.cancha.complejo.nombre,
          tipo: tipoCanchaToApi(r.cancha.tipo),
          fecha: r.slotInicio,
          montoTotal,
          montoPagado,
          saldoPendiente: Number(r.saldoPendiente),
          progreso: montoTotal > 0 ? Math.round((montoPagado / montoTotal) * 100) : 0,
        };
      }),
    });
  },
  { requireAuth: true }
);
