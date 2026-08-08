"use client";

import { useEffect, useState } from "react";
import { AgendaView } from "@/components/agenda-view";
import { ImageUploadZone } from "@/components/image-upload-zone";
import { useRouter, useParams } from "next/navigation";

const TIPOS = [
  { value: "F5", label: "Fútbol 5", jugadores: 10 },
  { value: "F6", label: "Fútbol 6", jugadores: 12 },
  { value: "F7", label: "Fútbol 7", jugadores: 14 },
  { value: "F8", label: "Fútbol 8", jugadores: 16 },
  { value: "F9", label: "Fútbol 9", jugadores: 18 },
  { value: "F11", label: "Fútbol 11", jugadores: 22 },
];

const SERVICIOS = ["vestidores", "cafeteria", "parqueadero", "iluminacion", "grama_sintetica", "techada"];

const DIAS = [
  { value: 0, label: "Dom" }, { value: 1, label: "Lun" }, { value: 2, label: "Mar" },
  { value: 3, label: "Mié" }, { value: 4, label: "Jue" }, { value: 5, label: "Vie" }, { value: 6, label: "Sáb" },
];

interface Cancha { id: string; nombre: string; tipo: string; capacidad: number; descripcion: string | null; servicios: string[]; duracionSlotMinutos: number; slots: Slot[]; tarifas: Tarifa[]; imagenes: { id: string; url: string; orden: number }[]; complejo: { id: string; nombre: string; direccion: string } };
interface Slot { id: string; diaSemana: number; horaApertura: string; horaCierre: string; }
interface Tarifa { id: string; precioBase: number; diaSemana: number | null; horaInicio: string | null; horaFin: string | null; factor: number; }

const inputClass = "mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-grass focus:ring-1 focus:ring-grass";
const labelClass = "block text-sm font-medium text-text";

export default function GestionarCancha() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [cancha, setCancha] = useState<Cancha | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"datos" | "slots" | "tarifas" | "agenda" | "imagenes">("datos");

  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("F5");
  const [capacidad, setCapacidad] = useState(10);
  const [descripcion, setDescripcion] = useState("");
  const [servicios, setServicios] = useState<string[]>([]);
  const [duracionSlot, setDuracionSlot] = useState(60);

  useEffect(() => {
    fetch(`/api/canchas/${id}`).then(r => r.json()).then(data => {
      setCancha(data); setNombre(data.nombre); setTipo(data.tipo); setCapacidad(data.capacidad);
      setDescripcion(data.descripcion || ""); setServicios(data.servicios || []);
      setDuracionSlot(data.duracionSlotMinutos);
    }).catch(() => setError("Error al cargar")).finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/canchas/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, tipo, capacidad, descripcion: descripcion || null, servicios, duracionSlotMinutos: duracionSlot }) });
      if (!res.ok) throw new Error("Error al guardar");
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setSaving(false); }
  }

  function toggleServicio(s: string) { setServicios(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]); }

  if (loading) return (
    <div className="p-4 lg:p-6">
      <div className="h-8 w-48 animate-pulse rounded bg-surface" />
      <div className="mt-4 h-64 animate-pulse rounded-xl bg-surface" />
    </div>
  );

  if (!cancha) return (
    <div className="p-4 lg:p-6 text-center">
      <p className="text-text-muted">Cancha no encontrada</p>
    </div>
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => router.back()}
          className="flex items-center justify-center h-9 w-9 rounded-xl border border-border text-text-muted hover:text-text hover:border-border-hover transition-colors text-sm">
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold text-text">{cancha.nombre}</h1>
          <p className="text-sm text-text-muted">
            {cancha.tipo} · {cancha.capacidad} jugadores
            {cancha.complejo && <span className="text-text-dim"> · {cancha.complejo.nombre}</span>}
          </p>
          {cancha.complejo && <p className="text-xs text-text-dim mt-0.5">{cancha.complejo.direccion}</p>}
        </div>
      </div>

      <div className="flex gap-1 rounded-lg bg-surface p-1 border border-border">
        {(["datos", "slots", "tarifas", "agenda", "imagenes"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? "bg-field text-grass-light shadow-sm" : "text-text-muted hover:text-text"
            }`}>
            {t === "datos" ? "Datos" : t === "slots" ? "Horarios" : t === "tarifas" ? "Precios" : t === "agenda" ? "Agenda" : "Fotos"}
          </button>
        ))}
      </div>

      {tab === "datos" && (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-5">
          <Input label="Nombre" value={nombre} onChange={setNombre} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Tipo</label>
              <select value={tipo} onChange={(e) => { setTipo(e.target.value); const t = TIPOS.find(x => x.value === e.target.value); if (t) setCapacidad(t.jugadores); }}
                className={`${inputClass} bg-surface`}>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <Input label="Capacidad" type="number" value={String(capacidad)} onChange={v => setCapacidad(Number(v))} />
          </div>
          <div>
            <label className={labelClass}>Descripción</label>
            <textarea rows={3} value={descripcion} onChange={e => setDescripcion(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={`${labelClass} mb-2`}>Servicios</label>
            <div className="flex flex-wrap gap-2">
              {SERVICIOS.map(s => (
                <button key={s} type="button" onClick={() => toggleServicio(s)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${servicios.includes(s) ? "border-grass bg-field text-grass-light" : "border-border text-text-muted hover:border-border-hover"}`}>
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelClass}>Duración del slot</label>
            <select value={duracionSlot} onChange={e => setDuracionSlot(Number(e.target.value))} className={`${inputClass} bg-surface`}>
              <option value={30}>30 min</option><option value={60}>1 hora</option>
              <option value={90}>1h 30min</option><option value={120}>2 horas</option>
            </select>
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <button onClick={handleSave} disabled={saving}
            className="rounded-lg bg-grass px-6 py-2.5 text-sm font-semibold text-white hover:bg-grass-light disabled:opacity-50 transition-colors">
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      )}

      {tab === "slots" && <SlotsTab canchaId={id} slots={cancha.slots} onUpdate={() => router.refresh()} />}
      {tab === "tarifas" && <TarifasTab canchaId={id} tarifas={cancha.tarifas} onUpdate={() => router.refresh()} />}
      {tab === "agenda" && <AgendaView canchaId={id} />}

      {tab === "imagenes" && (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <ImageUploadZone
            imagenes={cancha.imagenes || []}
            uploadUrl={`/api/canchas/${id}/imagenes`}
            onRefresh={() => router.refresh()}
          />
        </div>
      )}
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center justify-center h-8 w-8 rounded-lg border border-border text-text-muted hover:text-text hover:border-border-hover transition-colors"
      title="Volver">
      ←
    </button>
  );
}

function Input({ label, type = "text", value, onChange }: { label: string; type?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className={inputClass} />
    </div>
  );
}

function SlotsTab({ canchaId, slots: initialSlots, onUpdate }: { canchaId: string; slots: Slot[]; onUpdate: () => void }) {
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [loading, setLoading] = useState(false);
  const [times, setTimes] = useState<Record<string, { apertura: string; cierre: string }>>({});

  // Sync from props (cuando se recarga la página)
  useEffect(() => { setSlots(initialSlots); }, [initialSlots]);

  // Sync times from slots
  useEffect(() => {
    const next: Record<string, { apertura: string; cierre: string }> = {};
    slots.forEach(s => {
      next[s.id] = {
        apertura: extraerHora(s.horaApertura) || "08:00",
        cierre: extraerHora(s.horaCierre) || "23:00",
      };
    });
    setTimes(next);
  }, [slots]);

  async function toggleDia(diaSemana: number) {
    setLoading(true);
    const existe = slots.find(s => s.diaSemana === diaSemana);

    if (existe) {
      // Optimistic: eliminar localmente
      setSlots(prev => prev.filter(s => s.id !== existe.id));
      await fetch(`/api/canchas/${canchaId}/slots/${existe.id}`, { method: "DELETE" });
    } else {
      // Optimistic: agregar temporalmente
      const tempId = "temp-" + Date.now();
      const tempSlot: Slot = { id: tempId, diaSemana, horaApertura: "1970-01-01T08:00:00.000Z", horaCierre: "1970-01-01T23:00:00.000Z" };
      setSlots(prev => [...prev, tempSlot]);

      const res = await fetch(`/api/canchas/${canchaId}/slots`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diaSemana, horaApertura: "08:00:00", horaCierre: "23:00:00" }),
      });
      const nuevo: Slot = await res.json();
      // Reemplazar el temporal con el real del servidor
      setSlots(prev => prev.map(s => s.id === tempId ? nuevo : s));
    }
    setLoading(false);
    // Recargar para actualizar el padre
    onUpdate();
  }

  async function actualizarSlot(slotId: string, field: string, value: string) {
    setTimes(prev => ({ ...prev, [slotId]: { ...prev[slotId], [field === "horaApertura" ? "apertura" : "cierre"]: value } }));
    // Guardar en servidor sin recargar (la UI ya está actualizada)
    fetch(`/api/canchas/${canchaId}/slots/${slotId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value + ":00" }),
    }).catch(console.error);
  }

  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <p className="text-sm text-text-muted mb-4">Activá los días y ajustá los horarios de apertura y cierre.</p>
      <div className="space-y-1.5">
        {DIAS.map(dia => {
          const slot = slots.find(s => s.diaSemana === dia.value);
          return (
            <div key={dia.value} className={`rounded-lg border p-3 flex items-center justify-between transition-colors ${slot ? "border-grass/30 bg-field/20" : "border-border"}`}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={!!slot} onChange={() => toggleDia(dia.value)} disabled={loading}
                  className="h-4 w-4 rounded border-border bg-surface accent-grass" />
                <span className="text-sm font-medium text-text w-8">{dia.label}</span>
              </label>
              {slot && times[slot.id] && (
                <div className="flex items-center gap-1.5 text-sm">
                  <input type="time" value={times[slot.id].apertura}
                    onChange={e => actualizarSlot(slot.id, "horaApertura", e.target.value)}
                    className="rounded border border-border bg-bg px-2 py-1 text-xs text-text" />
                  <span className="text-text-dim">a</span>
                  <input type="time" value={times[slot.id].cierre}
                    onChange={e => actualizarSlot(slot.id, "horaCierre", e.target.value)}
                    className="rounded border border-border bg-bg px-2 py-1 text-xs text-text" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TarifasTab({ canchaId, tarifas, onUpdate }: { canchaId: string; tarifas: Tarifa[]; onUpdate: () => void }) {
  const tarifaBase = tarifas.find(t => t.diaSemana === null && t.horaInicio === null);
  const [precioBase, setPrecioBase] = useState(tarifaBase?.precioBase || 0);
  const [saving, setSaving] = useState(false);

  async function guardar() {
    setSaving(true);
    if (tarifaBase) {
      await fetch(`/api/canchas/${canchaId}/tarifas/${tarifaBase.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ precioBase }) });
    } else {
      await fetch(`/api/canchas/${canchaId}/tarifas`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ precioBase, factor: 1.0 }) });
    }
    setSaving(false); onUpdate();
  }

  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-6">
      <div>
        <label className="block text-sm font-medium text-text">Precio base (por slot)</label>
        <p className="text-xs text-text-dim mt-0.5">Precio default en pesos colombianos. Después podrás agregar recargos.</p>
        <div className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">$</span>
            <input type="number" value={precioBase} onChange={e => setPrecioBase(Number(e.target.value))}
              className="block w-full rounded-lg border border-border bg-bg pl-7 pr-3 py-2 text-sm text-text focus:border-grass focus:ring-1 focus:ring-grass" placeholder="60000" />
          </div>
          <span className="flex items-center text-sm text-text-dim">COP</span>
          <button onClick={guardar} disabled={saving}
            className="rounded-lg bg-grass px-4 py-2 text-sm font-semibold text-white hover:bg-grass-light disabled:opacity-50 transition-colors">
            {saving ? "..." : "Guardar"}
          </button>
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-text mb-3">Recargos por franja horaria <span className="font-normal text-text-dim">(próximamente)</span></p>
        <div className="rounded-lg border border-dashed border-border bg-bg p-6 text-center">
          <p className="text-sm text-text-dim">Acá podrás configurar precios especiales por día y horario.</p>
        </div>
      </div>
    </div>
  );
}

function extraerHora(iso: string | undefined): string | null {
  if (!iso) return null;
  return iso.slice(11, 16);
}
