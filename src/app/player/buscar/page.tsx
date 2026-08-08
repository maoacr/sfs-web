"use client";

import { useEffect, useState } from "react";
import { sileo } from "sileo";
import { formatAddress } from "@/lib/address";

interface Slot { inicio: string; fin: string; disponible: boolean }
interface CanchaSlot { id: string; nombre: string; tipo: string; capacidad: number; descripcion: string | null; servicios: string[]; duracionSlotMinutos: number; precioBase: number | null; imagen: string | null; slots: Slot[] }
interface ComplejoSlot { id: string; nombre: string; direccion: string; telefono: string | null; canchas: CanchaSlot[] }

const TIPOS = ["F5", "F6", "F7", "F8", "F9", "F11"];

export default function PlayerBuscar() {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [tipo, setTipo] = useState("");
  const [complejos, setComplejos] = useState<ComplejoSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<string | null>(null);
  const [selectedCancha, setSelectedCancha] = useState<CanchaSlot & { complejoNombre: string; complejoDireccion: string } | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      if (!active) return;
      const params = new URLSearchParams({ fecha });
      if (tipo) params.set("tipo", tipo);
      fetch(`/api/disponibilidad?${params}`)
        .then(r => r.json()).then(canchas => {
          if (!active) return;
          const byComplejo: Record<string, ComplejoSlot> = {};
          canchas.forEach((c: any) => {
            if (!byComplejo[c.complejo.id]) {
              byComplejo[c.complejo.id] = {
                id: c.complejo.id, nombre: c.complejo.nombre,
                direccion: formatAddress(c.complejo), telefono: c.complejo.telefono, canchas: [],
              };
            }
            byComplejo[c.complejo.id].canchas.push(c);
          });
          setComplejos(Object.values(byComplejo));
        })
        .catch(() => {})
        .finally(() => { if (active) setLoading(false); });
    };
    setLoading(true);
    load();
    const interval = setInterval(load, 10000);
    return () => { active = false; clearInterval(interval); };
  }, [fecha, tipo]);

  async function reservar(canchaId: string, slot: Slot) {
    setBooking(slot.inicio);
    try {
      const res = await fetch("/api/reservas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canchaId, slotInicio: slot.inicio, slotFin: slot.fin }),
      });
      if (!res.ok) {
        const d = await res.json();
        if (res.status === 409) throw new Error("Este slot ya fue reservado.");
        throw new Error(d.error || "Error");
      }
      sileo.success({ title: "¡Reserva creada!", description: "Podés verla en Mis reservas." });
      setSelectedCancha(null);
      // Refrescar disponibilidad
      const params = new URLSearchParams({ fecha });
      if (tipo) params.set("tipo", tipo);
      fetch(`/api/disponibilidad?${params}`).then(r => r.json()).then(canchas => {
        const byComplejo: Record<string, ComplejoSlot> = {};
        canchas.forEach((c: any) => {
          if (!byComplejo[c.complejo.id]) {
            byComplejo[c.complejo.id] = {
              id: c.complejo.id, nombre: c.complejo.nombre,
              direccion: c.complejo.direccion, telefono: c.complejo.telefono, canchas: [],
            };
          }
          byComplejo[c.complejo.id].canchas.push(c);
        });
        setComplejos(Object.values(byComplejo));
      });
    } catch (err) {
      sileo.error({ title: "Error al reservar", description: err instanceof Error ? err.message : "Error" });
    } finally { setBooking(null); }
  }

  const fH = (iso: string) => new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  const fP = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
  const fechaLarga = (f: string) => new Date(f + "T00:00:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-text">Buscar canchas</h1>
        <p className="mt-1 text-sm text-text-muted">{fechaLarga(fecha)}</p>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6">
        <div className="flex-1">
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text focus:border-grass focus:ring-1 focus:ring-grass" />
        </div>
        <div className="w-28">
          <select value={tipo} onChange={e => setTipo(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm text-text focus:border-grass focus:ring-1 focus:ring-grass">
            <option value="">Todos</option>
            {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Complejos y canchas */}
      {loading ? (
        <div className="space-y-4">
          {[1,2].map(i => (
            <div key={i} className="rounded-2xl border border-border bg-surface p-4">
              <div className="h-6 w-48 animate-pulse rounded bg-surface-hover mb-3" />
              <div className="flex gap-3 overflow-hidden">
                {[1,2,3].map(j => <div key={j} className="h-28 w-40 animate-pulse rounded-xl bg-surface-hover flex-shrink-0" />)}
              </div>
            </div>
          ))}
        </div>
      ) : complejos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
          <p className="text-text-muted text-base">No hay canchas disponibles para esta fecha.</p>
          <p className="text-sm text-text-dim mt-1">Probá con otra fecha o tipo de cancha.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {complejos.map(comp => {
            const totalLibres = comp.canchas.reduce((acc, c) => acc + c.slots.filter(s => s.disponible).length, 0);
            return (
              <div key={comp.id} className="rounded-2xl border border-border bg-surface overflow-hidden shadow-sm">
                {/* Complejo header */}
                <div className="px-4 pt-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-text text-base truncate">{comp.nombre}</h3>
                      <p className="text-xs text-text-dim mt-0.5 truncate">{comp.direccion}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-dim flex-shrink-0 pt-0.5">
                      <span>{comp.canchas.length} cancha{comp.canchas.length !== 1 ? "s" : ""}</span>
                      <span className="text-grass-light font-medium">{totalLibres} libre{totalLibres !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                </div>

                {/* Cancha preview cards: horizontal scroll */}
                <div className="flex gap-3 overflow-x-auto px-4 pb-4 scrollbar-thin snap-x snap-mandatory">
                  {comp.canchas.map(cancha => {
                    const libres = cancha.slots.filter(s => s.disponible).length;
                    const proximoSlot = cancha.slots.find(s => s.disponible);
                    return (
                      <button key={cancha.id}
                        onClick={() => setSelectedCancha({ ...cancha, complejoNombre: comp.nombre, complejoDireccion: comp.direccion })}
                        className="flex-shrink-0 w-[160px] rounded-xl border border-border bg-bg hover:border-grass/40 hover:shadow-sm transition-all text-left snap-start overflow-hidden group">
                        {/* Imagen */}
                        <div className="h-24 bg-surface-hover relative">
                          {cancha.imagen ? (
                            <img src={cancha.imagen} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-3xl">⚽</div>
                          )}
                          {/* Tipo badge */}
                          <span className="absolute top-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-bold text-white">
                            {cancha.tipo}
                          </span>
                          {/* Precio badge */}
                          {cancha.precioBase && (
                            <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-bold text-white">
                              {fP(cancha.precioBase)}
                            </span>
                          )}
                        </div>
                        {/* Info */}
                        <div className="p-2.5">
                          <p className="text-sm font-semibold text-text truncate">{cancha.nombre}</p>
                          <p className="text-xs text-text-dim mt-0.5">{cancha.capacidad} jug · {cancha.duracionSlotMinutos}min</p>
                          {libres > 0 ? (
                            <p className="text-xs text-grass-light font-medium mt-1.5">{libres} horario{libres !== 1 ? "s" : ""} libre{libres !== 1 ? "s" : ""}</p>
                          ) : (
                            <p className="text-xs text-text-dim mt-1.5">Sin horarios</p>
                          )}
                          {proximoSlot && (
                            <p className="text-[11px] text-text-dim mt-0.5 truncate">Próx: {fH(proximoSlot.inicio)}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancha detail: bottom sheet (mobile) / modal (desktop) */}
      {selectedCancha && (
        <CanchaDetailSheet
          cancha={selectedCancha}
          complejoNombre={selectedCancha.complejoNombre}
          complejoDireccion={selectedCancha.complejoDireccion}
          fH={fH}
          fP={fP}
          booking={booking}
          onReservar={reservar}
          onClose={() => setSelectedCancha(null)}
        />
      )}
    </div>
  );
}

// ─── Cancha Detail Bottom Sheet ─────────────────────────────────────────────

function CanchaDetailSheet({ cancha, complejoNombre, complejoDireccion, fH, fP, booking, onReservar, onClose }: {
  cancha: CanchaSlot;
  complejoNombre: string;
  complejoDireccion: string;
  fH: (iso: string) => string;
  fP: (n: number) => string;
  booking: string | null;
  onReservar: (canchaId: string, slot: Slot) => void;
  onClose: () => void;
}) {
  const slotsLibres = cancha.slots.filter(s => s.disponible);

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center" onClick={onClose}>
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Sheet */}
      <div onClick={e => e.stopPropagation()}
        className="relative w-full lg:max-w-lg max-h-[85vh] lg:max-h-[80vh] overflow-y-auto rounded-t-3xl lg:rounded-3xl border border-border bg-surface shadow-2xl animate-slide-up">
        
        {/* Handle bar (mobile) */}
        <div className="lg:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Hero image */}
        <div className="relative h-48 lg:h-56 bg-surface-hover rounded-t-3xl lg:rounded-t-3xl overflow-hidden">
          {cancha.imagen ? (
            <img src={cancha.imagen} alt={cancha.nombre} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-5xl">⚽</div>
          )}
          {/* Close button */}
          <button onClick={onClose}
            className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center text-sm hover:bg-black/70 transition-colors">
            ✕
          </button>
          {/* Tipo + Precio overlay */}
          <div className="absolute bottom-3 left-3 flex gap-2">
            <span className="rounded-lg bg-black/60 px-2.5 py-1 text-xs font-bold text-white">{cancha.tipo}</span>
            {cancha.precioBase && (
              <span className="rounded-lg bg-black/60 px-2.5 py-1 text-xs font-bold text-grass-light">{fP(cancha.precioBase)}</span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Name + complex */}
          <div className="mb-4">
            <h2 className="text-xl font-bold text-text">{cancha.nombre}</h2>
            <p className="text-sm text-text-dim mt-0.5">{complejoNombre} · {complejoDireccion}</p>
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs text-text-dim">
              <span className="font-medium text-text">{cancha.capacidad}</span> jugadores
            </span>
            <span className="text-text-dim">·</span>
            <span className="text-xs text-text-dim">
              <span className="font-medium text-text">{cancha.duracionSlotMinutos} min</span> por slot
            </span>
          </div>

          {/* Description */}
          {cancha.descripcion && (
            <p className="text-sm text-text-muted mb-4 leading-relaxed">{cancha.descripcion}</p>
          )}

          {/* Services */}
          {cancha.servicios.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {cancha.servicios.map(s => (
                <span key={s} className="inline-flex items-center gap-1 rounded-lg bg-field/20 px-2.5 py-1.5 text-xs text-grass-light border border-grass/10">
                  {SERVICIO_ICONS[s] || "•"} {SERVICIO_LABELS[s] || s}
                </span>
              ))}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-border my-4" />

          {/* Slots */}
          <div>
            <p className="text-sm font-semibold text-text mb-3">
              {slotsLibres.length > 0
                ? `${slotsLibres.length} horario${slotsLibres.length !== 1 ? "s" : ""} disponible${slotsLibres.length !== 1 ? "s" : ""}`
                : "Sin horarios disponibles"}
            </p>
            {slotsLibres.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {slotsLibres.map(slot => (
                  <button key={slot.inicio} disabled={booking === slot.inicio}
                    onClick={() => onReservar(cancha.id, slot)}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-150 text-center ${
                      "border-grass/40 text-grass-light hover:bg-field hover:border-grass active:scale-[0.97]"
                    } ${booking === slot.inicio ? "opacity-60" : ""}`}>
                    {fH(slot.inicio)} – {fH(slot.fin)}
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-bg p-6 text-center">
                <p className="text-sm text-text-dim">Todos los horarios están ocupados para esta fecha.</p>
                <p className="text-xs text-text-dim mt-1">Probá con otra fecha.</p>
              </div>
            )}
          </div>

          {/* Non-available slots (collapsed) */}
          {cancha.slots.filter(s => !s.disponible).length > 0 && (
            <p className="text-xs text-text-dim mt-3 text-center">
              +{cancha.slots.filter(s => !s.disponible).length} horario{cancha.slots.filter(s => !s.disponible).length !== 1 ? "s" : ""} ocupado{cancha.slots.filter(s => !s.disponible).length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const SERVICIO_LABELS: Record<string, string> = {
  vestidores: "Vestidores",
  cafeteria: "Cafetería",
  parqueadero: "Parqueadero",
  iluminacion: "Iluminación",
  grama_sintetica: "Grama sintética",
  techada: "Techada",
};

const SERVICIO_ICONS: Record<string, string> = {
  vestidores: "🚿",
  cafeteria: "☕",
  parqueadero: "🅿️",
  iluminacion: "💡",
  grama_sintetica: "🟢",
  techada: "🏠",
};
