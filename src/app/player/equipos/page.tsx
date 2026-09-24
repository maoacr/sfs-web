"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";

interface EquipoInfo {
  id: string;
  nombre: string;
  fotoUrl: string | null;
  descripcion: string | null;
  _count: { miembros: number };
  miRol: string | null;
}

export default function EquiposPage() {
  const router = useRouter();
  const [equipos, setEquipos] = useState<EquipoInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [creando, setCreando] = useState(false);

  const load = () => {
    fetch("/api/equipos")
      .then((r) => r.json())
      .then((d) => setEquipos(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const crearEquipo = async () => {
    if (!nombre.trim()) return;
    setCreando(true);
    const res = await apiFetch("/api/equipos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombre.trim(), descripcion: descripcion.trim() || undefined }),
    });
    if (res.ok) {
      setShowCreate(false);
      setNombre("");
      setDescripcion("");
      load();
    }
    setCreando(false);
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-lg mx-auto space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-surface" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text">Equipos</h1>
        <button onClick={() => setShowCreate(true)}
          className="rounded-xl bg-grass px-4 py-2 text-sm font-semibold text-white hover:bg-grass-light transition-colors">
          + Crear
        </button>
      </div>

      {/* Crear equipo modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-text mb-4">Crear equipo</h2>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del equipo" maxLength={100}
              className="w-full rounded-xl border border-border bg-field px-4 py-2.5 text-sm text-text mb-3" />
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción (opcional)" maxLength={500} rows={2}
              className="w-full rounded-xl border border-border bg-field px-4 py-2.5 text-sm text-text mb-4 resize-none" />
            <div className="flex gap-3">
              <button onClick={() => setShowCreate(false)}
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm text-text-muted">
                Cancelar
              </button>
              <button onClick={crearEquipo} disabled={!nombre.trim() || creando}
                className="flex-1 rounded-xl bg-grass px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {creando ? "Creando..." : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      {equipos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
          <p className="text-text-muted text-base">No tenés equipos todavía.</p>
          <p className="text-sm text-text-dim mt-1">Creá uno para armar partidos con tus amigos.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {equipos.map((e) => (
            <Link key={e.id} href={`/player/equipos/${e.id}`}
              className="rounded-2xl border border-border bg-surface p-4 shadow-sm hover:border-grass/30 transition-colors flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-grass/10 flex items-center justify-center text-xl flex-shrink-0">
                {e.fotoUrl ? <img src={e.fotoUrl} alt="" className="w-full h-full rounded-xl object-cover" /> : "⚽"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text truncate">{e.nombre}</p>
                <p className="text-xs text-text-dim">
                  {e._count.miembros} miembro{e._count.miembros !== 1 ? "s" : ""}
                  {e.miRol && <span className="ml-2 text-grass-light">· {e.miRol}</span>}
                </p>
              </div>
              <span className="text-text-dim text-xs">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
