import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { jwtVerify } from "jose";

/**
 * POST /api/sync
 *
 * Recibe operaciones pendientes del Sync Engine (offline → online).
 * Procesa una operación a la vez para mantener consistencia.
 *
 * El body debe contener:
 * - type: "CREATE" | "UPDATE" | "DELETE"
 * - entity: "reserva"
 * - data: datos de la entidad
 */
export async function POST(request: Request) {
  try {
    // Verificar autenticación
    const token = request.headers
      .get("cookie")
      ?.split(";")
      .find((c) => c.trim().startsWith("sfs_token="))
      ?.split("=")[1];

    if (!token) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);

    if (payload.role !== "OWNER") {
      return NextResponse.json(
        { error: "Solo dueños pueden sincronizar reservas" },
        { status: 403 }
      );
    }

    const { type, entity, data } = await request.json();

    if (entity !== "reserva") {
      return NextResponse.json(
        { error: "Entidad no soportada para sync" },
        { status: 400 }
      );
    }

    if (type === "CREATE") {
      const {
        canchaId,
        playerNombre,
        slotInicio,
        slotFin,
        montoTotal,
      } = data as {
        canchaId: string;
        playerNombre: string;
        slotInicio: string;
        slotFin: string;
        montoTotal: number;
      };

      // Verificar disponibilidad (el slot no debe estar ya reservado)
      const conflicto = await prisma.reserva.findFirst({
        where: {
          canchaId,
          estado: { in: ["PENDIENTE_PAGO", "CONFIRMADA"] },
          slotInicio: { lt: new Date(slotFin) },
          slotFin: { gt: new Date(slotInicio) },
        },
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

      // TODO: Buscar o crear player por nombre/teléfono
      // Por ahora, usamos un placeholder o el dueño como player
      const reserva = await prisma.reserva.create({
        data: {
          tenantId: payload.sub as string,
          canchaId,
          playerId: payload.sub as string, // Placeholder: el dueño registra a nombre del cliente
          slotInicio: new Date(slotInicio),
          slotFin: new Date(slotFin),
          montoTotal,
          estado: "CONFIRMADA", // Sincronizada = confirmada automáticamente
        },
      });

      return NextResponse.json({
        serverId: reserva.id,
        localId: (data as { id: string }).id,
      });
    }

    return NextResponse.json(
      { error: "Tipo de operación no soportado" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: "Error interno de sincronización" },
      { status: 500 }
    );
  }
}
