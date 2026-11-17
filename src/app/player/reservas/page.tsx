"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatearFecha, formatearHora } from "@/lib/zona-horaria";
import { apiFetch } from "@/lib/api-client";

interface Reserva {
  id: string; cancha: { nombre: string; tipo: string; complejo: { nombre: string; zonaHoraria: string } };
  slotInicio: string; slotFin: string; montoTotal: number; saldoPendiente: number; estado: string;
}

const ESTADOS: Record<string, { label: string; color: string }> = {
  PENDIENTE_PAGO: { label: "Pendiente", color: "bg-warning/20 text-warning border-warning/20" },
  PAGO_PARCIAL: { label: "Pago parcial", color: "bg-warning/20 text-warning border-warning/20" },
  CONFIRMADA: { label: "Confirmada", color: "bg-grass/20 text-grass-light border-grass/20" },
  COMPLETADA: { label: "Completada", color: "bg-text-dim/20 text-text-dim border-text-dim/10" },
  CANCELADA: { label: "Cancelada", color: "bg-error/20 text-error border-error/20" },
  EXPIRADA: { label: "Expirada", color: "bg-text-dim/20 text-text-dim border-text-dim/10" },
};

/**
 * Los baldes se arman por exclusión, no por lista blanca: un estado nuevo en el
 * enum aparece entre las activas en vez de desaparecer de la pantalla sin aviso.
 */
const TERMINALES = new Set(["COMPLETADA", "CANCELADA", "EXPIRADA"]);

export default function PlayerReservas() {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reservas").then(r => r.json()).then(setReservas).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function pagarSaldo(r: Reserva) {
    const res = await apiFetch(`/api/reservas/${r.id}/pagar-saldo`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monto: Number(r.saldoPendiente) }),
    });
    const data = await res.json();
    if (data.checkoutUrl) window.location.href = data.checkoutUrl;
  }

  async function cancelar(id: string) {
    await apiFetch(`/api/reservas/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado: "CANCELADA" }) });
    setReservas(prev => prev.map(r => r.id === id ? { ...r, estado: "CANCELADA" } : r));
  }


  const fPrecio = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

  const activas = reservas.filter(r => !TERMINALES.has(r.estado));
  const pasadas = reservas.filter(r => TERMINALES.has(r.estado));

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Mis reservas</h1>
        <p className="mt-1 text-sm text-text-muted">Historial de canchas reservadas</p>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-surface border border-border" />)}</div>
      ) : reservas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-14 text-center">
          <p className="text-text-muted text-base">No tenés reservas todavía.</p>
          <Link href="/player/buscar" className="mt-4 inline-block text-sm font-medium text-grass hover:text-grass-light">Buscar canchas →</Link>
        </div>
      ) : (
        <div className="space-y-8">
          {activas.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">Próximas</h2>
              <div className="space-y-3">
                {activas.map(r => <ReservaCard key={r.id} r={r} cancelar={cancelar} pagarSaldo={pagarSaldo} fPrecio={fPrecio} />)}
              </div>
            </section>
          )}
          {pasadas.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">Historial</h2>
              <div className="space-y-3">
                {pasadas.map(r => <ReservaCard key={r.id} r={r} cancelar={cancelar} pagarSaldo={pagarSaldo} fPrecio={fPrecio} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function ReservaCard({ r, cancelar, pagarSaldo, fPrecio }: {
  r: Reserva; cancelar: (id: string) => void; pagarSaldo: (r: Reserva) => void;
  fPrecio: (n: number) => string;
}) {
  const s = ESTADOS[r.estado];
  const saldo = Number(r.saldoPendiente ?? 0);
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-4">
          <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-xl bg-field/30 text-xl shrink-0">⚽</div>
          <div>
            <p className="font-semibold text-text">{r.cancha.nombre}</p>
            <p className="text-sm text-text-muted">{r.cancha.complejo.nombre} — {r.cancha.tipo}</p>
            <p className="text-sm text-text-muted mt-1">
              {formatearFecha(r.slotInicio, r.cancha.complejo.zonaHoraria, { weekday: "long", day: "numeric", month: "long" })} · {formatearHora(r.slotInicio, r.cancha.complejo.zonaHoraria)} – {formatearHora(r.slotFin, r.cancha.complejo.zonaHoraria)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:flex-col sm:items-end">
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${s?.color}`}>{s?.label}</span>
          <span className="text-sm font-semibold text-text">{fPrecio(Number(r.montoTotal))}</span>
          {saldo > 0 && (
            <span className="text-xs text-warning">Saldo pendiente: {fPrecio(saldo)}</span>
          )}
          {saldo > 0 && !TERMINALES.has(r.estado) && (
            <button onClick={() => pagarSaldo(r)}
              className="rounded-lg bg-grass px-3 py-1.5 text-xs font-semibold text-white hover:bg-grass-light transition-colors">Pagar saldo</button>
          )}
          {!TERMINALES.has(r.estado) && (
            <button onClick={() => cancelar(r.id)}
              className="text-xs text-text-dim hover:text-error transition-colors font-medium">Cancelar</button>
          )}
        </div>
      </div>
    </div>
  );
}
