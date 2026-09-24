"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";

interface MiembroInfo {
  id: string;
  rol: string;
  user: { id: string; primerNombre: string; apellidos: string; apodo: string | null };
}

interface EquipoDetail {
  id: string;
  nombre: string;
  fotoUrl: string | null;
  descripcion: string | null;
  creadorId: string;
  miembros: MiembroInfo[];
  _count: { miembros: number };
}

export default function EquipoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [equipo, setEquipo] = useState<EquipoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [invitando, setInvitando] = useState(false);
  const [userId, setUserId] = useState("");

  const load = () => {
    fetch(`/api/equipos/${id}`)
      .then((r) => r.json())
      .then((d) => setEquipo(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const invitar = async () => {
    if (!userId.trim()) return;
    setInvitando(true);
    await apiFetch(`/api/equipos/${id}/miembros`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: userId.trim() }),
    });
    setUserId("");
    setInvitando(false);
    load();
  };

  const remover = async (userId: string) => {
    await apiFetch(`/api/equipos/${id}/miembros?userId=${userId}`, { method: "DELETE" });
    load();
  };

  if (loading) return (
    <div className="p-6 lg:p-8 max-w-lg mx-auto">
      <div className="h-64 animate-pulse rounded-2xl border border-border bg-surface" />
    </div>
  );

  if (!equipo) return (
    <div className="p-6 lg:p-8 max-w-lg mx-auto text-center">
      <p className="text-text-muted">Equipo no encontrado</p>
    </div>
  );

  const soyCapitan = equipo.creadorId === equipo.miembros.find((m) => m.rol === "CAPITAN")?.user.id;

  return (
    <div className="p-6 lg:p-8 max-w-lg mx-auto">
      <Link href="/player/equipos" className="text-sm text-text-dim hover:text-grass mb-6 inline-block">
        ← Equipos
      </Link>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-grass/10 flex items-center justify-center text-3xl flex-shrink-0">
            ⚽
          </div>
          <div>
            <h1 className="text-xl font-bold text-text">{equipo.nombre}</h1>
            <p className="text-sm text-text-dim">{equipo._count.miembros} miembros</p>
          </div>
        </div>
        {equipo.descripcion && (
          <p className="text-sm text-text-muted">{equipo.descripcion}</p>
        )}
      </div>

      {/* Miembros */}
      <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Miembros</h2>
      <div className="space-y-2 mb-6">
        {equipo.miembros.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
            <div>
              <p className="text-sm text-text">
                {m.user.primerNombre} {m.user.apellidos || ""}
                {m.user.apodo && <span className="text-xs text-text-dim ml-1">@{m.user.apodo}</span>}
              </p>
              <p className="text-xs text-text-dim">{m.rol}</p>
            </div>
            {(soyCapitan || m.rol !== "CAPITAN") && m.rol !== "CAPITAN" && (
              <button onClick={() => remover(m.user.id)}
                className="text-xs text-red-400 hover:text-red-300">Remover</button>
            )}
          </div>
        ))}
      </div>

      {/* Invitar */}
      {soyCapitan && (
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-text mb-3">Invitar jugador</h3>
          <div className="flex gap-2">
            <input value={userId} onChange={(e) => setUserId(e.target.value)}
              placeholder="ID del usuario" className="flex-1 rounded-xl border border-border bg-field px-4 py-2 text-sm text-text" />
            <button onClick={invitar} disabled={invitando || !userId.trim()}
              className="rounded-xl bg-grass px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Invitar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
