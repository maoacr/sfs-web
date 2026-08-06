import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { getAuthUser, AuthError } from "@/lib/auth-api";

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
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
