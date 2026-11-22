import { NextResponse } from "next/server";
import { db, reservas } from "@sfs/db";
import { and, eq, gt, inArray, lt } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import { syncSchema, type SyncInput } from "@/lib/schemas";
import { canchaDelDueno } from "@/lib/consultas";
import { esDobleBooking } from "@/lib/errores-db";

/**
 * Lo mismo pasó en los dos casos —alguien tomó el turno mientras esta reserva
 * viajaba— así que el mensaje sale de un solo lugar: uno lo detecta el
 * chequeo previo, el otro el constraint, y para el dueño es el mismo hecho.
 */
const CONFLICTO = "Conflicto: el slot ya fue reservado mientras estabas offline";

/**
 * POST /api/sync
 *
 * Recibe operaciones pendientes del Sync Engine (offline → online).
 * Por ahora solo soporta { type: "CREATE", entity: "reserva" }.
 */
export const POST = apiHandler<SyncInput>(
  async (_request, ctx, { body }) => {
    const user = ctx.user!;
    if (!body) {
      return NextResponse.json({ error: "Datos requeridos" }, { status: 400 });
    }
    if (body.type !== "CREATE") {
      return NextResponse.json({ error: "Tipo de operación no soportado" }, { status: 400 });
    }

    const { canchaId, montoTotal } = body.data;
    const inicio = new Date(body.data.slotInicio);
    const fin = new Date(body.data.slotFin);

    if (!(await canchaDelDueno(canchaId, user.sub))) {
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
          error: CONFLICTO,
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
    //
    // El chequeo de arriba no alcanza: esta reserva viene de un dispositivo que
    // estuvo offline, así que es el caso donde la carrera es MÁS probable, no
    // menos. Quien garantiza el turno es `reservas_sin_doble_booking`, y su
    // rechazo se traduce al mismo 409: el cliente lo saca de la cola en el
    // primer intento en lugar de reintentar tres veces contra un 500.
    let reserva: { id: string };

    try {
      [reserva] = await db
        .insert(reservas)
        .values({
          tenantId: user.sub,
          canchaId,
          playerId: user.sub,
          slotInicio: inicio,
          slotFin: fin,
          montoTotal: montoTotal.toFixed(2),
          montoPagado: montoTotal.toFixed(2),
          estado: "CONFIRMADA",
        })
        .returning({ id: reservas.id });
    } catch (error) {
      if (!esDobleBooking(error)) throw error;
      return NextResponse.json({ error: CONFLICTO }, { status: 409 });
    }

    return NextResponse.json({ serverId: reserva.id, localId: body.data.id });
  },
  { requireAuth: true, requiredRole: "OWNER", bodySchema: syncSchema }
);
