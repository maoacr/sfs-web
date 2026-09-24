import { NextResponse } from "next/server";
import { db, reservas } from "@sfs/db";
import { and, eq } from "drizzle-orm";
import { getAuthUser, AuthError } from "@/lib/auth-api";
import { notificarReserva } from "@/lib/event-listeners";
import { cancelarReserva } from "@/lib/cancelacion";

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

    if (body.estado === "CANCELADA") {
      const resultado = await cancelarReserva({ reservaId: id, user });
      if ("error" in resultado) {
        return NextResponse.json({ error: resultado.error }, { status: resultado.status });
      }
      return NextResponse.json(resultado);
    }

    if (body.estado !== "COMPLETADA") {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }

    if (user.role !== "OWNER") {
      return NextResponse.json({ error: "Solo el dueño puede completar una reserva" }, { status: 403 });
    }

    const [updated] = await db
      .update(reservas)
      .set({ estado: "COMPLETADA" })
      .where(and(eq(reservas.id, id), eq(reservas.tenantId, user.sub)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }

    await notificarReserva(updated.id, "RESERVA_COMPLETADA");

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("PUT /api/reservas/[id] error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
