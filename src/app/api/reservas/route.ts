import { NextResponse } from "next/server";
import { db, reservas, pagos, canchas, tarifas, slotConfigs, estadoReservaEnum } from "@sfs/db";
import { and, eq, gt, inArray, isNull, lt, asc, desc, type SQL } from "drizzle-orm";
import { aInstante } from "@/lib/zona-horaria";
import { diaSemanaDeFecha, turnoDentroDeHorario } from "@/lib/disponibilidad";
import { reservasDelDiaLocal, reservaOcupaElTurno } from "@/lib/consultas";
import { apiHandler } from "@/lib/api-handler";
import { createReservaSchema, type CreateReservaInput } from "@/lib/schemas";
import { notificarReserva } from "@/lib/event-listeners";
import { liberarReservasExpiradas } from "@/lib/ttl";
import { calcularPrecio, usarPromocion } from "@/lib/pricing";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { saldoPendienteDe } from "@/lib/saldo";
import { toApiCancha, toApiUsuario } from "@/lib/db-mappers";

/**
 * POST /api/reservas
 */
export const POST = apiHandler<CreateReservaInput>(
  async (_request, ctx, { body }) => {
    if (!body) {
      return NextResponse.json({ error: "Datos requeridos" }, { status: 400 });
    }

    const user = ctx.user!;
    const { canchaId, fecha, hora, playerId, montoPagado, metodo, entidad } = body;

    const esOwner = user.role === "OWNER";

    // Quién va a quedar como titular de la reserva. El dueño puede agendar a
    // nombre de un jugador; cualquier otro rol sólo reserva para sí mismo.
    const finalPlayerId = esOwner ? playerId || user.sub : user.sub;

    // ─── 1. Bloqueo por saldo pendiente ──────────────────────────────────
    //
    // Se mide contra el TITULAR, no contra quien manda la request: si no,
    // el dueño agendando a nombre de un deudor sería un agujero en la regla
    // y la deuda se volvería opcional. Deber bloquea, lo pida quien lo pida.

    const totalSaldo = await saldoPendienteDe(finalPlayerId);
    if (totalSaldo > 0) {
      return NextResponse.json(
        {
          error:
            finalPlayerId === user.sub
              ? "Tenés saldo pendiente. Regularizá tus pagos antes de reservar."
              : "Ese jugador tiene saldo pendiente. Cobrale lo que debe o registrá el pago antes de agendarle.",
          saldoPendiente: totalSaldo,
        },
        { status: 403 }
      );
    }

    // ─── 2. Limpiar reservas expiradas (fire-and-forget) ─────────────────

    liberarReservasExpiradas().catch(() => {});

    const cancha = await db.query.canchas.findFirst({
      where: and(eq(canchas.id, canchaId), isNull(canchas.deletedAt)),
      columns: { id: true, tenantId: true, duracionSlotMinutos: true },
      with: {
        complejo: { columns: { zonaHoraria: true } },
        slots: { where: eq(slotConfigs.diaSemana, diaSemanaDeFecha(fecha)) },
      },
    });

    if (!cancha) {
      return NextResponse.json({ error: "Cancha no encontrada" }, { status: 404 });
    }

    if (esOwner && cancha.tenantId !== user.sub) {
      return NextResponse.json({ error: "Cancha no encontrada" }, { status: 404 });
    }

    if (
      !turnoDentroDeHorario({
        slotConfig: cancha.slots[0],
        hora,
        duracionMinutos: cancha.duracionSlotMinutos,
      })
    ) {
      return NextResponse.json({ error: "La cancha no está abierta en ese horario" }, { status: 400 });
    }

    const inicio = aInstante(fecha, hora, cancha.complejo.zonaHoraria);
    const fin = new Date(inicio.getTime() + cancha.duracionSlotMinutos * 60 * 1000);

    if (!esOwner && inicio.getTime() <= Date.now()) {
      return NextResponse.json({ error: "Ese horario ya pasó" }, { status: 400 });
    }

    // ─── 3. Verificar solapamiento ────────────────────────────────────────

    const conflicto = await db.query.reservas.findFirst({
      where: and(
        eq(reservas.canchaId, canchaId),
        reservaOcupaElTurno(),
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

    const precio = await calcularPrecio(canchaId, fecha, hora);

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

    // El dueño agenda en el mostrador y cobra ahí. Sin `montoPagado` se asume
    // que cobró todo; con un monto menor la reserva queda con saldo, y ese
    // saldo bloquea al jugador para la próxima igual que si hubiera pagado
    // parcial por la app.
    const cobrado = esOwner ? Math.min(montoPagado ?? montoTotal, montoTotal) : 0;
    const saldoReserva = montoTotal - cobrado;

    const reserva = await db.transaction(async (tx) => {
      const [creada] = await tx
        .insert(reservas)
        .values({
          tenantId: cancha.tenantId,
          canchaId,
          playerId: finalPlayerId,
          slotInicio: inicio,
          slotFin: fin,
          montoTotal: montoTotal.toFixed(2),
          montoPagado: cobrado.toFixed(2),
          saldoPendiente: saldoReserva.toFixed(2),
          estado: esOwner ? (saldoReserva > 0 ? "PAGO_PARCIAL" : "CONFIRMADA") : "PENDIENTE_PAGO",
        })
        .returning();

      // Toda plata que entra deja fila en `pagos`. Antes este camino marcaba la
      // reserva como pagada sin registrar nada: la plata que cobraba el dueño
      // era invisible para cualquier reporte.
      if (cobrado > 0) {
        await tx.insert(pagos).values({
          reservaId: creada.id,
          userId: finalPlayerId,
          monto: cobrado.toFixed(2),
          estadoPago: "APROBADO",
          canal: "PRESENCIAL",
          metodo: metodo ?? "EFECTIVO",
          entidad: entidad ?? null,
          mpMetadata: { registradoPor: user.sub },
        });
      }

      return creada;
    });

    await notificarReserva(
      reserva.id,
      !esOwner ? "RESERVA_CREADA" : saldoReserva > 0 ? "PAGO_PARCIAL_RECIBIDO" : "RESERVA_CONFIRMADA"
    );

    return NextResponse.json(reserva, { status: 201 });
  },
  {
    requireAuth: true,
    bodySchema: createReservaSchema,
    rateLimit: RATE_LIMITS.STRICT,
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
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return NextResponse.json({ error: "Fecha inválida. Usá YYYY-MM-DD" }, { status: 400 });
      }
      condiciones.push(inArray(reservas.id, reservasDelDiaLocal(fecha)));
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
          with: { complejo: { columns: { nombre: true, zonaHoraria: true } } },
        },
        player: { columns: { nombre: true, apellido: true, apodo: true, telefono: true } },
        // El último intento de pago: es lo que le permite a la UI explicar por
        // qué no se acreditó, en vez de dejar a la persona adivinando.
        pagos: {
          columns: { estadoPago: true, detalleEstado: true, monto: true, createdAt: true },
          orderBy: [desc(pagos.createdAt)],
          limit: 1,
        },
      },
      orderBy: [asc(reservas.slotInicio)],
    });

    return NextResponse.json(
      lista.map(({ pagos: ultimos, ...r }) => ({
        ...r,
        cancha: toApiCancha(r.cancha),
        player: toApiUsuario(r.player),
        ultimoPago: ultimos[0] ?? null,
      }))
    );
  },
  { requireAuth: true }
);
