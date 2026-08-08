"use client";

import { useEffect, useState, useRef } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import { Pagination } from "swiper/modules";
import { sileo } from "sileo";
import { formatAddress } from "@/lib/address";
import "swiper/css";
import "swiper/css/pagination";

interface Slot { inicio: string; fin: string; disponible: boolean }
interface CanchaSlot { id: string; nombre: string; tipo: string; capacidad: number; descripcion: string | null; servicios: string[]; duracionSlotMinutos: number; precioBase: number | null; imagen: string | null; slots: Slot[] }
interface ComplejoSlot { id: string; nombre: string; direccion: string; telefono: string | null; lat: number | null; lng: number | null; canchas: CanchaSlot[] }

const TIPOS = ["F5", "F6", "F7", "F8", "F9", "F11"];

export default function PlayerBuscar() {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [tipo, setTipo] = useState("");
  const [complejos, setComplejos] = useState<ComplejoSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<string | null>(null);
  const [selectedCancha, setSelectedCancha] = useState<CanchaSlot & { complejoNombre: string; complejoDireccion: string; complejoLat: number | null; complejoLng: number | null } | null>(null);
  const [activeComplejo, setActiveComplejo] = useState(0);
  const verticalRef = useRef<SwiperType | null>(null);

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
          (Array.isArray(canchas) ? canchas : []).forEach((c: any) => {
            if (!byComplejo[c.complejo.id]) {
              byComplejo[c.complejo.id] = {
                id: c.complejo.id, nombre: c.complejo.nombre,
                direccion: formatAddress(c.complejo), telefono: c.complejo.telefono,
                lat: c.complejo.lat ?? null, lng: c.complejo.lng ?? null, canchas: [],
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
    } catch (err) {
      sileo.error({ title: "Error al reservar", description: err instanceof Error ? err.message : "Error" });
    } finally { setBooking(null); }
  }

  const fH = (iso: string) => new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  const fP = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
  const fechaLarga = (f: string) => new Date(f + "T00:00:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)]">
      {/* Floating filters */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2 flex gap-2 z-20 bg-gradient-to-b from-bg via-bg">
        <h1 className="text-lg font-bold text-text self-center mr-1 whitespace-nowrap">{fechaLarga(fecha)}</h1>
        <div className="flex-1">
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text focus:border-grass focus:ring-1 focus:ring-grass" />
        </div>
        <select value={tipo} onChange={e => setTipo(e.target.value)}
          className="w-20 rounded-xl border border-border bg-surface px-2 py-2.5 text-sm text-text focus:border-grass focus:ring-1 focus:ring-grass">
          <option value="">Todos</option>
          {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Progress bar */}
      {complejos.length > 1 && (
        <div className="flex-shrink-0 flex gap-1 px-4 pb-2">
          {complejos.map((c, i) => (
            <button key={c.id} onClick={() => verticalRef.current?.slideTo(i)}
              className={`h-1 flex-1 rounded-full transition-all ${i <= activeComplejo ? "bg-grass" : "bg-border"}`} />
          ))}
        </div>
      )}

      {/* Main vertical swiper */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="space-y-4 w-full max-w-sm px-4">
            <div className="h-64 animate-pulse rounded-2xl bg-surface" />
            <div className="h-6 w-48 animate-pulse rounded bg-surface-hover mx-auto" />
          </div>
        </div>
      ) : complejos.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <p className="text-text-muted text-base">No hay canchas disponibles.</p>
            <p className="text-sm text-text-dim mt-1">Probá con otra fecha o tipo de cancha.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Mobile: vertical Swiper (one complejo at a time) */}
          <Swiper
            direction="vertical"
            slidesPerView={1}
            spaceBetween={0}
            className="flex-1 w-full md:hidden"
            onSwiper={swiper => { verticalRef.current = swiper; }}
            onSlideChange={swiper => setActiveComplejo(swiper.activeIndex)}
            resistanceRatio={0.5}
            speed={400}
          >
            {complejos.map(comp => (
              <SwiperSlide key={comp.id} className="!flex !flex-col" style={{ height: "100%" }}>
                <ComplejoCard complejo={comp} fP={fP} onSelect={(c) => setSelectedCancha({...c, complejoNombre: comp.nombre, complejoDireccion: comp.direccion, complejoLat: comp.lat, complejoLng: comp.lng})} isMobile />
              </SwiperSlide>
            ))}
          </Swiper>

          {/* Tablet+: grid of complejos */}
          <div className="hidden md:block flex-1 overflow-y-auto px-4 pt-2 pb-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {complejos.map(comp => (
                <ComplejoCard key={comp.id} complejo={comp} fP={fP} onSelect={(c) => setSelectedCancha({...c, complejoNombre: comp.nombre, complejoDireccion: comp.direccion, complejoLat: comp.lat, complejoLng: comp.lng})} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Detail sheet */}
      {selectedCancha && (
        <CanchaDetailSheet
          cancha={selectedCancha} complejoNombre={selectedCancha.complejoNombre}
          complejoDireccion={selectedCancha.complejoDireccion}
          complejoLat={selectedCancha.complejoLat} complejoLng={selectedCancha.complejoLng}
          fH={fH} fP={fP} booking={booking}
          onReservar={reservar} onClose={() => setSelectedCancha(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ComplejoCard — used in mobile Swiper and tablet+ grid
   ═══════════════════════════════════════════════════════════════════════════ */

function ComplejoCard({ complejo, fP, onSelect, isMobile }: {
  complejo: ComplejoSlot;
  fP: (n: number) => string;
  onSelect: (cancha: CanchaSlot) => void;
  isMobile?: boolean;
}) {
  const count = complejo.canchas.length;
  const isCompact = count >= 4; // vertical layout for 4+

  return (
    <div className={`flex flex-col min-h-0 ${isMobile ? "flex-1 pb-4" : ""}`}>
      {/* Header */}
      <div className="px-4 pb-3 flex-shrink-0">
        <h2 className="text-base font-bold text-text">{complejo.nombre}</h2>
        {complejo.lat && complejo.lng ? (
          <a href={`https://www.google.com/maps?q=${complejo.lat},${complejo.lng}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-grass-light hover:underline mt-0.5">
            📍 {complejo.direccion}
          </a>
        ) : (
          <p className="text-xs text-text-dim mt-0.5">📍 {complejo.direccion}</p>
        )}
      </div>

      {/* Cancha cards */}
      <Swiper
        slidesPerView={isCompact ? "auto" : count <= 2 ? count : count}
        spaceBetween={12}
        centeredSlides={isCompact}
        className={`w-full px-4 min-h-0 ${!isMobile && !isCompact ? "h-48 sm:h-56" : ""} ${isCompact ? "!pb-8" : ""}`}
        style={isMobile && isCompact ? { flex: 1 } : {}}
        pagination={isCompact ? { clickable: true } : false}
        modules={[Pagination]}
        resistanceRatio={0.5}
      >
        {complejo.canchas.map(cancha => {
          const libres = cancha.slots.filter(s => s.disponible).length;
          return (
            <SwiperSlide key={cancha.id}
              style={isCompact && isMobile ? { width: "85vw", maxWidth: "24rem" } : !isCompact ? { height: "100%" } : undefined}
              className={`rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform border border-border ${isCompact ? "!flex !flex-col" : "!flex !flex-row"}`}
              onClick={() => onSelect(cancha)}>

              {isCompact ? (
                /* ─── 4+ canchas: vertical layout ─── */
                <div className="relative flex-1 min-h-0">
                  {cancha.imagen ? (
                    <img src={cancha.imagen} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 w-full h-full bg-surface-hover flex items-center justify-center text-5xl">⚽</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-bg/95 via-bg/40 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="rounded-md bg-grass/90 px-2 py-0.5 text-[11px] font-bold text-white">{cancha.tipo}</span>
                      {cancha.precioBase && <span className="rounded-md bg-black/50 px-2 py-0.5 text-[11px] font-bold text-grass-light">{fP(cancha.precioBase)}</span>}
                    </div>
                    <h3 className="font-bold text-white text-sm leading-tight">{cancha.nombre}</h3>
                    <p className="text-xs text-white/70 mt-0.5">{cancha.capacidad} jug · {cancha.duracionSlotMinutos}min</p>
                    <div className="mt-1.5">
                      {libres > 0 ? (
                        <span className="text-[11px] font-medium text-grass-light">{libres} libre{libres !== 1 ? "s" : ""}</span>
                      ) : (
                        <span className="text-[11px] text-white/50">Sin horarios</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* ─── 1-3 canchas: horizontal split layout ─── */
                <>
                  {/* Image — left side */}
                  <div className="w-[45%] sm:w-1/2 flex-shrink-0 bg-surface-hover relative">
                    {cancha.imagen ? (
                      <img src={cancha.imagen} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-4xl">⚽</div>
                    )}
                  </div>
                  {/* Data — right side */}
                  <div className="flex-1 flex flex-col justify-center p-4 bg-surface">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="rounded-md bg-grass/90 px-2 py-0.5 text-[11px] font-bold text-white">{cancha.tipo}</span>
                      {cancha.precioBase && <span className="text-[11px] font-bold text-grass-light">{fP(cancha.precioBase)}</span>}
                    </div>
                    <h3 className="font-bold text-text text-sm leading-tight">{cancha.nombre}</h3>
                    <p className="text-xs text-text-dim mt-1">{cancha.capacidad} jug · {cancha.duracionSlotMinutos}min</p>
                    <div className="mt-2">
                      {libres > 0 ? (
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-grass/15 px-2.5 py-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-grass-light" />
                          <span className="text-xs font-medium text-grass-light">{libres} libre{libres !== 1 ? "s" : ""}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-text-dim">Sin horarios</span>
                      )}
                    </div>
                  </div>
                </>
              )}
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Cancha Detail Sheet
   ═══════════════════════════════════════════════════════════════════════════ */

function CanchaDetailSheet({ cancha, complejoNombre, complejoDireccion, complejoLat, complejoLng, fH, fP, booking, onReservar, onClose }: {
  cancha: CanchaSlot; complejoNombre: string; complejoDireccion: string;
  complejoLat: number | null; complejoLng: number | null;
  fH: (iso: string) => string; fP: (n: number) => string;
  booking: string | null; onReservar: (canchaId: string, slot: Slot) => void; onClose: () => void;
}) {
  const slotsLibres = cancha.slots.filter(s => s.disponible);
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div onClick={e => e.stopPropagation()}
        className="relative w-full lg:max-w-6xl xl:max-w-7xl lg:h-[70vh] max-h-[85vh] lg:max-h-[70vh] overflow-hidden rounded-t-3xl lg:rounded-3xl shadow-2xl animate-slide-up">

        {/* Full-bleed image background (desktop) */}
        <div className="hidden lg:block absolute inset-0">
          {cancha.imagen ? (
            <img src={cancha.imagen} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-surface-hover flex items-center justify-center text-6xl">⚽</div>
          )}
          {/* Gradient overlays: dark at bottom, transparent at top */}
          <div className="absolute inset-0 bg-gradient-to-t from-bg/90 via-bg/30 to-transparent" />
          <div className="absolute inset-0 bg-black/25" />
        </div>

        {/* ─── Mobile: image + scrollable content ─── */}
        <div className="lg:hidden flex flex-col max-h-[85vh] overflow-y-auto">
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-border" />
          </div>
          <DetailImage cancha={cancha} fP={fP} onClose={onClose} />
          <DetailContent cancha={cancha} complejoNombre={complejoNombre} complejoDireccion={complejoDireccion}
            complejoLat={complejoLat} complejoLng={complejoLng} fH={fH} slotsLibres={slotsLibres}
            booking={booking} onReservar={onReservar} />
        </div>

        {/* ─── Desktop: full-bleed image + glass content overlay ─── */}
        <div className="hidden lg:flex flex-col justify-end h-full relative z-10">
          {/* Close button */}
          <button onClick={onClose} className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center text-lg hover:bg-white/20 transition-colors">✕</button>

          {/* Glass content panel at the bottom */}
          <div className="mx-6 mb-6 rounded-2xl bg-bg/60 backdrop-blur-xl border border-white/10 p-6 max-h-[60%] overflow-y-auto">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded-lg bg-grass/90 px-2.5 py-1 text-xs font-bold text-white">{cancha.tipo}</span>
                {cancha.precioBase && <span className="rounded-lg bg-white/10 backdrop-blur px-2.5 py-1 text-xs font-bold text-grass-light">{fP(cancha.precioBase)}</span>}
              </div>
              <h2 className="text-2xl font-bold text-white">{cancha.nombre}</h2>
              {complejoLat && complejoLng ? (
                <a href={`https://www.google.com/maps?q=${complejoLat},${complejoLng}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-grass-light hover:underline mt-1">📍 {complejoNombre} · {complejoDireccion}</a>
              ) : (
                <p className="text-sm text-white/60 mt-1">{complejoNombre} · {complejoDireccion}</p>
              )}
            </div>

            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm text-white/60"><span className="font-medium text-white">{cancha.capacidad}</span> jugadores</span>
              <span className="text-white/30">·</span>
              <span className="text-sm text-white/60"><span className="font-medium text-white">{cancha.duracionSlotMinutos} min</span> por slot</span>
            </div>

            {cancha.descripcion && <p className="text-sm text-white/70 mb-4 leading-relaxed">{cancha.descripcion}</p>}

            {cancha.servicios.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-5">
                {cancha.servicios.map(s => (
                  <span key={s} className="inline-flex items-center gap-1 rounded-lg bg-white/10 backdrop-blur-sm px-2.5 py-1.5 text-xs text-grass-light">
                    {SERVICIO_ICONS[s] || "•"} {SERVICIO_LABELS[s] || s}
                  </span>
                ))}
              </div>
            )}

            <div className="border-t border-white/10 my-4" />

            <p className="text-sm font-semibold text-white mb-3">
              {slotsLibres.length > 0 ? `${slotsLibres.length} horario${slotsLibres.length !== 1 ? "s" : ""} disponible${slotsLibres.length !== 1 ? "s" : ""}` : "Sin horarios disponibles"}
            </p>
            {slotsLibres.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {slotsLibres.map(slot => (
                  <button key={slot.inicio} disabled={booking === slot.inicio}
                    onClick={() => onReservar(cancha.id, slot)}
                    className={`rounded-xl border border-grass/30 bg-white/5 backdrop-blur-sm px-3 py-2.5 text-sm font-medium text-grass-light hover:bg-grass/10 hover:border-grass active:scale-[0.97] transition-all ${booking === slot.inicio ? "opacity-40" : ""}`}>
                    {fH(slot.inicio)} – {fH(slot.fin)}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/40 text-center py-4">Todos los horarios están ocupados.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailImage({ cancha, fP, onClose, className = "" }: {
  cancha: CanchaSlot; fP: (n: number) => string; onClose: () => void; className?: string;
}) {
  return (
    <div className={`relative bg-surface-hover overflow-hidden ${className || "h-48 lg:h-56"}`}>
      {cancha.imagen ? (
        <img src={cancha.imagen} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full flex items-center justify-center text-5xl">⚽</div>
      )}
      <button onClick={onClose} className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center text-sm hover:bg-black/70">✕</button>
      <div className="absolute bottom-3 left-3 flex gap-2">
        <span className="rounded-lg bg-black/60 px-2.5 py-1 text-xs font-bold text-white">{cancha.tipo}</span>
        {cancha.precioBase && <span className="rounded-lg bg-black/60 px-2.5 py-1 text-xs font-bold text-grass-light">{fP(cancha.precioBase)}</span>}
      </div>
    </div>
  );
}

function DetailContent({ cancha, complejoNombre, complejoDireccion, complejoLat, complejoLng, fH, slotsLibres, booking, onReservar }: {
  cancha: CanchaSlot; complejoNombre: string; complejoDireccion: string;
  complejoLat: number | null; complejoLng: number | null;
  fH: (iso: string) => string; slotsLibres: Slot[]; booking: string | null;
  onReservar: (canchaId: string, slot: Slot) => void;
}) {
  return (
    <div className="p-5 lg:p-8">
      <div className="mb-5">
        <h2 className="text-xl lg:text-2xl font-bold text-text">{cancha.nombre}</h2>
        {complejoLat && complejoLng ? (
          <a href={`https://www.google.com/maps?q=${complejoLat},${complejoLng}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-grass-light hover:underline mt-1">📍 {complejoNombre} · {complejoDireccion}</a>
        ) : (
          <p className="text-sm text-text-dim mt-1">{complejoNombre} · {complejoDireccion}</p>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4 lg:mb-5">
        <span className="text-sm text-text-dim"><span className="font-medium text-text">{cancha.capacidad}</span> jugadores</span>
        <span className="text-text-dim">·</span>
        <span className="text-sm text-text-dim"><span className="font-medium text-text">{cancha.duracionSlotMinutos} min</span> por slot</span>
      </div>

      {cancha.descripcion && <p className="text-sm text-text-muted mb-5 leading-relaxed">{cancha.descripcion}</p>}

      {cancha.servicios.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {cancha.servicios.map(s => (
            <span key={s} className="inline-flex items-center gap-1 rounded-lg bg-field/20 px-2.5 py-1.5 text-xs text-grass-light border border-grass/10">
              {SERVICIO_ICONS[s] || "•"} {SERVICIO_LABELS[s] || s}
            </span>
          ))}
        </div>
      )}

      <div className="border-t border-border my-5" />

      <div>
        <p className="text-sm font-semibold text-text mb-3">
          {slotsLibres.length > 0 ? `${slotsLibres.length} horario${slotsLibres.length !== 1 ? "s" : ""} disponible${slotsLibres.length !== 1 ? "s" : ""}` : "Sin horarios disponibles"}
        </p>
        {slotsLibres.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {slotsLibres.map(slot => (
              <button key={slot.inicio} disabled={booking === slot.inicio}
                onClick={() => onReservar(cancha.id, slot)}
                className={`rounded-xl border border-grass/40 px-4 py-3 text-sm font-medium text-grass-light hover:bg-field hover:border-grass active:scale-[0.97] transition-all ${booking === slot.inicio ? "opacity-60" : ""}`}>
                {fH(slot.inicio)} – {fH(slot.fin)}
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-bg p-6 text-center">
            <p className="text-sm text-text-dim">Todos los horarios están ocupados.</p>
          </div>
        )}
      </div>

      {cancha.slots.filter(s => !s.disponible).length > 0 && (
        <p className="text-xs text-text-dim mt-3 text-center">
          +{cancha.slots.filter(s => !s.disponible).length} ocupado{cancha.slots.filter(s => !s.disponible).length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

const SERVICIO_LABELS: Record<string, string> = {
  vestidores: "Vestidores", cafeteria: "Cafetería", parqueadero: "Parqueadero",
  iluminacion: "Iluminación", grama_sintetica: "Grama sintética", techada: "Techada",
};
const SERVICIO_ICONS: Record<string, string> = {
  vestidores: "🚿", cafeteria: "☕", parqueadero: "🅿️",
  iluminacion: "💡", grama_sintetica: "🟢", techada: "🏠",
};
