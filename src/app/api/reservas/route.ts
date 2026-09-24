import { NextResponse } from "next/server";
import { db, reservas, canchas, tarifas, estadoReservaEnum, type Reserva } from "@sfs/db";
import { and, eq, gt, gte, inArray, isNull, lt, lte, sum, asc, type SQL } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import { createReservaSchema, type CreateReservaInput } from "@/lib/schemas";
import { notificarReserva } from "@/lib/event-listeners";
import { liberarReservasExpiradas } from "@/lib/ttl";
import { calcularPrecio, usarPromocion } from "@/lib/pricing";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { toApiCancha, toApiUsuario } from "@/lib/db-mappers";

const ESTADOS_ACTIVOS: Reserva["estado"][] = ["PENDIENTE_PAGO", "PAGO_PARCIAL", "CONFIRMADA"];

/**
 * POST /api/reservas
 */
export const POST = apiHandler<CreateReservaInput>(
  async (_request, ctx, { body }) => {
    if (!body) {
      return NextResponse.json({ error: "Datos requeridos" }, { status: 400 });
    }

    const user = ctx.user!;
    const { canchaId, slotInicio, slotFin, playerId } = body;
    const inicio = new Date(slotInicio);
    const fin = new Date(slotFin);

    // ─── 1. Bloqueo por saldo pendiente ──────────────────────────────────

    const [{ saldo }] = await db
      .select({ saldo: sum(reservas.saldoPendiente) })
      .from(reservas)
      .where(and(eq(reservas.playerId, user.sub), eq(reservas.estado, "PAGO_PARCIAL")));

    const totalSaldo = Number(saldo ?? 0);
    if (totalSaldo > 0) {
      return NextResponse.json(
        {
          error: "Tenés saldo pendiente. Regularizá tus pagos antes de reservar.",
          saldoPendiente: totalSaldo,
        },
        { status: 403 }
      );
    }

    // ─── 2. Limpiar reservas expiradas (fire-and-forget) ─────────────────

    liberarReservasExpiradas().catch(() => {});

    const cancha = await db.query.canchas.findFirst({
      where: and(eq(canchas.id, canchaId), isNull(canchas.deletedAt)),
      columns: { id: true, tenantId: true },
    });

    if (!cancha) {
      return NextResponse.json({ error: "Cancha no encontrada" }, { status: 404 });
    }

    const esOwner = user.role === "OWNER";
    if (esOwner && cancha.tenantId !== user.sub) {
      return NextResponse.json({ error: "Cancha no encontrada" }, { status: 404 });
    }

    const finalPlayerId = esOwner ? playerId || user.sub : user.sub;

    // ─── 3. Verificar solapamiento ────────────────────────────────────────

    const conflicto = await db.query.reservas.findFirst({
      where: and(
        eq(reservas.canchaId, canchaId),
        inArray(reservas.estado, ESTADOS_ACTIVOS),
        lt(reservas.slotInicio, fin),
        gt(reservas.slotFin, inicio)
      ),
    });

    if (conflicto) {
      // Si la reserva conflictiva es del mismo jugador, retornarla para continuar el pago
      if (conflicto.playerId === finalPlayerId && conflicto.estado !== "CONFIRMADA") {
        return NextResponse.json(conflicto, { status: 200 });
      }
      return NextResponse.json({ error: "El slot ya está reservado" }, { status: 409 });
    }

    // ─── 4. Calcular precio con el motor ─────────────────────────────────

    const precio = await calcularPrecio(
      canchaId,
      inicio.toISOString().slice(0, 10),
      inicio.toISOString().slice(11, 16)
    );

    let montoTotal = 0;
    if (precio.success) {
      montoTotal = precio.data.precioFinal;
      if (precio.data.promocionAplicada) {
        await usarPromocion(precio.data.promocionAplicada);
      }
    } else {
      const tarifa = await db.query.tarifas.findFirst({
        where: and(eq(tarifas.canchaId, canchaId), isNull(tarifas.diaSemana)),
      });
      montoTotal = tarifa ? Number(tarifa.precioBase) * Number(tarifa.factor) : 0;
    }

    // ─── 5. Crear reserva ─────────────────────────────────────────────────

    const [reserva] = await db
      .insert(reservas)
      .values({
        tenantId: cancha.tenantId,
        canchaId,
        playerId: finalPlayerId,
        slotInicio: inicio,
        slotFin: fin,
        montoTotal: montoTotal.toFixed(2),
        montoPagado: esOwner ? montoTotal.toFixed(2) : "0.00",
        saldoPendiente: esOwner ? "0.00" : montoTotal.toFixed(2),
        estado: esOwner ? "CONFIRMADA" : "PENDIENTE_PAGO",
      })
      .returning();

    await notificarReserva(reserva.id, esOwner ? "RESERVA_CONFIRMADA" : "RESERVA_CREADA");

    return NextResponse.json(reserva, { status: 201 });
  },
  {
    requireAuth: true,
    bodySchema: createReservaSchema,
    rateLimit: RATE_LIMITS.STRICT,
    requireCsrf: false,
  }
);

/**
 * GET /api/reservas
 */
export const GET = apiHandler(
  async (request, ctx, _validated) => {
    const user = ctx.user!;
    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get("fecha");
    const estado = searchParams.get("estado");

    const condiciones: SQL[] = [
      user.role === "OWNER" ? eq(reservas.tenantId, user.sub) : eq(reservas.playerId, user.sub),
    ];

    if (fecha) {
      condiciones.push(
        gte(reservas.slotInicio, new Date(fecha + "T00:00:00.000Z")),
        lte(reservas.slotInicio, new Date(fecha + "T23:59:59.999Z"))
      );
    }

    if (estado) {
      const estadoValido = estadoReservaEnum.enumValues.find((e) => e === estado);
      if (!estadoValido) {
        return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
      }
      condiciones.push(eq(reservas.estado, estadoValido));
    }

    const lista = await db.query.reservas.findMany({
      where: and(...condiciones),
      with: {
        cancha: {
          columns: { nombre: true, tipo: true },
          with: { complejo: { columns: { nombre: true } } },
        },
        player: { columns: { nombre: true, apellido: true, apodo: true, telefono: true } },
      },
      orderBy: [asc(reservas.slotInicio)],
    });

    return NextResponse.json(
      lista.map((r) => ({ ...r, cancha: toApiCancha(r.cancha), player: toApiUsuario(r.player) }))
    );
  },
  { requireAuth: true }
);
