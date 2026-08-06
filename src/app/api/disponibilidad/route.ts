import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { getAuthUser, AuthError } from "@/lib/auth-api";
import { liberarReservasExpiradas } from "@/lib/ttl";

/**
 * GET /api/disponibilidad
 * 
 * Busca canchas disponibles para un día y rango horario.
 * Query params:
 *   - fecha: ISO date (YYYY-MM-DD) — obligatorio
 *   - tipo: F5|F6|F7|F8|F9|F11 — opcional
 */
export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);

    // Limpiar reservas expiradas antes de mostrar disponibilidad
    liberarReservasExpiradas().catch(() => {});

    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get("fecha");
    const tipo = searchParams.get("tipo");

    if (!fecha) {
      return NextResponse.json({ error: "Parámetro 'fecha' requerido" }, { status: 400 });
    }

    const fechaDate = new Date(fecha + "T00:00:00");
    if (isNaN(fechaDate.getTime())) {
      return NextResponse.json({ error: "Fecha inválida. Usá YYYY-MM-DD" }, { status: 400 });
    }

    const diaSemana = fechaDate.getUTCDay(); // 0=Domingo, 6=Sábado

    // Buscar canchas con slots configurados para ese día
    const canchas = await prisma.cancha.findMany({
      where: {
        deletedAt: null,
        ...(tipo ? { tipo: tipo as any } : {}),
        slots: { some: { diaSemana } },
      },
      include: {
        complejo: { select: { id: true, nombre: true, direccion: true, telefono: true } },
        slots: { where: { diaSemana }, orderBy: { horaApertura: "asc" } },
        tarifas: {
          where: { diaSemana: null }, // Solo tarifa base por ahora
          take: 1,
        },
        imagenes: { where: { principal: true }, take: 1 },
        reservas: {
          where: {
            estado: { in: ["PENDIENTE_PAGO", "CONFIRMADA"] },
            slotInicio: { gte: fechaDate },
            slotFin: { lte: new Date(fecha + "T23:59:59.999") },
          },
          select: { id: true, slotInicio: true, slotFin: true, estado: true, player: { select: { primerNombre: true, apellidos: true, apodo: true, telefono: true } } },
        },
      },
    });

    // Calcular slots disponibles para cada cancha
    const resultados = canchas.map((cancha) => {
      const slotConfig = cancha.slots[0];
      if (!slotConfig) return null;

      const duracionMs = cancha.duracionSlotMinutos * 60 * 1000;

      // Extraer hora de apertura y cierre del slot config
      const apHora = slotConfig.horaApertura instanceof Date
        ? slotConfig.horaApertura.getUTCHours()
        : parseInt((slotConfig.horaApertura as string)?.slice(11, 13) || "8");
      const apMin = slotConfig.horaApertura instanceof Date
        ? slotConfig.horaApertura.getUTCMinutes()
        : parseInt((slotConfig.horaApertura as string)?.slice(14, 16) || "0");
      const ciHora = slotConfig.horaCierre instanceof Date
        ? slotConfig.horaCierre.getUTCHours()
        : parseInt((slotConfig.horaCierre as string)?.slice(11, 13) || "23");
      const ciMin = slotConfig.horaCierre instanceof Date
        ? slotConfig.horaCierre.getUTCMinutes()
        : parseInt((slotConfig.horaCierre as string)?.slice(14, 16) || "0");

      const apertura = new Date(fecha + `T${String(apHora).padStart(2, "0")}:${String(apMin).padStart(2, "0")}:00`);
      const cierre = new Date(fecha + `T${String(ciHora).padStart(2, "0")}:${String(ciMin).padStart(2, "0")}:00`);

      // Generar todos los slots del día
      const slots: { inicio: string; fin: string; disponible: boolean; reserva?: { id: string; estado: string; player: string; apodo?: string | null; telefono?: string | null } }[] = [];
      let cursor = new Date(apertura);
      const ahora = Date.now();

      while (cursor.getTime() + duracionMs <= cierre.getTime()) {
        const fin = new Date(cursor.getTime() + duracionMs);

        // Saltar slots que ya empezaron (para la fecha de hoy)
        if (cursor.getTime() < ahora) {
          cursor = fin;
          continue;
        }

        // Verificar si este slot está reservado
        const reserva = cancha.reservas.find((r) => {
          const rInicio = new Date(r.slotInicio).getTime();
          const rFin = new Date(r.slotFin).getTime();
          return cursor.getTime() < rFin && fin.getTime() > rInicio;
        });

        slots.push({
          inicio: cursor.toISOString(),
          fin: fin.toISOString(),
          disponible: !reserva,
          reserva: reserva ? {
            id: reserva.id,
            estado: reserva.estado,
            player: `${reserva.player.primerNombre} ${reserva.player.apellidos}`,
            apodo: reserva.player.apodo,
            telefono: reserva.player.telefono,
          } : undefined,
        });

        cursor = fin;
      }

      const precio = cancha.tarifas[0]?.precioBase
        ? Number(cancha.tarifas[0].precioBase)
        : null;

      return {
        id: cancha.id,
        nombre: cancha.nombre,
        tipo: cancha.tipo,
        capacidad: cancha.capacidad,
        descripcion: cancha.descripcion,
        servicios: cancha.servicios,
        duracionSlotMinutos: cancha.duracionSlotMinutos,
        complejo: cancha.complejo,
        precioBase: precio,
        imagen: cancha.imagenes[0]?.url || null,
        slots,
      };
    });

    return NextResponse.json(resultados.filter(Boolean));
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("GET /api/disponibilidad error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
