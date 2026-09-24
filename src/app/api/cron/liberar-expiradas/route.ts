import { NextResponse } from "next/server";
import { liberarReservasExpiradas } from "@/lib/ttl";

/**
 * GET /api/cron/liberar-expiradas
 *
 * Endpoint para Vercel Cron Job. Se ejecuta cada 5 minutos.
 * Requiere autorización vía CRON_SECRET.
 */
export async function GET(request: Request) {
  // ─── Verificar autorización ──────────────────────────────────────────

  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("Authorization");

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // ─── Ejecutar limpieza ───────────────────────────────────────────────

  try {
    const expiradas = await liberarReservasExpiradas();

    return NextResponse.json({
      ok: true,
      liberadas: expiradas.length,
      ids: expiradas.map((r) => r.id),
    });
  } catch (error) {
    console.error("[Cron] Error liberando expiradas:", error);
    return NextResponse.json(
      { error: "Error interno" },
      { status: 500 }
    );
  }
}
