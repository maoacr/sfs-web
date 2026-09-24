"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatearFecha } from "@/lib/zona-horaria";

interface JugadorInfo {
  userId: string;
  nombre: string;
  apodo: string | null;
  montoPagado: number;
  esCreador: boolean;
}

interface PartidoDetail {
  id: string;
  reservaId: string;
  zonaHoraria: string;
  cancha: { nombre: string; tipo: string; complejo: { nombre: string; ciudad: string } };
  fecha: string;
  duracion: string;
  equipoA: { id: string; nombre: string } | null;
  equipoB: { id: string; nombre: string } | null;
  estado: string;
  total: number;
  pagado: number;
  pendiente: number;
  progreso: number;
  jugadores: JugadorInfo[];
  puedePagar: boolean;
}

export default function PartidoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [partido, setPartido] = useState<PartidoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pagando, setPagando] = useState(false);

  useEffect(() => {
    fetch(`/api/partidos/${id}`)
      .then((r) => r.json())
      .then((d) => setPartido(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const pagarSaldo = async () => {
    if (!partido || partido.pendiente <= 0) return;
    setPagando(true);

    const res = await fetch(`/api/reservas/${partido.reservaId}/pagar-saldo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monto: partido.pendiente }),
    });

    const data = await res.json();

    if (res.ok && data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    } else {
      alert(data.error || "Error al iniciar pago");
    }
    setPagando(false);
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-lg mx-auto space-y-4">
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-surface" />
      </div>
    );
  }

  if (!partido) {
    return (
      <div className="p-6 lg:p-8 max-w-lg mx-auto text-center">
        <p className="text-text-muted">Partido no encontrado</p>
        <Link href="/player/saldo" className="text-sm text-grass mt-2 inline-block">← Volver</Link>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-lg mx-auto">
      <Link href="/player/saldo" className="text-sm text-text-dim hover:text-grass mb-6 inline-block">
        ← Mis pagos
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-text">{partido.cancha.nombre}</h1>
            <p className="text-sm text-text-dim">{partido.cancha.complejo.nombre}</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-field text-text-dim">
            {partido.estado === "CONFIRMADA" ? "✅ Confirmada" :
             partido.estado === "PAGO_PARCIAL" ? "💳 Pago parcial" :
             partido.estado}
          </span>
        </div>

        <div className="flex gap-4 text-sm text-text-dim mb-4">
          <span>📅 {formatearFecha(partido.fecha, partido.zonaHoraria)}</span>
          <span>🕐 {partido.duracion}</span>
        </div>

        {partido.equipoA && (
          <p className="text-sm text-text mb-2">
            ⚽ {partido.equipoA.nombre}
            {partido.equipoB && <> vs {partido.equipoB.nombre}</>}
          </p>
        )}

        {/* Progreso de pago */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-text-muted">Progreso de pago</span>
            <span className="text-text font-semibold">{partido.progreso}%</span>
          </div>
          <div className="h-3 rounded-full bg-field overflow-hidden mb-2">
            <div className="h-full rounded-full bg-grass transition-all"
              style={{ width: `${partido.progreso}%` }} />
          </div>
          <div className="flex justify-between text-xs text-text-dim">
            <span>{partido.pagado.toLocaleString("es-CO")} COP</span>
            <span>{partido.total.toLocaleString("es-CO")} COP</span>
          </div>
        </div>

        {partido.pendiente > 0 && (
          <p className="mt-3 text-sm font-semibold text-yellow-400">
            ⚠️ Pendiente: {partido.pendiente.toLocaleString("es-CO")} COP
          </p>
        )}
      </div>

      {/* Jugadores */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Jugadores ({partido.jugadores.length})
        </h2>
        <div className="space-y-2">
          {partido.jugadores.map((j) => (
            <div key={j.userId}
              className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-text">{j.nombre}</span>
                {j.apodo && <span className="text-xs text-text-dim">@{j.apodo}</span>}
                {j.esCreador && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-grass/10 text-grass-light">Creador</span>
                )}
              </div>
              <span className="text-sm text-text">
                {j.montoPagado > 0
                  ? `${j.montoPagado.toLocaleString("es-CO")} COP`
                  : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Botón pagar */}
      {partido.puedePagar && (
        <button onClick={pagarSaldo} disabled={pagando}
          className="w-full rounded-xl bg-grass px-5 py-3 text-sm font-semibold text-white hover:bg-grass-light transition-colors disabled:opacity-50">
          {pagando ? "Procesando..." : `Pagar saldo (${partido.pendiente.toLocaleString("es-CO")} COP)`}
        </button>
      )}
    </div>
  );
}
