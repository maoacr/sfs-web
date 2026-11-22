"use client";

import { formatearPrecio } from "@/lib/moneda";

/**
 * Cancelar no es "sacar de la lista": dispara la política de reembolso del
 * complejo y le devuelve plata al jugador. Antes era una `✕` de diez píxeles
 * sin etiqueta ni confirmación, al lado de un `✓` que hacía algo
 * completamente distinto.
 *
 * Vive acá y no dentro de una pantalla porque lo piden el panel de reservas y
 * el dashboard, y una confirmación que avisa del reembolso en un lugar y no en
 * el otro es peor que no tenerla: enseña que el aviso es opcional.
 */

/** Sólo lo que hace falta para preguntar. Los textos los formatea quien llama. */
export interface ReservaACancelar {
  titular: string;
  cancha: string;
  horario: string;
  montoPagado: number;
}

export function ConfirmarCancelacion({ reserva, onCerrar, onConfirmar }: {
  reserva: ReservaACancelar;
  onCerrar: () => void;
  onConfirmar: () => void;
}) {
  const pagado = Number(reserva.montoPagado ?? 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <div role="dialog" aria-labelledby="titulo-cancelar"
        className="w-full max-w-md rounded-t-2xl border border-border bg-bg p-5 sm:rounded-2xl">
        <h2 id="titulo-cancelar" className="text-lg font-bold text-text">¿Cancelar esta reserva?</h2>
        <p className="mt-2 text-sm text-text-muted">
          {reserva.cancha} · {reserva.titular} · {reserva.horario}
        </p>

        {pagado > 0 && (
          <p className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-text">
            Ya pagó {formatearPrecio(pagado)}. Al cancelar se le aplica la política de reembolso
            del complejo.
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <button onClick={onCerrar} type="button"
            className="min-h-11 flex-1 rounded-xl border border-border px-4 text-sm font-medium text-text-muted hover:bg-surface-hover">
            No, dejarla
          </button>
          <button onClick={onConfirmar} type="button"
            className="min-h-11 flex-1 rounded-xl bg-error px-4 text-sm font-semibold text-white hover:opacity-90">
            Sí, cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
