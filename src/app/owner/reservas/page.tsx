"use client";

import { useEffect, useState } from "react";

interface Reserva {
  id: string; cancha: { nombre: string; tipo: string; complejo: { nombre: string } };
  player: { primerNombre: string; apellidos: string; apodo: string | null; telefono: string | null };
  slotInicio: string; slotFin: string; montoTotal: number; estado: string;
}

const ESTADOS: Record<string, { label: string; color: string }> = {
  PENDIENTE_PAGO: { label: "Pendiente", color: "bg-warning/20 text-warning" },
  CONFIRMADA: { label: "Confirmada", color: "bg-grass/20 text-grass-light" },
  COMPLETADA: { label: "Completada", color: "bg-text-dim/20 text-text-dim" },
  CANCELADA: { label: "Cancelada", color: "bg-error/20 text-error" },
};

interface Filter { complejoId: string; canchaId: string }
interface ComplejoOpt { id: string; nombre: string; canchas: { id: string; nombre: string }[] }

export default function OwnerReservas() {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [complejos, setComplejos] = useState<ComplejoOpt[]>([]);
  const [filter, setFilter] = useState<Filter>({ complejoId: "", canchaId: "" });

  useEffect(() => {
    fetch("/api/complejos").then(r => r.json()).then(data => setComplejos(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reservas?fecha=${fecha}`)
      .then(r => r.json()).then(data => setReservas(Array.isArray(data) ? data : []))
      .catch(() => setReservas([]))
      .finally(() => setLoading(false));
  }, [fecha]);

  async function cambiarEstado(id: string, estado: string) {
    await fetch(`/api/reservas/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado }),
    });
    setReservas(prev => prev.map(r => r.id === id ? { ...r, estado } : r));
  }

  const filtered = reservas.filter(r => {
    if (filter.complejoId && r.cancha.complejo.nombre !== complejos.find(c => c.id === filter.complejoId)?.nombre) return false;
    if (filter.canchaId && r.cancha.nombre !== complejos.find(c => c.id === filter.complejoId)?.canchas.find(ch => ch.id === filter.canchaId)?.nombre) return false;
    return true;
  });

  const fH = (iso: string) => new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  const fP = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
  const s = "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text";

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
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={s} />
        <select value={filter.complejoId} onChange={e => { setFilter({ complejoId: e.target.value, canchaId: "" }); }} className={s}>
          <option value="">Todos los complejos</option>
          {complejos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        {filter.complejoId && (
          <select value={filter.canchaId} onChange={e => setFilter(prev => ({ ...prev, canchaId: e.target.value }))} className={s}>
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
                  <p className="text-base font-bold text-text">{fH(r.slotInicio)}</p>
                  <p className="text-[10px] text-text-dim">{fH(r.slotFin)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-text">{r.cancha.nombre} <span className="text-xs text-text-dim font-normal">({r.cancha.tipo})</span></p>
                  <p className="text-xs text-text-muted">
                    {r.player.primerNombre} {r.player.apellidos}
                    {r.player.telefono && <span className="ml-1 text-text-dim">📞 {r.player.telefono}</span>}
                  </p>
                  <p className="text-[10px] text-text-dim">{r.cancha.complejo.nombre} · {fP(Number(r.montoTotal))}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ESTADOS[r.estado]?.color}`}>{ESTADOS[r.estado]?.label}</span>
                {r.estado === "CONFIRMADA" && (
                  <>
                    <button onClick={() => cambiarEstado(r.id, "COMPLETADA")} className="text-[10px] text-text-dim hover:text-grass">✓</button>
                    <button onClick={() => cambiarEstado(r.id, "CANCELADA")} className="text-[10px] text-text-dim hover:text-error">✕</button>
                  </>
                )}
                {r.estado === "PENDIENTE_PAGO" && (
                  <button onClick={() => cambiarEstado(r.id, "CANCELADA")} className="text-[10px] text-text-dim hover:text-error">Cancelar</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showNew && <NewReservaModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); setFecha(fecha); }} />}
    </div>
  );
}

function NewReservaModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [canchas, setCanchas] = useState<any[]>([]);
  const [canchaId, setCanchaId] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [hora, setHora] = useState("18:00");
  const [playerNombre, setPlayerNombre] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { fetch("/api/canchas?activas=true").then(r => r.json()).then(setCanchas); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    const cancha = canchas.find(c => c.id === canchaId);
    const dur = cancha?.duracionSlotMinutos || 60;
    const inicio = new Date(fecha + "T" + hora + ":00");
    const fin = new Date(inicio.getTime() + dur * 60000);
    try {
      const res = await fetch("/api/reservas", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canchaId, slotInicio: inicio.toISOString(), slotFin: fin.toISOString(), playerNombre }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
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
            <label className="block text-sm font-medium text-text">Cancha</label>
            <select value={canchaId} onChange={e => setCanchaId(e.target.value)} required className={i}>
              <option value="">Seleccionar...</option>
              {canchas.map((c: any) => <option key={c.id} value={c.id}>{c.nombre} ({c.tipo})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-text">Fecha</label><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required className={i} /></div>
            <div><label className="block text-sm font-medium text-text">Hora</label><input type="time" value={hora} onChange={e => setHora(e.target.value)} required className={i} /></div>
          </div>
          <div><label className="block text-sm font-medium text-text">Cliente</label><input type="text" value={playerNombre} onChange={e => setPlayerNombre(e.target.value)} required className={i} placeholder="Nombre" /></div>
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
