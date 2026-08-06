import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { getAuthUser, AuthError } from "@/lib/auth-api";
import { emitReservaEvent } from "@/lib/events";
import { initNotificaciones } from "@/lib/event-listeners";

initNotificaciones();

/**
 * PUT /api/reservas/[id]
 * Cambia el estado de una reserva.
 * Body: { estado: "CANCELADA" | "COMPLETADA" }
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;
    const body = await request.json();

    const reserva = await prisma.reserva.findFirst({
      where: { id, ...(user.role === "OWNER" ? { tenantId: user.sub } : { playerId: user.sub }) },
    });

    if (!reserva) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }

    const validStates = ["CANCELADA", "COMPLETADA"];
    if (!validStates.includes(body.estado)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }

    const updated = await prisma.reserva.update({
      where: { id },
      data: { estado: body.estado },
      include: {
        cancha: { include: { complejo: true } },
        player: { select: { id: true, primerNombre: true, apellidos: true, email: true } },
        tenant: { select: { id: true, email: true } },
      },
    });

    // Emitir evento según el nuevo estado
    const eventTipo = body.estado === "COMPLETADA" ? "RESERVA_COMPLETADA" : "RESERVA_CANCELADA";
    emitReservaEvent({
      tipo: eventTipo,
      reservaId: updated.id,
      canchaNombre: updated.cancha.nombre,
      complejoNombre: updated.cancha.complejo.nombre,
      slotInicio: updated.slotInicio,
      slotFin: updated.slotFin,
      playerId: updated.playerId,
      playerNombre: `${updated.player.primerNombre} ${updated.player.apellidos || ""}`.trim(),
      playerEmail: updated.player.email,
      tenantId: updated.tenantId,
      tenantEmail: updated.tenant.email,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
