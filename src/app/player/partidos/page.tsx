"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface PartidoPublico {
  id: string;
  reserva: { slotInicio: string; slotFin: string; montoTotal: number; montoPagado: number };
  equipoA: { id: string; nombre: string } | null;
  equipoB: { id: string; nombre: string } | null;
  _count: { jugadores: number };
}

export default function CalendarioPage() {
  const [partidos, setPartidos] = useState<PartidoPublico[]>([]);
  const [loading, setLoading] = useState(true);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [ciudad, setCiudad] = useState("Medellin");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ fecha });
    if (ciudad) params.set("ciudad", ciudad);

    fetch(`/api/partidos?${params}`)
      .then((r) => r.json())
      .then((d) => setPartidos(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [fecha, ciudad]);

  return (
    <div className="p-6 lg:p-8 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-text mb-6">Partidos</h1>

      {/* Filtros */}
      <div className="flex gap-3 mb-6">
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
          className="flex-1 rounded-xl border border-border bg-field px-4 py-2.5 text-sm text-text" />
        <input type="text" value={ciudad} onChange={(e) => setCiudad(e.target.value)}
          placeholder="Ciudad" className="w-32 rounded-xl border border-border bg-field px-4 py-2.5 text-sm text-text" />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-surface" />
          ))}
        </div>
      ) : partidos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
          <p className="text-text-muted">No hay partidos para esta fecha.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {partidos.map((p) => {
            const hora = new Date(p.reserva.slotInicio).toLocaleTimeString("es-CO", {
              hour: "2-digit", minute: "2-digit",
            });
            const progreso = Math.round((p.reserva.montoPagado / p.reserva.montoTotal) * 100) || 0;

            return (
              <Link key={p.id} href={`/player/partidos/${p.id}`}
                className="rounded-2xl border border-border bg-surface p-4 shadow-sm hover:border-grass/30 transition-colors block">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-text">{hora}</span>
                  <span className="text-xs text-text-dim">{p._count.jugadores} jug.</span>
                </div>
                <p className="text-sm font-semibold text-text mb-1">
                  {p.equipoA?.nombre || "Equipo A"}
                  {p.equipoB ? ` vs ${p.equipoB.nombre}` : " — Buscan rival"}
                </p>
                {progreso < 100 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-field overflow-hidden">
                      <div className="h-full rounded-full bg-yellow-400" style={{ width: `${progreso}%` }} />
                    </div>
                    <span className="text-xs text-yellow-400">{progreso}% pago</span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
