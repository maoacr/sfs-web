import { NextResponse } from "next/server";
import { calcularPrecio } from "@/lib/pricing";
import { apiHandler } from "@/lib/api-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";

interface PrecioQuery {
  fecha: string;
  hora: string;
  codigo?: string;
}

/**
 * GET /api/canchas/:id/precio?fecha=YYYY-MM-DD&hora=HH:MM&codigo=PROMO
 *
 * Calcula el precio de una cancha para una fecha y hora específicas.
 * Acepta código de promoción opcional.
 */
export const GET = apiHandler<never, PrecioQuery>(
  async (request, _ctx, { query }) => {
    const { searchParams } = new URL(request.url);
    const canchaId = searchParams.get("id") || request.url.split("/canchas/")[1]?.split("/")[0];
    
    // Extraer canchaId de la URL
    const urlParts = request.url.split("/");
    const idIndex = urlParts.indexOf("canchas") + 1;
    const id = urlParts[idIndex];

    if (!id) {
      return NextResponse.json(
        { error: "ID de cancha requerido" },
        { status: 400 }
      );
    }

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
    querySchema: undefined, // validación manual en el handler
    rateLimit: RATE_LIMITS.DISPONIBILIDAD,
  }
);
