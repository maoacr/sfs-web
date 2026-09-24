import { NextResponse } from "next/server";
import { db, partidos, pagos } from "@sfs/db";
import { desc, eq } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import { nombreCompleto, toApiCancha, toApiUsuario, USUARIO_PUBLICO } from "@/lib/db-mappers";
import { formatearHora } from "@/lib/zona-horaria";

/**
 * GET /api/partidos/:id
 *
 * Detalle de un partido con progreso de pagos: quién pagó cuánto,
 * cuánto falta, y qué jugadores están invitados.
 */
export const GET = apiHandler(
  async (request, ctx, _validated) => {
    const user = ctx.user!;
    const { id } = ctx.params;

    const partido = await db.query.partidos.findFirst({
      where: eq(partidos.id, id),
      with: {
        reserva: {
          columns: {
            id: true,
            tenantId: true,
            slotInicio: true,
            slotFin: true,
            montoTotal: true,
            montoPagado: true,
            saldoPendiente: true,
            estado: true,
          },
          with: {
            cancha: {
              columns: { nombre: true, tipo: true },
              with: { complejo: { columns: { nombre: true, ciudad: true, zonaHoraria: true } } },
            },
            pagos: {
              where: eq(pagos.estadoPago, "APROBADO"),
              columns: { userId: true, monto: true },
              orderBy: [desc(pagos.createdAt)],
            },
          },
        },
        equipoA: { columns: { id: true, nombre: true, fotoUrl: true } },
        equipoB: { columns: { id: true, nombre: true, fotoUrl: true } },
        jugadores: { with: { user: { columns: USUARIO_PUBLICO } } },
        creador: { columns: USUARIO_PUBLICO },
      },
    });

    if (!partido) {
      return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
    }

    const { reserva } = partido;
    const esCreador = partido.creadorId === user.sub;
    const esJugador = partido.jugadores.some((j) => j.userId === user.sub);
    const esDueno = reserva.tenantId === user.sub;

    if (!esCreador && !esJugador && !esDueno) {
      return NextResponse.json({ error: "No tenés acceso a este partido" }, { status: 403 });
    }

    const total = Number(reserva.montoTotal);
    const pagado = Number(reserva.montoPagado);
    const pendiente = Number(reserva.saldoPendiente);
    const progreso = total > 0 ? Math.round((pagado / total) * 100) : 0;

    const pagosPorUsuario = new Map<string, number>();
    for (const pago of reserva.pagos) {
      pagosPorUsuario.set(pago.userId, (pagosPorUsuario.get(pago.userId) || 0) + Number(pago.monto));
    }

    const jugadores = partido.jugadores.map((j) => ({
      userId: j.user.id,
      nombre: nombreCompleto(j.user),
      apodo: j.user.apodo,
      montoPagado: pagosPorUsuario.get(j.user.id) || 0,
      esCreador: j.user.id === partido.creadorId,
    }));

    if (!jugadores.find((j) => j.userId === partido.creador.id)) {
      jugadores.push({
        userId: partido.creador.id,
        nombre: nombreCompleto(partido.creador),
        apodo: partido.creador.apodo,
        montoPagado: pagosPorUsuario.get(partido.creador.id) || 0,
        esCreador: true,
      });
    }

    const { zonaHoraria } = reserva.cancha.complejo;

    return NextResponse.json({
      id: partido.id,
      reservaId: reserva.id,
      cancha: toApiCancha(reserva.cancha),
      fecha: reserva.slotInicio,
      zonaHoraria,
      duracion: `${formatearHora(reserva.slotInicio, zonaHoraria)} – ${formatearHora(reserva.slotFin, zonaHoraria)}`,
      equipoA: partido.equipoA,
      equipoB: partido.equipoB,
      estado: reserva.estado,
      total,
      pagado,
      pendiente,
      progreso,
      jugadores,
      creador: toApiUsuario(partido.creador),
      puedePagar: pendiente > 0 && reserva.estado === "PAGO_PARCIAL",
    });
  },
  { requireAuth: true }
);
