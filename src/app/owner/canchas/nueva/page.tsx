"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { sileo } from "sileo";

const TIPOS = [
  { value: "F5", label: "Fútbol 5", jugadores: 10 },
  { value: "F6", label: "Fútbol 6", jugadores: 12 },
  { value: "F7", label: "Fútbol 7", jugadores: 14 },
  { value: "F8", label: "Fútbol 8", jugadores: 16 },
  { value: "F9", label: "Fútbol 9", jugadores: 18 },
  { value: "F11", label: "Fútbol 11", jugadores: 22 },
];

const SERVICIOS = ["vestidores", "cafeteria", "parqueadero", "iluminacion", "grama_sintetica", "techada"];

interface Complejo { id: string; nombre: string; direccion: string; }

function NuevaCanchaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedComplejo = searchParams.get("complejo");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [complejos, setComplejos] = useState<Complejo[]>([]);

  const [complejoId, setComplejoId] = useState("");
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("F5");
  const [capacidad, setCapacidad] = useState(10);
  const [descripcion, setDescripcion] = useState("");
  const [servicios, setServicios] = useState<string[]>([]);
  const [duracionSlot, setDuracionSlot] = useState(60);

  useEffect(() => {
    fetch("/api/complejos").then(r => r.json()).then(data => {
      setComplejos(data);
      if (preselectedComplejo && data.find((c: Complejo) => c.id === preselectedComplejo)) {
        setComplejoId(preselectedComplejo);
      } else if (data.length === 1) {
        setComplejoId(data[0].id);
      }
    }).catch(console.error);
  }, [preselectedComplejo]);

  function toggleServicio(s: string) {
    setServicios(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/canchas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complejoId, nombre, tipo, capacidad, descripcion: descripcion || undefined, servicios, duracionSlotMinutos: duracionSlot }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Error al crear"); }
      sileo.success({ title: "Cancha creada", description: `${nombre} fue agregada exitosamente.` });
      router.push("/owner/dashboard"); router.refresh();
    } catch (err) { sileo.error({ title: "Error", description: err instanceof Error ? err.message : "Error" }); }
    finally { setLoading(false); }
  }

  const inputClass = "mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-grass focus:ring-1 focus:ring-grass";
  const labelClass = "block text-sm font-medium text-text";

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => router.back()}
          className="flex items-center justify-center h-9 w-9 rounded-xl border border-border text-text-muted hover:text-text hover:border-border-hover transition-colors text-sm">
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold text-text">Nueva cancha</h1>
          <p className="text-sm text-text-muted">Asigná una cancha a uno de tus complejos</p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Selector de complejo */}
          <div>
            <label className={labelClass}>Complejo deportivo</label>
            {complejos.length === 0 ? (
              <div className="mt-1 rounded-lg border border-dashed border-border bg-bg p-4 text-center">
                <p className="text-sm text-text-muted">No tenés complejos registrados.</p>
                <Link href="/owner/complejos/nuevo" className="mt-1 inline-block text-xs font-medium text-grass hover:text-grass-light">
                  Creá tu primer complejo →
                </Link>
              </div>
            ) : (
              <select value={complejoId} onChange={e => setComplejoId(e.target.value)} required
                className={`${inputClass} bg-surface`}>
                <option value="">Seleccionar complejo...</option>
                {complejos.map(c => <option key={c.id} value={c.id}>{c.nombre} — {c.direccion}</option>)}
              </select>
            )}
            <Link href="/owner/complejos/nuevo" className="mt-1 inline-block text-xs text-grass hover:text-grass-light">+ Nuevo complejo</Link>
          </div>

          <div>
            <label className={labelClass}>Nombre de la cancha</label>
            <input type="text" required value={nombre} onChange={e => setNombre(e.target.value)} className={inputClass}
              placeholder='Ej: "Cancha Principal", "Fútbol 7 Techada"' />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Tipo de cancha</label>
              <select value={tipo} onChange={e => { setTipo(e.target.value); const t = TIPOS.find(x => x.value === e.target.value); if (t) setCapacidad(t.jugadores); }}
                className={`${inputClass} bg-surface`}>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label} ({t.jugadores} jugadores)</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Capacidad</label>
              <input type="number" required min={2} max={30} value={capacidad} onChange={e => setCapacidad(Number(e.target.value))} className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Descripción <span className="font-normal text-text-dim">(opcional)</span></label>
            <textarea rows={3} value={descripcion} onChange={e => setDescripcion(e.target.value)} className={inputClass} placeholder="Detalles del espacio, tipo de grama..." />
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
            <label className={labelClass}>Duración de cada reserva</label>
            <select value={duracionSlot} onChange={e => setDuracionSlot(Number(e.target.value))} className={`${inputClass} bg-surface`}>
              <option value={30}>30 min</option><option value={60}>1 hora</option>
              <option value={90}>1h 30min</option><option value={120}>2 horas</option>
            </select>
          </div>

          {error && <div className="rounded-lg bg-error-bg px-4 py-3 text-sm text-error">{error}</div>}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => router.back()}
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-muted hover:bg-surface-hover transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="rounded-lg bg-grass px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-grass-light disabled:opacity-50 transition-colors">
              {loading ? "Creando..." : "Crear cancha"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NuevaCancha() {
  return (
    <Suspense fallback={<div className="p-8 text-text-muted animate-pulse">Cargando...</div>}>
      <NuevaCanchaForm />
    </Suspense>
  );
}
