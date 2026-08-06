"use client";

import { useEffect, useState, useRef } from "react";

interface ReservaInfo { id: string; estado: string; player: string; apodo: string | null; telefono: string | null }
interface Slot { inicio: string; fin: string; disponible: boolean; reserva?: ReservaInfo }
interface CanchaAgenda { id: string; nombre: string; tipo: string; duracionSlotMinutos: number; complejo: { nombre: string; direccion: string } }

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function inicioSemana(fecha: Date): Date {
  const d = new Date(fecha);
  const dia = d.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diff);
  return d;
}

function generarSemana(lunes: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    return d;
  });
}

function mismaFecha(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function AgendaView({ canchaId }: { canchaId: string }) {
  const [cancha, setCancha] = useState<CanchaAgenda | null>(null);
  const [semanaLunes, setSemanaLunes] = useState(() => inicioSemana(new Date()));
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const semana = generarSemana(semanaLunes);
  const hoy = new Date();

  // Cargar datos de la cancha
  useEffect(() => {
    fetch(`/api/canchas/${canchaId}`).then(r => r.json()).then(data => {
      setCancha({ id: data.id, nombre: data.nombre, tipo: data.tipo, duracionSlotMinutos: data.duracionSlotMinutos, complejo: data.complejo });
    });
  }, [canchaId]);

  // Auto-seleccionar hoy si está en la semana visible y no hay selección
  useEffect(() => {
    if (!diaSeleccionado) return;
    cargarSlots(diaSeleccionado);
  }, [diaSeleccionado, canchaId]);

  // Seleccionar hoy por defecto al montar si está en la semana actual
  useEffect(() => {
    const hoyEstaEnSemana = semana.some(d => mismaFecha(d, hoy));
    if (hoyEstaEnSemana) {
      setDiaSeleccionado(new Date(hoy));
    } else {
      setDiaSeleccionado(new Date(semana[0]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cargarSlots(fecha: Date) {
    setLoading(true);
    const day = fecha.toISOString().slice(0, 10);
    fetch(`/api/disponibilidad?fecha=${day}`)
      .then(r => r.json())
      .then(data => {
        const encontrado = Array.isArray(data) ? data.find((c: any) => c.id === canchaId) : null;
        setSlots(encontrado?.slots || []);
      })
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }

  function irSemanaAnterior() {
    const nueva = new Date(semanaLunes);
    nueva.setDate(semanaLunes.getDate() - 7);
    setSemanaLunes(nueva);
  }

  function irSemanaSiguiente() {
    const nueva = new Date(semanaLunes);
    nueva.setDate(semanaLunes.getDate() + 7);
    setSemanaLunes(nueva);
  }

  function seleccionarDia(d: Date) {
    setDiaSeleccionado(new Date(d));
  }

  async function cancelarReserva(reservaId: string) {
    setCancelling(true);
    try {
      await fetch(`/api/reservas/${reservaId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "CANCELADA" }),
      });
      setSlots(prev => prev.map(s =>
        s.reserva?.id === reservaId ? { ...s, disponible: true, reserva: undefined } : s
      ));
      setSelectedSlot(null);
    } catch {} 
    finally { setCancelling(false); }
  }

  const fH = (iso: string) => new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  const fF = (d: Date) => d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });

  const mesActual = MESES[semanaLunes.getMonth()];
  const añoActual = semanaLunes.getFullYear();

  return (
    <div>
      {/* Header de cancha */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-text">{cancha?.nombre || "..."}</h3>
          <p className="text-xs text-text-dim">{cancha?.tipo} · {cancha?.complejo?.nombre}</p>
        </div>
        {diaSeleccionado && (
          <p className="text-xs text-text-dim">
            {diaSeleccionado.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        )}
      </div>

      {/* Navegador de semana - SIEMPRE visible */}
      <div className="rounded-2xl border border-border bg-surface p-4">
        {/* Controles de navegación */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-text">{mesActual} {añoActual}</span>
          <div className="flex gap-1">
            <button onClick={irSemanaAnterior}
              className="flex items-center justify-center h-7 w-7 rounded-lg border border-border text-text-muted hover:text-text hover:border-border-hover transition-colors text-sm">
              ←
            </button>
            <button onClick={irSemanaSiguiente}
              className="flex items-center justify-center h-7 w-7 rounded-lg border border-border text-text-muted hover:text-text hover:border-border-hover transition-colors text-sm">
              →
            </button>
          </div>
        </div>

        {/* Grilla de días - horizontal scroll con gradiente */}
        <div className="relative">
          <div ref={scrollRef} className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
            {semana.map((d, i) => {
              const esHoy = mismaFecha(d, hoy);
              const seleccionado = diaSeleccionado ? mismaFecha(d, diaSeleccionado) : false;
              return (
                <button key={i} onClick={() => seleccionarDia(d)}
                  className={`flex-shrink-0 rounded-xl border p-2.5 text-center min-w-[60px] transition-all ${seleccionado
                    ? "border-grass bg-field text-grass-light shadow-sm scale-[1.02]"
                    : esHoy
                      ? "border-grass/30 bg-field/10 text-text"
                      : "border-border bg-bg text-text-muted hover:border-border-hover hover:text-text"
                  }`}>
                  <p className={`text-[11px] uppercase ${seleccionado ? "text-grass-light" : "text-text-dim"}`}>{DIAS[i]}</p>
                  <p className={`text-lg font-bold mt-0.5 ${seleccionado ? "text-grass-light" : esHoy ? "text-grass-light" : "text-text"}`}>{d.getDate()}</p>
                  <p className="text-[10px] text-text-dim">{fF(d)}</p>
                </button>
              );
            })}
          </div>
          {/* Gradiente fade a la derecha */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-surface to-transparent" />
        </div>
      </div>

      {/* Slots del día seleccionado - DEBAJO de los días */}
      {diaSeleccionado && (
        <div className="mt-4">
          {loading ? (
            <div className="space-y-1">{[1,2,3,4].map(i => <div key={i} className="h-12 animate-pulse rounded-lg bg-surface border border-border" />)}</div>
          ) : slots.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
              <p className="text-sm text-text-muted">No hay reservas para este día todavía.</p>
              <p className="text-xs text-text-dim mt-1">Los slots libres aparecen cuando hay horarios configurados y reservas.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {slots.map(slot => (
                <button key={slot.inicio} onClick={() => !slot.disponible && slot.reserva ? setSelectedSlot(slot) : null}
                  className={`w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                    slot.disponible
                      ? "border-grass/30 bg-field/10"
                      : "border-error/20 bg-error-bg/50 hover:bg-error-bg/70 cursor-pointer"
                  }`}>
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${slot.disponible ? "bg-grass" : "bg-error"}`} />
                    <span className="text-sm font-medium text-text">{fH(slot.inicio)} – {fH(slot.fin)}</span>
                  </div>
                  <span className={`text-xs font-medium ${slot.disponible ? "text-grass-light" : "text-error"}`}>
                    {slot.disponible ? "Libre" : slot.reserva?.player || "Reservado"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: detalle de reserva */}
      {selectedSlot?.reserva && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedSlot(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-text">Reserva</h3>
                <p className="text-sm text-text-muted mt-0.5">{fH(selectedSlot.inicio)} – {fH(selectedSlot.fin)}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                selectedSlot.reserva.estado === "CONFIRMADA" ? "bg-grass/20 text-grass-light" : "bg-warning/20 text-warning"
              }`}>
                {selectedSlot.reserva.estado === "CONFIRMADA" ? "Confirmada" : "Pendiente"}
              </span>
            </div>

            <div className="space-y-3 py-3 border-y border-border">
              <div>
                <p className="text-xs text-text-dim">Jugador</p>
                <p className="text-sm font-medium text-text">{selectedSlot.reserva.player}</p>
                {selectedSlot.reserva.apodo && <p className="text-xs text-grass-light">@{selectedSlot.reserva.apodo}</p>}
              </div>
              {selectedSlot.reserva.telefono && (
                <div>
                  <p className="text-xs text-text-dim">Teléfono</p>
                  <p className="text-sm text-text">{selectedSlot.reserva.telefono}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-text-dim">Cancha</p>
                <p className="text-sm text-text">{cancha?.nombre} ({cancha?.tipo})</p>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setSelectedSlot(null)}
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm text-text-muted hover:bg-surface-hover transition-colors">
                Cerrar
              </button>
              <button onClick={() => cancelarReserva(selectedSlot.reserva!.id)} disabled={cancelling}
                className="flex-1 rounded-xl bg-error px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors">
                {cancelling ? "Cancelando..." : "Cancelar reserva"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
