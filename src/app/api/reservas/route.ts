import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { getAuthUser, AuthError } from "@/lib/auth-api";
import { notificarCambioReserva } from "@/lib/event-listeners";
import { liberarReservasExpiradas } from "@/lib/ttl";

/**
 * POST /api/reservas
 * Crea una reserva. Puede ser creada por un PLAYER o por un OWNER (manual).
 * 
 * Body:
 *   - canchaId: string
 *   - slotInicio: ISO datetime
 *   - slotFin: ISO datetime
 *   - playerId?: string (solo si OWNER crea para un cliente)
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);

    // Limpiar reservas expiradas
    liberarReservasExpiradas().catch(() => {});

    const body = await request.json();

    const { canchaId, slotInicio, slotFin, playerId, playerNombre } = body;

    if (!canchaId || !slotInicio || !slotFin) {
      return NextResponse.json(
        { error: "canchaId, slotInicio y slotFin son requeridos" },
        { status: 400 }
      );
    }

    // Obtener la cancha y verificar que existe
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

    // Determinar el player
    let finalPlayerId = user.sub;
    let finalTenantId = cancha.tenantId;

    if (user.role === "OWNER") {
      // Owner crea reserva manual — puede especificar playerId
      finalPlayerId = playerId || user.sub;
      finalTenantId = user.sub;
    }

    // Calcular precio
    const tarifa = await prisma.tarifa.findFirst({
      where: { canchaId, diaSemana: null },
    });
    const montoTotal = tarifa ? Number(tarifa.precioBase) * Number(tarifa.factor) : 0;

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
        player: { select: { id: true, primerNombre: true, apellidos: true, email: true } },
        tenant: { select: { id: true, email: true } },
      },
    });

    // Notificar a ambos
    const eventTipo = user.role === "OWNER" ? "RESERVA_CONFIRMADA" : "RESERVA_CREADA";
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
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("POST /api/reservas error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * GET /api/reservas
 * Lista reservas del usuario autenticado.
 * OWNER: ve todas las reservas de sus canchas.
 * PLAYER: ve sus propias reservas.
 * 
 * Query params:
 *   - fecha: YYYY-MM-DD — filtra por día
 *   - estado: PENDIENTE_PAGO|CONFIRMADA|COMPLETADA|CANCELADA
 */
export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get("fecha");
    const estado = searchParams.get("estado");

    const where: any = {};

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
        cancha: { select: { nombre: true, tipo: true, complejo: { select: { nombre: true } } } },
        player: { select: { primerNombre: true, apellidos: true, apodo: true, telefono: true } },
      },
      orderBy: { slotInicio: "asc" },
    });

    return NextResponse.json(reservas);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("GET /api/reservas error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
