import { NextResponse } from "next/server";
import { db, canchas, slotConfigs, reservas } from "@sfs/db";
import { eq, and, isNull, inArray, gt, lt } from "drizzle-orm";
import { liberarReservasExpiradas } from "@/lib/ttl";
import { calcularSlotsDisponibles, diaSemanaDeFecha } from "@/lib/disponibilidad";
import { ventanaDelDia } from "@/lib/zona-horaria";
import { tiposCancha } from "@/lib/schemas";
import { tipoCanchaToDb, tipoCanchaToApi, toApiComplejo } from "@/lib/db-mappers";

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
    // Limpiar reservas expiradas en background antes de consultar disponibilidad
    liberarReservasExpiradas().catch(() => {});

    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get("fecha");
    const tipoParam = searchParams.get("tipo");

    if (!fecha) {
      return NextResponse.json({ error: "Parámetro 'fecha' requerido" }, { status: 400 });
    }

    const tipo = tipoParam ? tiposCancha.find((t) => t === tipoParam) : undefined;
    if (tipoParam && !tipo) {
      return NextResponse.json({ error: "Tipo de cancha inválido" }, { status: 400 });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return NextResponse.json({ error: "Fecha inválida. Usá YYYY-MM-DD" }, { status: 400 });
    }

    // `fecha` es un día de calendario en la zona de cada cancha
    const diaSemana = diaSemanaDeFecha(fecha);
    const { desde, hasta } = ventanaDelDia(fecha);

    // Traer canchas con sus relaciones vía Drizzle
    const canchasList = await db.query.canchas.findMany({
      where: and(
        isNull(canchas.deletedAt),
        tipo ? eq(canchas.tipo, tipoCanchaToDb(tipo)) : undefined
      ),
      with: {
        complejo: true,
        slots: {
          where: eq(slotConfigs.diaSemana, diaSemana),
        },
        tarifas: true,
        imagenes: {
          orderBy: (imagenes, { asc }) => [asc(imagenes.orden)],
        },
        reservas: {
          where: and(
            inArray(reservas.estado, ["PENDIENTE_PAGO", "PAGO_PARCIAL", "CONFIRMADA"]),
            lt(reservas.slotInicio, hasta),
            gt(reservas.slotFin, desde)
          ),
          with: {
            player: {
              columns: {
                id: true,
                nombre: true,
                apellido: true,
                apodo: true,
                telefono: true,
              },
            },
          },
        },
      },
    });

    // Calcular disponibilidad usando el motor puro de dominio
    const resultados = canchasList
      .map((cancha) => {
        const slotConfig = cancha.slots[0];
        if (!slotConfig) return null;

        const slots = calcularSlotsDisponibles({
          fechaIso: fecha,
          slotConfig,
          duracionSlotMinutos: cancha.duracionSlotMinutos,
          reservas: cancha.reservas,
          tarifas: cancha.tarifas,
          zonaHoraria: cancha.complejo.zonaHoraria,
        });

        const precioBase = cancha.tarifas[0]?.precioBase ? Number(cancha.tarifas[0].precioBase) : null;

        return {
          id: cancha.id,
          nombre: cancha.nombre,
          tipo: tipoCanchaToApi(cancha.tipo),
          capacidad: cancha.capacidad,
          descripcion: cancha.descripcion,
          servicios: cancha.servicios,
          duracionSlotMinutos: cancha.duracionSlotMinutos,
          complejo: toApiComplejo({
            id: cancha.complejo.id,
            nombre: cancha.complejo.nombre,
            direccion: cancha.complejo.direccion,
            tipoVia: cancha.complejo.tipoVia,
            numeroVia: cancha.complejo.numeroVia,
            numeroSec: cancha.complejo.numeroSec,
            complemento: cancha.complejo.complemento,
            ciudad: cancha.complejo.ciudad,
            departamento: cancha.complejo.departamento,
            telefono: cancha.complejo.telefono,
            zonaHoraria: cancha.complejo.zonaHoraria,
            latitud: cancha.complejo.latitud,
            longitud: cancha.complejo.longitud,
          }),
          precioBase,
          imagen: cancha.imagenes[0]?.url || null,
          imagenes: cancha.imagenes.map((i) => i.url),
          slots,
        };
      })
      .filter(Boolean);

    return NextResponse.json(resultados);
  } catch (error) {
    console.error("GET /api/disponibilidad error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
