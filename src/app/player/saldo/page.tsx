"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatearFecha } from "@/lib/zona-horaria";

interface SaldoData {
  saldoPendiente: number;
  bloqueado: boolean;
  reservasPendientes: {
    id: string;
    cancha: string;
    complejo: string;
    tipo: string;
    fecha: string;
    zonaHoraria: string;
    montoTotal: number;
    montoPagado: number;
    saldoPendiente: number;
    progreso: number;
  }[];
}

interface PartidoResumen {
  id: string;
  cancha: { nombre: string; tipo: string; complejo: { nombre: string; zonaHoraria: string } };
  fecha: string;
  total: number;
  pagado: number;
  pendiente: number;
  progreso: number;
  jugadores: number;
  soyCreador: boolean;
}

export default function PerfilPagosPage() {
  const [saldo, setSaldo] = useState<SaldoData | null>(null);
  const [partidos, setPartidos] = useState<PartidoResumen[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/me/saldo").then((r) => r.json()),
      fetch("/api/me/partidos").then((r) => r.json()),
    ]).then(([saldoData, partidosData]) => {
      setSaldo(saldoData);
      setPartidos(Array.isArray(partidosData) ? partidosData : []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-lg mx-auto space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl border border-border bg-surface" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-text mb-6">Mis Pagos</h1>

      {/* Saldo pendiente */}
      {saldo && saldo.saldoPendiente > 0 && (
        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-yellow-400">⚠️ Saldo pendiente</p>
            <p className="text-lg font-bold text-yellow-400">
              {saldo.saldoPendiente.toLocaleString("es-CO")} COP
            </p>
          </div>
          <p className="text-xs text-text-dim">
            No podés hacer nuevas reservas hasta regularizar tus pagos.
          </p>
        </div>
      )}

      {/* Reservas pendientes */}
      {saldo && saldo.reservasPendientes.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
            Reservas con saldo pendiente
          </h2>
          <div className="space-y-3">
            {saldo.reservasPendientes.map((r) => (
              <div key={r.id} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-text">{r.cancha}</p>
                    <p className="text-xs text-text-dim">{r.complejo} · {r.tipo}</p>
                  </div>
                  <span className="text-xs text-text-dim">
                    {formatearFecha(r.fecha, r.zonaHoraria)}
                  </span>
                </div>

                <div className="mb-2">
                  <div className="flex justify-between text-xs text-text-dim mb-1">
                    <span>{Math.round((r.montoPagado / r.montoTotal) * 100)}% pagado</span>
                    <span>{r.montoPagado.toLocaleString("es-CO")} / {r.montoTotal.toLocaleString("es-CO")}</span>
                  </div>
                  <div className="h-2 rounded-full bg-field overflow-hidden">
                    <div className="h-full rounded-full bg-grass transition-all"
                      style={{ width: `${r.progreso}%` }} />
                  </div>
                </div>

                <Link href={`/player/reservar/${r.id}/pagar-saldo`}
                  className="text-sm font-medium text-grass hover:text-grass-light">
                  Pagar saldo ({r.saldoPendiente.toLocaleString("es-CO")} COP) →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mis partidos */}
      <div>
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Mis partidos
        </h2>
        {partidos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
            <p className="text-sm text-text-muted">No tenés partidos todavía.</p>
            <p className="text-xs text-text-dim mt-1">Reservá una cancha y creá un partido.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {partidos.map((p) => (
              <Link key={p.id} href={`/player/partidos/${p.id}`}
                className="rounded-2xl border border-border bg-surface p-4 shadow-sm hover:border-grass/30 transition-colors block">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-text">{p.cancha.nombre}</p>
                  <span className="text-xs text-text-dim">
                    {formatearFecha(p.fecha, p.cancha.complejo.zonaHoraria)}
                  </span>
                </div>
                <p className="text-xs text-text-dim mb-2">{p.cancha.complejo.nombre}</p>

                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-1.5 rounded-full bg-field overflow-hidden">
                    <div className="h-full rounded-full bg-grass transition-all"
                      style={{ width: `${p.progreso}%` }} />
                  </div>
                  <span className="text-xs text-text-dim">{p.progreso}%</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-dim">
                    {p.pagado.toLocaleString("es-CO")} / {p.total.toLocaleString("es-CO")} COP
                  </span>
                  <span className="text-text-dim">{p.jugadores} jugador{p.jugadores !== 1 ? "es" : ""}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
