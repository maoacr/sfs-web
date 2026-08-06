import { NextResponse } from "next/server";
import { liberarReservasExpiradas } from "@/lib/ttl";

/**
 * POST /api/reservas/liberar-expiradas
 * 
 * Libera todas las reservas en estado PENDIENTE_PAGO que excedieron el TTL (15 min).
 * Puede ser llamado manualmente o por un cron job externo.
 * 
 * También se ejecuta automáticamente al consultar disponibilidad o crear una reserva.
 */
export async function POST() {
  try {
    const expiradas = await liberarReservasExpiradas();
    return NextResponse.json({
      liberadas: expiradas.length,
      ids: expiradas.map(r => r.id),
    });
  } catch (error) {
    console.error("POST /api/reservas/liberar-expiradas error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
