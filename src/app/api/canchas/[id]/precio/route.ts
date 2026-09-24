import { NextResponse } from "next/server";
import { calcularPrecio } from "@/lib/pricing";
import { apiHandler } from "@/lib/api-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { z } from "zod";

const precioQuerySchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD requerido"),
  hora: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM requerido"),
  codigo: z.string().optional(),
});

/**
 * GET /api/canchas/:id/precio?fecha=YYYY-MM-DD&hora=HH:MM&codigo=PROMO
 *
 * Calcula el precio de una cancha para una fecha y hora específicas.
 * Acepta código de promoción opcional.
 */
export const GET = apiHandler<never, { fecha: string; hora: string; codigo?: string }>(
  async (_request, ctx, { query }) => {
    const { id } = ctx.params;

    if (!query) {
      return NextResponse.json(
        { error: "Parámetros fecha y hora requeridos" },
        { status: 400 }
      );
    }

    const { fecha, hora, codigo } = query;
    const resultado = await calcularPrecio(id, fecha, hora, codigo);

    if (!resultado.success) {
      return NextResponse.json(
        { error: resultado.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      canchaId: id,
      ...resultado.data,
      pagoMinimo: Math.round(resultado.data.precioFinal * 0.5),
    });
  },
  {
    requireAuth: true,
    querySchema: precioQuerySchema,
    rateLimit: RATE_LIMITS.DISPONIBILIDAD,
  }
);
