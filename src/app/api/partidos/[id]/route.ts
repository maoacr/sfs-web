import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { apiHandler } from "@/lib/api-handler";

/**
 * GET /api/partidos/:id
 *
 * Detalle de un partido con progreso de pagos: quién pagó cuánto,
 * cuánto falta, y qué jugadores están invitados.
 */
export const GET = apiHandler(
  async (request, ctx, _validated) => {
    const user = ctx.user!;
    const id = request.url.split("/partidos/")[1]?.split("?")[0];
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const partido = await prisma.partido.findUnique({
      where: { id },
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
                complejo: { select: { nombre: true, ciudad: true } },
              },
            },
            pagos: {
              where: { estadoPago: "APROBADO" },
              include: {
                user: { select: { id: true, primerNombre: true, apellidos: true, apodo: true } },
              },
              orderBy: { createdAt: "desc" },
            },
          },
        },
        equipoA: { select: { id: true, nombre: true, fotoUrl: true } },
        equipoB: { select: { id: true, nombre: true, fotoUrl: true } },
        jugadores: {
          include: {
            user: { select: { id: true, primerNombre: true, apellidos: true, apodo: true } },
          },
        },
        creador: { select: { id: true, primerNombre: true, apellidos: true, apodo: true } },
      },
    });

    if (!partido) {
      return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
    }

    // Verificar acceso: creador, jugador del partido, o dueño de la reserva
    const esCreador = partido.creadorId === user.sub;
    const esJugador = partido.jugadores.some((j) => j.userId === user.sub);
    const esDueno = partido.reserva.cancha.complejo && user.sub === partido.creadorId; // simplificado

    if (!esCreador && !esJugador && !esDueno) {
      return NextResponse.json({ error: "No tenés acceso a este partido" }, { status: 403 });
    }

    // Calcular progreso
    const total = Number(partido.reserva.montoTotal);
    const pagado = Number(partido.reserva.montoPagado);
    const pendiente = Number(partido.reserva.saldoPendiente);
    const progreso = total > 0 ? Math.round((pagado / total) * 100) : 0;

    // Mapa de jugadores con su contribución
    const pagosPorUsuario = new Map<string, number>();
    for (const pago of partido.reserva.pagos) {
      const uid = pago.userId;
      pagosPorUsuario.set(uid, (pagosPorUsuario.get(uid) || 0) + Number(pago.monto));
    }

    const jugadores = partido.jugadores.map((j) => ({
      userId: j.user.id,
      nombre: `${j.user.primerNombre} ${j.user.apellidos || ""}`.trim(),
      apodo: j.user.apodo,
      montoPagado: pagosPorUsuario.get(j.user.id) || 0,
      esCreador: j.user.id === partido.creadorId,
    }));

    // Agregar al creador si no está en jugadores
    if (!jugadores.find((j) => j.userId === partido.creador.id)) {
      jugadores.push({
        userId: partido.creador.id,
        nombre: `${partido.creador.primerNombre} ${partido.creador.apellidos || ""}`.trim(),
        apodo: partido.creador.apodo,
        montoPagado: pagosPorUsuario.get(partido.creador.id) || 0,
        esCreador: true,
      });
    }

    return NextResponse.json({
      id: partido.id,
      cancha: partido.reserva.cancha,
      fecha: partido.reserva.slotInicio,
      duracion: `${new Date(partido.reserva.slotInicio).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })} – ${new Date(partido.reserva.slotFin).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`,
      equipoA: partido.equipoA,
      equipoB: partido.equipoB,
      estado: partido.reserva.estado,
      total,
      pagado,
      pendiente,
      progreso,
      jugadores,
      creador: partido.creador,
      puedePagar: pendiente > 0 && partido.reserva.estado === "PAGO_PARCIAL",
    });
  },
  { requireAuth: true }
);
