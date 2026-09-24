import { NextResponse } from "next/server";
import { db, reservas } from "@sfs/db";
import { and, eq } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import { cambiarEstadoReservaSchema } from "@/lib/schemas";
import { notificarReserva } from "@/lib/event-listeners";
import { cancelarReserva } from "@/lib/cancelacion";

type CambiarEstadoBody = { estado: "CANCELADA" | "COMPLETADA" };

/**
 * PUT /api/reservas/[id]
 * Body: { estado: "CANCELADA" | "COMPLETADA" }
 * CANCELADA aplica la política de reembolso; COMPLETADA es solo del dueño.
 */
export const PUT = apiHandler<CambiarEstadoBody>(
  async (_request, ctx, { body }) => {
    const user = ctx.user!;
    const { id } = ctx.params;

    if (body?.estado === "CANCELADA") {
      const resultado = await cancelarReserva({ reservaId: id, user });
      if ("error" in resultado) {
        return NextResponse.json({ error: resultado.error }, { status: resultado.status });
      }
      return NextResponse.json(resultado);
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
  },
  { requireAuth: true, bodySchema: cambiarEstadoReservaSchema }
);
