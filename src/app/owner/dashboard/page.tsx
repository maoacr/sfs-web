"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatAddress } from "@/lib/address";

interface Complejo { id: string; nombre: string; direccion: string; _count: { canchas: number }; canchas: { id: string; nombre: string; tipo: string }[]; }

export default function OwnerDashboard() {
  const [complejos, setComplejos] = useState<Complejo[]>([]);
  const [loading, setLoading] = useState(true);

  const [reservasHoy, setReservasHoy] = useState(0);

  const [reservasActivas, setReservasActivas] = useState<any[]>([]);

  useEffect(() => {
    const load = () => {
      Promise.all([
        fetch("/api/complejos").then(r => r.json()),
        fetch(`/api/reservas?fecha=${new Date().toISOString().slice(0, 10)}&estado=CONFIRMADA`).then(r => r.json()),
      ]).then(([complejosData, reservasData]) => {
        setComplejos(Array.isArray(complejosData) ? complejosData : []);
        setReservasHoy(Array.isArray(reservasData) ? reservasData.length : 0);
        setReservasActivas(Array.isArray(reservasData) ? reservasData.slice(0, 5) : []);
      }).catch(console.error).finally(() => setLoading(false));
    };
    load();
    // Auto-refresh cada 30 segundos
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const totalCanchas = complejos.reduce((acc, c) => acc + c._count.canchas, 0);

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text">Dashboard</h1>
          <p className="mt-1 text-sm text-text-muted">Gestión de complejos y canchas</p>
        </div>
        <Link href="/owner/canchas/nueva"
          className="rounded-xl bg-grass px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-grass-light transition-colors">
          + Nueva cancha
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3 mb-10">
        <StatCard label="Complejos" value={loading ? "—" : complejos.length} icon="🏟️" />
        <StatCard label="Canchas" value={loading ? "—" : totalCanchas} icon="⚽" />
        <StatCard label="Reservas hoy" value={loading ? "—" : reservasHoy} icon="📅" />
      </div>

      {/* Reservas activas en tiempo real */}
      {reservasActivas.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Reservas activas hoy</h2>
            <span className="text-xs text-grass-light flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-grass opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-grass"></span>
              </span>
              En vivo
            </span>
          </div>
          <div className="overflow-x-auto -mx-4 px-4">
            <div className="flex gap-3 min-w-max">
              {reservasActivas.map((r: any) => (
                <div key={r.id} className="rounded-xl border border-grass/20 bg-field/10 px-4 py-3 min-w-[220px]">
                  <p className="text-sm font-semibold text-text">{r.cancha.nombre}</p>
                  <p className="text-xs text-text-dim">{r.cancha.complejo.nombre}</p>
                  <p className="text-sm font-medium text-grass-light mt-2">
                    {new Date(r.slotInicio).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })} – {new Date(r.slotFin).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="text-xs text-text-dim mt-0.5">
                    {r.player.primerNombre} {r.player.apellidos}
                    {r.player.apodo && <span className="text-grass-light ml-1">@{r.player.apodo}</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-text">Mis complejos</h2>
        <Link href="/owner/complejos/nuevo" className="text-sm font-medium text-grass hover:text-grass-light">+ Nuevo complejo</Link>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1,2].map(i => <div key={i} className="h-44 animate-pulse rounded-2xl border border-border bg-surface" />)}
        </div>
      ) : complejos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
          <p className="text-text-muted text-base">No tenés complejos registrados.</p>
          <p className="text-sm text-text-dim mt-1">Creá uno para empezar a agregar canchas.</p>
          <Link href="/owner/complejos/nuevo" className="mt-4 inline-block text-sm font-medium text-grass hover:text-grass-light">
            Crear complejo →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {complejos.map(c => (
            <div key={c.id} className="rounded-2xl border border-border bg-surface p-6 shadow-sm hover:border-border-hover transition-all duration-150">
              <h3 className="font-semibold text-text text-base">{c.nombre}</h3>
              <p className="text-sm text-text-dim mt-1">{formatAddress(c)}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-field/40 px-3 py-1 text-xs font-medium text-grass-light">
                <span className="h-1.5 w-1.5 rounded-full bg-grass-light" />
                {c._count.canchas} cancha{c._count.canchas !== 1 ? "s" : ""}
              </span>
              {c.canchas.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border space-y-1">
                  {c.canchas.map(ch => (
                    <Link key={ch.id} href={`/owner/canchas/${ch.id}`}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-text-muted hover:text-grass hover:bg-surface-hover transition-colors">
                      <span>{ch.nombre}</span>
                      <span className="text-xs text-text-dim">{ch.tipo}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-text-muted">{label}</p>
        <span className="text-xl">{icon}</span>
      </div>
      <p className="text-3xl font-bold text-text tracking-tight">{value}</p>
    </div>
  );
}
