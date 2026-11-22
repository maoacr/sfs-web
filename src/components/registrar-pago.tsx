"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { METODOS_DE_MOSTRADOR, requiereEntidad } from "@/lib/metodos-de-mostrador";
import { seOfreceCerrarAlCobrar } from "@/lib/acciones-de-reserva";

export interface ReservaACobrar {
  id: string;
  saldoPendiente: number;
  titular: string;
  /** Hace falta para saber si además hay que ofrecer cerrar el turno. */
  estado: string;
}

const formatearPrecio = (monto: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(monto);

export function RegistrarPago({ reserva, onCerrar, onRegistrado }: {
  reserva: ReservaACobrar;
  onCerrar: () => void;
  onRegistrado: () => void;
}) {
  const [monto, setMonto] = useState(reserva.saldoPendiente);
  const [metodo, setMetodo] = useState<string>("EFECTIVO");
  const [entidad, setEntidad] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Arranca sin marcar a propósito. El cobro también pasa ANTES del partido
  // —el jugador llega y completa—, así que darlo por cerrado por default
  // escribiría un hecho que nadie afirmó.
  const [yaTermino, setYaTermino] = useState(false);

  const pideEntidad = requiereEntidad(metodo);
  const ofreceCerrar = seOfreceCerrarAlCobrar(reserva);
  const saldoQueQueda = reserva.saldoPendiente - monto;

  async function registrar() {
    setError(null);

    // Se valida acá para no hacer un viaje al servidor por un error obvio,
    // pero el servidor valida igual: esto es comodidad, no seguridad.
    if (!(monto > 0)) {
      return setError("El monto tiene que ser mayor a cero.");
    }
    if (monto > reserva.saldoPendiente) {
      return setError(`No podés cobrar más que el saldo pendiente (${formatearPrecio(reserva.saldoPendiente)}).`);
    }

    setEnviando(true);
    const res = await apiFetch(`/api/reservas/${reserva.id}/confirmar-pago`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metodo,
        monto,
        ...(pideEntidad && entidad.trim() ? { entidad: entidad.trim() } : {}),
      }),
    });
    const data = await res.json().catch(() => null);
    setEnviando(false);

    if (!res.ok) {
      return setError(data?.error ?? "No pudimos registrar el cobro. Intentá de nuevo.");
    }

    // La plata se registra PRIMERO y el cierre después, nunca al revés: si
    // este segundo paso falla, el cobro ya quedó asentado y lo único que falta
    // es volver a marcar el partido. Al revés habría un partido cerrado con
    // plata que nunca se registró.
    if (ofreceCerrar && yaTermino) {
      setEnviando(true);
      const cierre = await apiFetch(`/api/reservas/${reserva.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "COMPLETADA" }),
      });
      setEnviando(false);

      if (!cierre.ok) {
        const detalle = await cierre.json().catch(() => null);
        return setError(
          detalle?.error ??
            "Cobramos el saldo, pero no pudimos cerrar el turno. Marcalo como jugado desde la lista."
        );
      }
    }

    onRegistrado();
  }

  const campo = "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div role="dialog" aria-labelledby="titulo-cobro"
        className="w-full max-w-md rounded-t-2xl border border-border bg-bg p-5 sm:rounded-2xl">
        <h2 id="titulo-cobro" className="text-lg font-bold text-text">Registrar pago</h2>
        <p className="mt-1 text-sm text-text-muted">
          {reserva.titular} · debe {formatearPrecio(reserva.saldoPendiente)}
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-text">
            {error}
          </p>
        )}

        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="monto" className="mb-1.5 block text-sm font-medium text-text">Monto recibido</label>
            <input id="monto" type="number" inputMode="numeric" min={0} max={reserva.saldoPendiente}
              value={monto} onChange={e => setMonto(Number(e.target.value))} className={campo} />
            <p className="mt-1 text-xs text-text-dim">Dejalo como está si cobraste todo el saldo.</p>
          </div>

          <div>
            <label htmlFor="metodo" className="mb-1.5 block text-sm font-medium text-text">Método</label>
            <select id="metodo" value={metodo} onChange={e => setMetodo(e.target.value)} className={campo}>
              {METODOS_DE_MOSTRADOR.map(metodoDisponible => (
                <option key={metodoDisponible.valor} value={metodoDisponible.valor}>
                  {metodoDisponible.label}
                </option>
              ))}
            </select>
          </div>

          {pideEntidad && (
            <div>
              <label htmlFor="entidad" className="mb-1.5 block text-sm font-medium text-text">Entidad o banco</label>
              <input id="entidad" type="text" value={entidad} onChange={e => setEntidad(e.target.value)}
                placeholder="Nequi, Daviplata, Bancolombia, Davivienda…" className={campo} />
            </div>
          )}
        </div>

        {ofreceCerrar && (
          <div className="mt-4 rounded-xl border border-border bg-surface p-3">
            <label htmlFor="ya-termino" className="flex items-start gap-2.5 text-sm text-text">
              <input id="ya-termino" type="checkbox" checked={yaTermino}
                onChange={e => setYaTermino(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-grass" />
              <span>
                Ya terminó el partido
                <span className="mt-0.5 block text-xs text-text-dim">
                  Lo marca como jugado además de registrar el cobro.
                </span>
              </span>
            </label>

            {yaTermino && saldoQueQueda > 0 && (
              <p className="mt-2 text-xs text-warning">
                Queda jugado y debiendo {formatearPrecio(saldoQueQueda)}. Esa deuda sigue en
                cuentas por cobrar y le bloquea reservar.
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <button onClick={onCerrar} type="button"
            className="min-h-11 flex-1 rounded-xl border border-border px-4 text-sm font-medium text-text-muted hover:bg-surface-hover">
            Cancelar
          </button>
          <button onClick={registrar} type="button" disabled={enviando}
            className="min-h-11 flex-1 rounded-xl bg-grass px-4 text-sm font-semibold text-white hover:bg-grass-light disabled:opacity-60">
            {enviando ? "Registrando…" : "Registrar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}
