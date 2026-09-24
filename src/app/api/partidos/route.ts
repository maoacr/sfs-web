import { NextResponse } from "next/server";
import {
  db,
  partidos,
  partidoJugadores,
  reservas,
  canchas,
  complejos,
} from "@sfs/db";
import { and, desc, eq, gte, ilike, inArray, lte, or, type SQL } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import { crearPartidoSchema, type CrearPartidoInput } from "@/lib/schemas";
import { toApiCancha, toApiUsuario, USUARIO_PUBLICO } from "@/lib/db-mappers";
import { partidosDelUsuario } from "@/lib/partidos";

/**
 * GET /api/partidos?fecha=YYYY-MM-DD&ciudad=Medellin
 *
 * Lista partidos públicos. Sin filtros, devuelve los del usuario autenticado.
 */
export const GET = apiHandler(
  async (request, ctx, _validated) => {
    const user = ctx.user!;
    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get("fecha");
    const ciudad = searchParams.get("ciudad");

    if (fecha || ciudad) {
      const filtros: SQL[] = [];
      if (fecha) {
        filtros.push(
          gte(reservas.slotInicio, new Date(fecha + "T00:00:00.000Z")),
          lte(reservas.slotInicio, new Date(fecha + "T23:59:59.999Z"))
        );
      }
      if (ciudad) filtros.push(ilike(complejos.ciudad, `%${ciudad}%`));

      const reservasFiltradas = db
        .select({ id: reservas.id })
        .from(reservas)
        .innerJoin(canchas, eq(canchas.id, reservas.canchaId))
        .innerJoin(complejos, eq(complejos.id, canchas.complejoId))
        .where(and(...filtros));

      const lista = await db.query.partidos.findMany({
        where: inArray(partidos.reservaId, reservasFiltradas),
        with: {
          reserva: {
            columns: { slotInicio: true, slotFin: true, montoTotal: true, montoPagado: true },
          },
          equipoA: { columns: { id: true, nombre: true } },
          equipoB: { columns: { id: true, nombre: true } },
          jugadores: { columns: { id: true } },
        },
        orderBy: [desc(partidos.createdAt)],
        limit: 50,
      });

      return NextResponse.json(
        lista.map(({ jugadores, ...p }) => ({ ...p, _count: { jugadores: jugadores.length } }))
      );
    }

    const lista = await db.query.partidos.findMany({
      where: partidosDelUsuario(user.sub),
      with: {
        reserva: {
          columns: {
            id: true,
            slotInicio: true,
            slotFin: true,
            montoTotal: true,
            montoPagado: true,
            saldoPendiente: true,
            estado: true,
          },
          with: {
            cancha: {
              columns: { nombre: true, tipo: true },
              with: { complejo: { columns: { nombre: true } } },
            },
          },
        },
        equipoA: { columns: { id: true, nombre: true } },
        equipoB: { columns: { id: true, nombre: true } },
        jugadores: { columns: { id: true } },
      },
      orderBy: [desc(partidos.createdAt)],
    });

    return NextResponse.json(
      lista.map(({ jugadores, reserva, ...p }) => ({
        ...p,
        reserva: { ...reserva, cancha: toApiCancha(reserva.cancha) },
        _count: { jugadores: jugadores.length },
      }))
    );
  },
  { requireAuth: true }
);

/**
 * POST /api/partidos
 *
 * Crea un partido asociado a una reserva existente.
 * Opcionalmente asigna equipos e invita jugadores.
 */
export const POST = apiHandler<CrearPartidoInput>(
  async (_request, ctx, { body }) => {
    if (!body) {
      return NextResponse.json({ error: "Datos requeridos" }, { status: 400 });
    }

    const user = ctx.user!;
    const { reservaId, equipoAId, equipoBId, jugadores } = body;

    const reserva = await db.query.reservas.findFirst({
      where: and(
        eq(reservas.id, reservaId),
        or(eq(reservas.playerId, user.sub), eq(reservas.tenantId, user.sub))
      ),
      columns: { id: true },
    });

    if (!reserva) {
      return NextResponse.json({ error: "Reserva no encontrada o no tenés acceso" }, { status: 404 });
    }

    const existente = await db.query.partidos.findFirst({
      where: eq(partidos.reservaId, reservaId),
      columns: { id: true },
    });

    if (existente) {
      return NextResponse.json({ error: "Ya existe un partido para esta reserva" }, { status: 409 });
    }

    const partidoId = await db.transaction(async (tx) => {
      const [partido] = await tx
        .insert(partidos)
        .values({
          reservaId,
          creadorId: user.sub,
          equipoAId: equipoAId || null,
          equipoBId: equipoBId || null,
        })
        .returning({ id: partidos.id });

      if (jugadores.length > 0) {
        await tx
          .insert(partidoJugadores)
          .values(jugadores.map((userId) => ({ partidoId: partido.id, userId })))
          .onConflictDoNothing();
      }
      return partido.id;
    });

    const partido = await db.query.partidos.findFirst({
      where: eq(partidos.id, partidoId),
      with: {
        reserva: {
          columns: { slotInicio: true, slotFin: true },
          with: {
            cancha: { columns: { nombre: true }, with: { complejo: { columns: { nombre: true } } } },
          },
        },
        jugadores: { with: { user: { columns: USUARIO_PUBLICO } } },
      },
    });

    return NextResponse.json(
      {
        ...partido!,
        jugadores: partido!.jugadores.map((j) => ({ ...j, user: toApiUsuario(j.user) })),
      },
      { status: 201 }
    );
  },
  {
    requireAuth: true,
    bodySchema: crearPartidoSchema,
  }
);
