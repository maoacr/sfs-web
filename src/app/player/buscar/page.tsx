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
        <Swiper
          direction="vertical"
          slidesPerView={1}
          spaceBetween={0}
          className="flex-1 w-full"
          onSwiper={swiper => { verticalRef.current = swiper; }}
          onSlideChange={swiper => setActiveComplejo(swiper.activeIndex)}
          resistanceRatio={0.5}
          speed={400}
        >
          {complejos.map(comp => (
            <SwiperSlide key={comp.id} className="flex flex-col">
              <div className="flex-1 flex flex-col">
                {/* Complejo header */}
                <div className="px-4 pb-3 flex-shrink-0">
                  <h2 className="text-base font-bold text-text">{comp.nombre}</h2>
                  {comp.lat && comp.lng ? (
                    <a href={`https://www.google.com/maps?q=${comp.lat},${comp.lng}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-grass-light hover:underline mt-0.5">
                      📍 {comp.direccion}
                    </a>
                  ) : (
                    <p className="text-xs text-text-dim mt-0.5">📍 {comp.direccion}</p>
                  )}
                </div>

                {/* Horizontal cancha swiper */}
                <Swiper
                  slidesPerView="auto"
                  spaceBetween={12}
                  centeredSlides
                  className="flex-1 w-full px-4 py-4"
                  pagination={{ clickable: true }}
                  modules={[Pagination]}
                  resistanceRatio={0.5}
                >
                  {comp.canchas.map(cancha => {
                    const libres = cancha.slots.filter(s => s.disponible).length;
                    return (
                      <SwiperSlide key={cancha.id} style={{ width: "85vw", maxWidth: "24rem", height: "calc(100dvh - 18rem)", minHeight: "22rem" }}
                        onClick={() => {
                          setSelectedCancha({ ...cancha, complejoNombre: comp.nombre, complejoDireccion: comp.direccion, complejoLat: comp.lat, complejoLng: comp.lng });
                        }}
                        className="flex flex-col rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform border border-border">
                        {/* Full-bleed image with gradient overlay */}
                        <div className="relative flex-1 min-h-0">
                          {cancha.imagen ? (
                            <img src={cancha.imagen} alt="" className="absolute inset-0 w-full h-full object-cover" />
                          ) : (
                            <div className="absolute inset-0 w-full h-full bg-surface-hover flex items-center justify-center text-6xl">⚽</div>
                          )}
                          {/* Gradient overlay — transparent at top, dark at bottom */}
                          <div className="absolute inset-0 bg-gradient-to-t from-bg/95 via-bg/40 to-transparent" />

                          {/* Info overlay */}
                          <div className="absolute inset-x-0 bottom-0 p-4">
                            {/* Tipo + Precio */}
                            <div className="flex items-center gap-2 mb-2">
                              <span className="rounded-lg bg-grass/90 px-2.5 py-1 text-xs font-bold text-white">{cancha.tipo}</span>
                              {cancha.precioBase && (
                                <span className="rounded-lg bg-black/50 px-2.5 py-1 text-xs font-bold text-grass-light">{fP(cancha.precioBase)}</span>
                              )}
                            </div>
                            {/* Nombre */}
                            <h3 className="font-bold text-white text-lg leading-tight">{cancha.nombre}</h3>
                            {/* Capacidad */}
                            <p className="text-sm text-white/70 mt-0.5">{cancha.capacidad} jugadores · {cancha.duracionSlotMinutos} min</p>
                            {/* Disponibilidad */}
                            <div className="mt-2">
                              {libres > 0 ? (
                                <div className="inline-flex items-center gap-1.5 rounded-full bg-grass/20 px-3 py-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-grass-light" />
                                  <span className="text-xs font-medium text-grass-light">{libres} horario{libres !== 1 ? "s" : ""} libre{libres !== 1 ? "s" : ""}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-white/50">Sin horarios disponibles</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </SwiperSlide>
                    );
                  })}
                </Swiper>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
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
        className="relative w-full lg:max-w-lg max-h-[85vh] lg:max-h-[80vh] overflow-y-auto rounded-t-3xl lg:rounded-3xl border border-border bg-surface shadow-2xl animate-slide-up">
        <div className="lg:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="relative h-48 lg:h-56 bg-surface-hover rounded-t-3xl overflow-hidden">
          {cancha.imagen ? (
            <img src={cancha.imagen} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-5xl">⚽</div>
          )}
          <button onClick={onClose} className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center text-sm">✕</button>
          <div className="absolute bottom-3 left-3 flex gap-2">
            <span className="rounded-lg bg-black/60 px-2.5 py-1 text-xs font-bold text-white">{cancha.tipo}</span>
            {cancha.precioBase && <span className="rounded-lg bg-black/60 px-2.5 py-1 text-xs font-bold text-grass-light">{fP(cancha.precioBase)}</span>}
          </div>
        </div>
        <div className="p-5">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-text">{cancha.nombre}</h2>
            {complejoLat && complejoLng ? (
              <a href={`https://www.google.com/maps?q=${complejoLat},${complejoLng}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-grass-light hover:underline mt-0.5">📍 {complejoNombre} · {complejoDireccion}</a>
            ) : (
              <p className="text-sm text-text-dim mt-0.5">{complejoNombre} · {complejoDireccion}</p>
            )}
          </div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs text-text-dim"><span className="font-medium text-text">{cancha.capacidad}</span> jugadores</span>
            <span className="text-text-dim">·</span>
            <span className="text-xs text-text-dim"><span className="font-medium text-text">{cancha.duracionSlotMinutos} min</span> por slot</span>
          </div>
          {cancha.descripcion && <p className="text-sm text-text-muted mb-4 leading-relaxed">{cancha.descripcion}</p>}
          {cancha.servicios.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {cancha.servicios.map(s => (
                <span key={s} className="inline-flex items-center gap-1 rounded-lg bg-field/20 px-2.5 py-1.5 text-xs text-grass-light border border-grass/10">
                  {SERVICIO_ICONS[s] || "•"} {SERVICIO_LABELS[s] || s}
                </span>
              ))}
            </div>
          )}
          <div className="border-t border-border my-4" />
          <div>
            <p className="text-sm font-semibold text-text mb-3">
              {slotsLibres.length > 0 ? `${slotsLibres.length} horario${slotsLibres.length !== 1 ? "s" : ""} disponible${slotsLibres.length !== 1 ? "s" : ""}` : "Sin horarios disponibles"}
            </p>
            {slotsLibres.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
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
                <p className="text-xs text-text-dim mt-1">Probá con otra fecha.</p>
              </div>
            )}
          </div>
          {cancha.slots.filter(s => !s.disponible).length > 0 && (
            <p className="text-xs text-text-dim mt-3 text-center">+{cancha.slots.filter(s => !s.disponible).length} ocupado{cancha.slots.filter(s => !s.disponible).length !== 1 ? "s" : ""}</p>
          )}
        </div>
      </div>
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
