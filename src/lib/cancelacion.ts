import { db, reservas, pagos } from "@sfs/db";
import { and, eq, isNotNull } from "drizzle-orm";
import { refundPayment, isMercadoPagoConfigured } from "@/lib/mercadopago";
import { notificarReserva } from "@/lib/event-listeners";

export function porcentajeReembolso(params: {
  esDueno: boolean;
  horasHastaReserva: number;
  plazoHoras: number;
  penalizacion: number;
}): number {
  const { esDueno, horasHastaReserva, plazoHoras, penalizacion } = params;
  if (esDueno || horasHastaReserva >= plazoHoras) return 100;
  return 100 - penalizacion;
}

export type ResultadoCancelacion =
  | { error: string; status: number }
  | {
      reservaId: string;
      estado: "CANCELADA";
      porcentajeReembolso: number;
      reembolsos: { pagoId: string; monto: number; resultado: "ok" | "error" }[];
      motivo: string;
    };

/**
 * Cancela una reserva aplicando la política del complejo:
 * - El dueño cancela con reembolso del 100%.
 * - El jugador antes del plazo recibe 100%; dentro del plazo se descuenta la penalización.
 */
export async function cancelarReserva(params: {
  reservaId: string;
  user: { sub: string; role: "OWNER" | "PLAYER" };
  motivo?: string;
}): Promise<ResultadoCancelacion> {
  const { reservaId, user } = params;

  const reserva = await db.query.reservas.findFirst({
    where: eq(reservas.id, reservaId),
    with: {
      cancha: { columns: {}, with: { complejo: true } },
      pagos: {
        where: and(eq(pagos.estadoPago, "APROBADO"), isNotNull(pagos.mpPaymentId)),
      },
    },
  });

  if (!reserva) return { error: "Reserva no encontrada", status: 404 };

  const esJugador = reserva.playerId === user.sub;
  const esDueno = reserva.tenantId === user.sub && user.role === "OWNER";

  if (!esJugador && !esDueno) {
    return { error: "No tenés permiso para cancelar esta reserva", status: 403 };
  }

  if (
    reserva.estado === "CANCELADA" ||
    reserva.estado === "COMPLETADA" ||
    reserva.estado === "EXPIRADA"
  ) {
    return { error: "Esta reserva ya no se puede cancelar", status: 400 };
  }

  const { complejo } = reserva.cancha;
  const porcentaje = porcentajeReembolso({
    esDueno,
    horasHastaReserva: (reserva.slotInicio.getTime() - Date.now()) / (1000 * 60 * 60),
    plazoHoras: Number(complejo.politicaCancelacionHoras ?? 24),
    penalizacion: Number(complejo.politicaCancelacionPenalizacion ?? 0),
  });

  const motivo = params.motivo || (esDueno ? "Cancelado por el dueño" : "Cancelado por el jugador");
  const reembolsos: { pagoId: string; monto: number; resultado: "ok" | "error" }[] = [];

  if (isMercadoPagoConfigured() && porcentaje > 0) {
    for (const pago of reserva.pagos) {
      const montoReembolso = Math.round(Number(pago.monto) * (porcentaje / 100));
      try {
        await refundPayment(pago.mpPaymentId!, porcentaje === 100 ? undefined : montoReembolso);
        await db
          .update(pagos)
          .set({
            estadoPago: porcentaje === 100 ? "REEMBOLSADO" : "APROBADO",
            mpMetadata: {
              ...((pago.mpMetadata as Record<string, unknown> | null) ?? {}),
              reembolso: { monto: montoReembolso, porcentaje, motivo },
            },
          })
          .where(eq(pagos.id, pago.id));
        reembolsos.push({ pagoId: pago.id, monto: montoReembolso, resultado: "ok" });
      } catch (err) {
        console.error(`[Cancelar] Error reembolsando pago ${pago.id}:`, err);
        reembolsos.push({ pagoId: pago.id, monto: montoReembolso, resultado: "error" });
      }
    }
  }

  await db
    .update(reservas)
    .set({ estado: "CANCELADA", saldoPendiente: "0.00" })
    .where(eq(reservas.id, reserva.id));

  await notificarReserva(reserva.id, "RESERVA_CANCELADA");

  return {
    reservaId: reserva.id,
    estado: "CANCELADA",
    porcentajeReembolso: porcentaje,
    reembolsos,
    motivo,
  };
}
