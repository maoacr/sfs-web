"use client";

import { useEffect, useState } from "react";
import { fechaHoy, formatearHora } from "@/lib/zona-horaria";
import { apiFetch } from "@/lib/api-client";
import { RegistrarPago, type ReservaACobrar } from "@/components/registrar-pago";

interface Reserva {
  id: string; cancha: { nombre: string; tipo: string; complejo: { nombre: string; zonaHoraria: string } };
  player: { primerNombre: string; apellidos: string; apodo: string | null; telefono: string | null };
  slotInicio: string; slotFin: string; montoTotal: number; montoPagado: number; saldoPendiente: number; estado: string;
}

const ESTADOS: Record<string, { label: string; color: string }> = {
  PENDIENTE_PAGO: { label: "Pendiente", color: "bg-warning/20 text-warning" },
  PAGO_PARCIAL: { label: "Pago parcial", color: "bg-warning/20 text-warning" },
  CONFIRMADA: { label: "Confirmada", color: "bg-grass/20 text-grass-light" },
  COMPLETADA: { label: "Completada", color: "bg-text-dim/20 text-text-dim" },
  CANCELADA: { label: "Cancelada", color: "bg-error/20 text-error" },
  EXPIRADA: { label: "Expirada", color: "bg-text-dim/20 text-text-dim" },
};

/** Sobre una reserva muerta no se cobra ni se actúa. */
const MUERTAS = new Set(["CANCELADA", "EXPIRADA"]);

const nombreDe = (p: Reserva["player"]) => `${p.primerNombre} ${p.apellidos}`.trim();

interface Filter { complejoId: string; canchaId: string }
interface ComplejoOpt { id: string; nombre: string; canchas: { id: string; nombre: string }[] }

export default function OwnerReservas() {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [fecha, setFecha] = useState(() => fechaHoy());
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [complejos, setComplejos] = useState<ComplejoOpt[]>([]);
  const [filter, setFilter] = useState<Filter>({ complejoId: "", canchaId: "" });
  const [recargas, setRecargas] = useState(0);
  const [cobrando, setCobrando] = useState<ReservaACobrar | null>(null);
  const [cancelando, setCancelando] = useState<Reserva | null>(null);

  useEffect(() => {
    fetch("/api/complejos").then(r => r.json()).then(data => setComplejos(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    // Sin `setLoading(true)` acá: setear estado de forma síncrona en el cuerpo
    // de un efecto encadena renders. El esqueleto se muestra por el valor
    // inicial, y al recargar la lista se reemplaza sin parpadeo.
    fetch(`/api/reservas?fecha=${fecha}`)
      .then(r => r.json()).then(data => setReservas(Array.isArray(data) ? data : []))
      .catch(() => setReservas([]))
      .finally(() => setLoading(false));
  }, [fecha, recargas]);

  async function cambiarEstado(id: string, estado: string) {
    await apiFetch(`/api/reservas/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado }),
    });
    setReservas(prev => prev.map(r => r.id === id ? { ...r, estado } : r));
  }

  const filtered = reservas.filter(r => {
    if (filter.complejoId && r.cancha.complejo.nombre !== complejos.find(c => c.id === filter.complejoId)?.nombre) return false;
    if (filter.canchaId && r.cancha.nombre !== complejos.find(c => c.id === filter.complejoId)?.canchas.find(ch => ch.id === filter.canchaId)?.nombre) return false;
    return true;
  });

  const formatearPrecio = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
  const claseControl = "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text";

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Reservas</h1>
          <p className="text-sm text-text-muted">Gestioná las reservas de tus canchas</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="rounded-lg bg-grass px-3 py-2 text-sm font-semibold text-white hover:bg-grass-light">+ Nueva</button>
      </div>

      {/* Filtros */}
      <div className="mt-4 flex flex-wrap gap-2">
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={claseControl} />
        <select value={filter.complejoId} onChange={e => { setFilter({ complejoId: e.target.value, canchaId: "" }); }} className={claseControl}>
          <option value="">Todos los complejos</option>
          {complejos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        {filter.complejoId && (
          <select value={filter.canchaId} onChange={e => setFilter(prev => ({ ...prev, canchaId: e.target.value }))} className={claseControl}>
            <option value="">Todas las canchas</option>
            {complejos.find(c => c.id === filter.complejoId)?.canchas.map(ch => <option key={ch.id} value={ch.id}>{ch.nombre}</option>)}
          </select>
        )}
      </div>

      {/* Lista */}
      <div className="mt-4 space-y-2">
        {loading ? (
          [1,2,3].map(i => <div key={i} className="h-16 animate-pulse rounded-lg bg-surface border border-border" />)
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
            <p className="text-text-muted">No hay reservas para estos filtros.</p>
          </div>
        ) : (
          filtered.map(r => (
            <div key={r.id} className="rounded-lg border border-border bg-surface p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="text-center min-w-[55px]">
                  <p className="text-base font-bold text-text">{formatearHora(r.slotInicio, r.cancha.complejo.zonaHoraria)}</p>
                  <p className="text-[10px] text-text-dim">{formatearHora(r.slotFin, r.cancha.complejo.zonaHoraria)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-text">{r.cancha.nombre} <span className="text-xs text-text-dim font-normal">({r.cancha.tipo})</span></p>
                  <p className="text-xs text-text-muted">
                    {r.player.primerNombre} {r.player.apellidos}
                    {r.player.telefono && <span className="ml-1 text-text-dim">📞 {r.player.telefono}</span>}
                  </p>
                  <p className="text-[10px] text-text-dim">{r.cancha.complejo.nombre} · {formatearPrecio(Number(r.montoTotal))}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ESTADOS[r.estado]?.color}`}>{ESTADOS[r.estado]?.label}</span>
                {!MUERTAS.has(r.estado) && r.estado !== "COMPLETADA" && (
                  <button onClick={() => cambiarEstado(r.id, "COMPLETADA")}
                    aria-label={`Marcar como jugada la reserva de ${nombreDe(r.player)}`}
                    className="rounded-lg border border-border px-2 py-1 text-[10px] text-text-muted hover:border-grass hover:text-grass">
                    Marcar jugada
                  </button>
                )}
                {!MUERTAS.has(r.estado) && (
                  <button onClick={() => setCancelando(r)}
                    aria-label={`Cancelar la reserva de ${nombreDe(r.player)}`}
                    className="rounded-lg border border-border px-2 py-1 text-[10px] text-text-muted hover:border-error hover:text-error">
                    Cancelar
                  </button>
                )}
                {Number(r.saldoPendiente) > 0 && !MUERTAS.has(r.estado) && (
                  <button
                    onClick={() => setCobrando({
                      id: r.id,
                      saldoPendiente: Number(r.saldoPendiente),
                      titular: `${r.player.primerNombre} ${r.player.apellidos}`.trim(),
                    })}
                    className="rounded-lg bg-grass px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-grass-light">
                    Cobrar {formatearPrecio(Number(r.saldoPendiente))}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showNew && <NewReservaModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); setRecargas(n => n + 1); }} />}

      {cancelando && (
        <ConfirmarCancelacion
          reserva={cancelando}
          onCerrar={() => setCancelando(null)}
          onConfirmar={() => { const id = cancelando.id; setCancelando(null); cambiarEstado(id, "CANCELADA"); }}
        />
      )}

      {cobrando && (
        <RegistrarPago
          reserva={cobrando}
          onCerrar={() => setCobrando(null)}
          onRegistrado={() => { setCobrando(null); setRecargas(n => n + 1); }}
        />
      )}
    </div>
  );
}

/**
 * Cancelar no es "sacar de la lista": dispara la política de reembolso del
 * complejo y le devuelve plata al jugador. Antes era una `✕` de diez píxeles
 * sin etiqueta ni confirmación, al lado de un `✓` que hacía algo
 * completamente distinto.
 */
function ConfirmarCancelacion({ reserva, onCerrar, onConfirmar }: {
  reserva: Reserva; onCerrar: () => void; onConfirmar: () => void;
}) {
  const pagado = Number(reserva.montoPagado ?? 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <div role="dialog" aria-labelledby="titulo-cancelar"
        className="w-full max-w-md rounded-t-2xl border border-border bg-bg p-5 sm:rounded-2xl">
        <h2 id="titulo-cancelar" className="text-lg font-bold text-text">¿Cancelar esta reserva?</h2>
        <p className="mt-2 text-sm text-text-muted">
          {reserva.cancha.nombre} · {nombreDe(reserva.player)} ·{" "}
          {formatearHora(reserva.slotInicio, reserva.cancha.complejo.zonaHoraria)}
        </p>

        {pagado > 0 && (
          <p className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-text">
            Ya pagó {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(pagado)}.
            Al cancelar se le aplica la política de reembolso del complejo.
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

interface CanchaOpt { id: string; nombre: string; tipo: string }
interface ClienteOpt { id: string; primerNombre: string; apellidos: string; telefono: string | null }

function NewReservaModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [canchas, setCanchas] = useState<CanchaOpt[]>([]);
  const [canchaId, setCanchaId] = useState("");
  const [fecha, setFecha] = useState(() => fechaHoy());
  const [hora, setHora] = useState("18:00");
  const [clienteTexto, setClienteTexto] = useState("");
  const [sugerencias, setSugerencias] = useState<ClienteOpt[]>([]);
  const [elegido, setElegido] = useState<ClienteOpt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { fetch("/api/canchas?activas=true")
      .then(r => r.json())
      .then((data: CanchaOpt[]) => setCanchas(Array.isArray(data) ? data : [])); }, []);

  // Se busca con una pausa para no disparar una consulta por tecla. Todo el
  // setState vive dentro del timeout a propósito: hacerlo en el cuerpo del
  // efecto encadena renders.
  useEffect(() => {
    const consulta = elegido ? "" : clienteTexto.trim();
    const id = setTimeout(() => {
      if (consulta.length < 2) return setSugerencias([]);
      fetch(`/api/clientes?q=${encodeURIComponent(consulta)}`)
        .then(r => r.json())
        .then((data: ClienteOpt[]) => setSugerencias(Array.isArray(data) ? data : []))
        .catch(() => setSugerencias([]));
    }, 250);
    return () => clearTimeout(id);
  }, [clienteTexto, elegido]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    try {
      // fecha y hora son locales de la cancha; el servidor calcula el instante y la duración
      const res = await apiFetch("/api/reservas", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canchaId, fecha, hora,
          // Con cliente elegido la reserva queda vinculada a su cuenta y la ve
          // en su app. Sin elegir, se anota el nombre y no se bloquea nada.
          ...(elegido ? { playerId: elegido.id } : { invitadoNombre: clienteTexto.trim() }),
        }) });
      if (!res.ok) { const errorBody = await res.json(); throw new Error(errorBody.error); }
      onCreated();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setLoading(false); }
  }

  const i = "mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-text">Nueva reserva manual</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="cancha" className="block text-sm font-medium text-text">Cancha</label>
            <select id="cancha" value={canchaId} onChange={e => setCanchaId(e.target.value)} required className={i}>
              <option value="">Seleccionar...</option>
              {canchas.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.tipo})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="fecha-reserva" className="block text-sm font-medium text-text">Fecha</label><input id="fecha-reserva" type="date" value={fecha} onChange={e => setFecha(e.target.value)} required className={i} /></div>
            <div><label htmlFor="hora-reserva" className="block text-sm font-medium text-text">Hora</label><input id="hora-reserva" type="time" value={hora} onChange={e => setHora(e.target.value)} required className={i} /></div>
          </div>
          <div className="relative">
            <label htmlFor="cliente" className="block text-sm font-medium text-text">Cliente</label>
            <input id="cliente" type="text" required className={i} autoComplete="off"
              placeholder="Buscá por nombre…"
              value={elegido ? `${elegido.primerNombre} ${elegido.apellidos}`.trim() : clienteTexto}
              onChange={e => { setElegido(null); setClienteTexto(e.target.value); }} />

            {sugerencias.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-surface shadow-xl">
                {sugerencias.map(c => (
                  <li key={c.id}>
                    <button type="button"
                      onClick={() => { setElegido(c); setSugerencias([]); }}
                      className="block w-full px-3 py-2 text-left text-sm text-text hover:bg-surface-hover">
                      {c.primerNombre} {c.apellidos}
                      {c.telefono && <span className="ml-2 text-xs text-text-dim">{c.telefono}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {elegido ? (
              <p className="mt-1 text-xs text-grass">Queda vinculada a su cuenta: la va a ver en su app.</p>
            ) : clienteTexto.trim().length >= 2 ? (
              <p className="mt-1 text-xs text-warning">
                No está registrado. La reserva se crea igual y queda anotada a su nombre.
              </p>
            ) : null}
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm text-text-muted hover:bg-surface-hover">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-grass px-4 py-2.5 text-sm font-semibold text-white hover:bg-grass-light disabled:opacity-50">{loading ? "Creando..." : "Crear"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
