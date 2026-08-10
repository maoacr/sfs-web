import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { apiHandler } from "@/lib/api-handler";

/**
 * GET /api/me/saldo
 *
 * Retorna el saldo pendiente total y las reservas con pagos incompletos.
 */
export const GET = apiHandler(
  async (_request, ctx, _validated) => {
    const user = ctx.user!;

    const reservasPendientes = await prisma.reserva.findMany({
      where: {
        playerId: user.sub,
        estado: "PAGO_PARCIAL",
      },
      include: {
        cancha: {
          select: {
            nombre: true,
            tipo: true,
            complejo: { select: { nombre: true } },
          },
        },
      },
      orderBy: { slotInicio: "asc" },
    });

    const saldoTotal = reservasPendientes.reduce(
      (acc, r) => acc + Number(r.saldoPendiente),
      0
    );

    return NextResponse.json({
      saldoPendiente: saldoTotal,
      bloqueado: saldoTotal > 0,
      reservasPendientes: reservasPendientes.map((r) => ({
        id: r.id,
        cancha: r.cancha.nombre,
        complejo: r.cancha.complejo.nombre,
        tipo: r.cancha.tipo,
        fecha: r.slotInicio,
        montoTotal: Number(r.montoTotal),
        montoPagado: Number(r.montoPagado),
        saldoPendiente: Number(r.saldoPendiente),
        progreso: Math.round((Number(r.montoPagado) / Number(r.montoTotal)) * 100),
      })),
    });
  },
  { requireAuth: true }
);
