import { NextResponse } from "next/server";
import { db, canchas, reservas } from "@sfs/db";
import { and, eq, gt, inArray, lt } from "drizzle-orm";
import { getAuthUser, AuthError } from "@/lib/auth-api";

/**
 * POST /api/sync
 *
 * Recibe operaciones pendientes del Sync Engine (offline → online).
 * Body: { type: "CREATE", entity: "reserva", data }
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);

    if (user.role !== "OWNER") {
      return NextResponse.json({ error: "Solo dueños pueden sincronizar reservas" }, { status: 403 });
    }

    const { type, entity, data } = await request.json();

    if (entity !== "reserva") {
      return NextResponse.json({ error: "Entidad no soportada para sync" }, { status: 400 });
    }
    if (type !== "CREATE") {
      return NextResponse.json({ error: "Tipo de operación no soportado" }, { status: 400 });
    }

    const { canchaId, slotInicio, slotFin, montoTotal } = data as {
      canchaId: string;
      slotInicio: string;
      slotFin: string;
      montoTotal: number;
    };
    const inicio = new Date(slotInicio);
    const fin = new Date(slotFin);

    const cancha = await db.query.canchas.findFirst({
      where: and(eq(canchas.id, canchaId), eq(canchas.tenantId, user.sub)),
      columns: { id: true },
    });
    if (!cancha) {
      return NextResponse.json({ error: "Cancha no encontrada" }, { status: 404 });
    }

    const conflicto = await db.query.reservas.findFirst({
      where: and(
        eq(reservas.canchaId, canchaId),
        inArray(reservas.estado, ["PENDIENTE_PAGO", "PAGO_PARCIAL", "CONFIRMADA"]),
        lt(reservas.slotInicio, fin),
        gt(reservas.slotFin, inicio)
      ),
    });

    if (conflicto) {
      return NextResponse.json(
        {
          error: "Conflicto: el slot ya fue reservado mientras estabas offline",
          conflicto: {
            reservaId: conflicto.id,
            playerId: conflicto.playerId,
            slotInicio: conflicto.slotInicio,
            slotFin: conflicto.slotFin,
          },
        },
        { status: 409 }
      );
    }

    // El dueño registra la reserva a su nombre en representación del cliente.
    const [reserva] = await db
      .insert(reservas)
      .values({
        tenantId: user.sub,
        canchaId,
        playerId: user.sub,
        slotInicio: inicio,
        slotFin: fin,
        montoTotal: Number(montoTotal).toFixed(2),
        montoPagado: Number(montoTotal).toFixed(2),
        estado: "CONFIRMADA",
      })
      .returning({ id: reservas.id });

    return NextResponse.json({ serverId: reserva.id, localId: (data as { id: string }).id });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Sync error:", error);
    return NextResponse.json({ error: "Error interno de sincronización" }, { status: 500 });
  }
}
