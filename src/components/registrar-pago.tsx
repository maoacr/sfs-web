"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { METODOS_DE_MOSTRADOR, requiereEntidad } from "@/lib/metodos-de-mostrador";

export interface ReservaACobrar {
  id: string;
  saldoPendiente: number;
  titular: string;
}

const fPrecio = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

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

  const pideEntidad = requiereEntidad(metodo);

  async function registrar() {
    setError(null);

    // Se valida acá para no hacer un viaje al servidor por un error obvio,
    // pero el servidor valida igual: esto es comodidad, no seguridad.
    if (!(monto > 0)) {
      return setError("El monto tiene que ser mayor a cero.");
    }
    if (monto > reserva.saldoPendiente) {
      return setError(`No podés cobrar más que el saldo pendiente (${fPrecio(reserva.saldoPendiente)}).`);
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
    onRegistrado();
  }

  const campo = "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div role="dialog" aria-labelledby="titulo-cobro"
        className="w-full max-w-md rounded-t-2xl border border-border bg-bg p-5 sm:rounded-2xl">
        <h2 id="titulo-cobro" className="text-lg font-bold text-text">Registrar pago</h2>
        <p className="mt-1 text-sm text-text-muted">
          {reserva.titular} · debe {fPrecio(reserva.saldoPendiente)}
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
