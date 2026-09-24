import { db, pagos, reservas, type Pago, type Reserva } from "@sfs/db";
import { eq, sql } from "drizzle-orm";
import { createCheckoutPreference, estadoPagoDesdeMp } from "@/lib/mercadopago";

export function aplicarPago({
  montoTotal,
  montoPagado,
  monto,
}: {
  montoTotal: number;
  montoPagado: number;
  monto: number;
}): { montoPagado: number; saldoPendiente: number; estado: Reserva["estado"] } {
  const nuevoMontoPagado = montoPagado + monto;
  const saldoPendiente = Math.max(montoTotal - nuevoMontoPagado, 0);
  return {
    montoPagado: nuevoMontoPagado,
    saldoPendiente,
    estado: saldoPendiente === 0 ? "CONFIRMADA" : "PAGO_PARCIAL",
  };
}

/**
 * Registra un Pago PENDIENTE y crea su preference de Checkout Pro.
 * Si MP falla, el Pago se elimina para no dejar registros huérfanos.
 */
export async function iniciarPagoMp(params: { reservaId: string; userId: string; monto: number }) {
  const [pago] = await db
    .insert(pagos)
    .values({ reservaId: params.reservaId, userId: params.userId, monto: params.monto.toFixed(2) })
    .returning({ id: pagos.id });

  try {
    const { preferenceId, checkoutUrl } = await createCheckoutPreference({
      pagoId: pago.id,
      reservaId: params.reservaId,
      monto: params.monto,
    });
    await db
      .update(pagos)
      .set({
        mpMetadata: sql`coalesce(${pagos.mpMetadata}, '{}'::jsonb) || ${JSON.stringify({ preferenceId })}::jsonb`,
      })
      .where(eq(pagos.id, pago.id));
    return { pagoId: pago.id, checkoutUrl };
  } catch (error) {
    await db.delete(pagos).where(eq(pagos.id, pago.id));
    throw error;
  }
}

export interface PagoMp {
  id?: number | string;
  status?: string;
  status_detail?: string;
  payment_method_id?: string;
  external_reference?: string;
  transaction_amount?: number;
}

export type ResultadoPagoMp =
  | { tipo: "ignorado"; motivo: string }
  | { tipo: "actualizado"; estadoPago: Pago["estadoPago"] }
  | { tipo: "aplicado"; reservaId: string; estado: Reserva["estado"] }
  | { tipo: "reembolsar"; pagoId: string; mpPaymentId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Aplica una notificación de pago de MP. Idempotente: MP envía varias
 * notificaciones por pago (created/updated) y reintenta ante errores, así que
 * un pago ya APROBADO nunca vuelve a sumarse a la reserva.
 */
export async function registrarPagoMp(payment: PagoMp): Promise<ResultadoPagoMp> {
  const pagoId = payment.external_reference;
  if (!pagoId || !UUID.test(pagoId) || payment.id === undefined) {
    return { tipo: "ignorado", motivo: "external_reference inválido" };
  }

  const mpPaymentId = String(payment.id);
  const estadoNuevo = estadoPagoDesdeMp(payment.status);

  return db.transaction(async (tx) => {
    const [pago] = await tx.select().from(pagos).where(eq(pagos.id, pagoId)).for("update");
    if (!pago) return { tipo: "ignorado", motivo: "pago no encontrado" } as const;

    if (pago.estadoPago === "REEMBOLSADO") {
      return { tipo: "ignorado", motivo: "pago ya reembolsado" } as const;
    }
    if (pago.estadoPago === "APROBADO" && estadoNuevo !== "REEMBOLSADO") {
      return { tipo: "ignorado", motivo: "pago ya procesado" } as const;
    }

    const mpMetadata = {
      ...((pago.mpMetadata as Record<string, unknown> | null) ?? {}),
      payment: {
        id: mpPaymentId,
        status: payment.status,
        statusDetail: payment.status_detail,
        metodo: payment.payment_method_id,
      },
    };

    if (estadoNuevo !== "APROBADO") {
      await tx
        .update(pagos)
        .set({ estadoPago: estadoNuevo, mpPaymentId, mpMetadata })
        .where(eq(pagos.id, pago.id));
      return { tipo: "actualizado", estadoPago: estadoNuevo } as const;
    }

    const [reserva] = await tx
      .select()
      .from(reservas)
      .where(eq(reservas.id, pago.reservaId))
      .for("update");

    const monto = Number(payment.transaction_amount ?? pago.monto);

    await tx
      .update(pagos)
      .set({ estadoPago: "APROBADO", monto: monto.toFixed(2), mpPaymentId, mpMetadata })
      .where(eq(pagos.id, pago.id));

    // El pago puede aprobarse después de que el TTL o el usuario cancelaron la reserva.
    if (reserva.estado === "CANCELADA" || reserva.estado === "EXPIRADA") {
      return { tipo: "reembolsar", pagoId: pago.id, mpPaymentId } as const;
    }

    const nuevo = aplicarPago({
      montoTotal: Number(reserva.montoTotal),
      montoPagado: Number(reserva.montoPagado),
      monto,
    });

    await tx
      .update(reservas)
      .set({
        montoPagado: nuevo.montoPagado.toFixed(2),
        saldoPendiente: nuevo.saldoPendiente.toFixed(2),
        estado: nuevo.estado,
      })
      .where(eq(reservas.id, reserva.id));

    return { tipo: "aplicado", reservaId: reserva.id, estado: nuevo.estado } as const;
  });
}
