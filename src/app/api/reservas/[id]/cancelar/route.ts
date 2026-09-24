import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { cancelarReservaSchema } from "@/lib/schemas";
import { cancelarReserva } from "@/lib/cancelacion";

type CancelarBody = { motivo?: string };

/**
 * PATCH /api/reservas/:id/cancelar
 *
 * Cancela una reserva aplicando la política de cancelación del complejo.
 */
export const PATCH = apiHandler<CancelarBody>(
  async (request, ctx, { body }) => {
    const { id } = ctx.params;

    const resultado = await cancelarReserva({ reservaId: id, user: ctx.user!, motivo: body?.motivo });
    if ("error" in resultado) {
      return NextResponse.json({ error: resultado.error }, { status: resultado.status });
    }
    return NextResponse.json(resultado);
  },
  {
    requireAuth: true,
    bodySchema: cancelarReservaSchema,
  }
);
