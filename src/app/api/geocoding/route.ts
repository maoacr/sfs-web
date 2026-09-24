import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { geocodingQuerySchema } from "@/lib/schemas";
import { RATE_LIMITS } from "@/lib/rate-limit";

/**
 * GET /api/geocoding?q=dirección
 * Convierte una dirección en coordenadas usando Nominatim (OpenStreetMap).
 */
export const GET = apiHandler<never, { q: string }>(
  async (_request, _ctx, { query }) => {
    const q = query?.q ?? "";
    if (q.length < 3) {
      return NextResponse.json({ error: "Dirección muy corta" }, { status: 400 });
    }

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&accept-language=es`;
      const res = await fetch(url, { headers: { "User-Agent": "SFS-App/1.0 (maoacr)" } });
      if (!res.ok) throw new Error("Geocoding failed");

      const data = await res.json();
      if (!data || data.length === 0) {
        return NextResponse.json({ error: "Dirección no encontrada" }, { status: 404 });
      }

      return NextResponse.json({
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        displayName: data[0].display_name,
      });
    } catch {
      return NextResponse.json({ error: "Error al buscar dirección" }, { status: 502 });
    }
  },
  {
    requireAuth: true,
    querySchema: geocodingQuerySchema,
    // Nominatim limita el uso por aplicación; evitamos que un cliente lo sature.
    rateLimit: RATE_LIMITS.DISPONIBILIDAD,
  }
);
