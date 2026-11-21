"use client";

import { useCallback, useEffect, useState } from "react";
import { formatearFecha, formatearHora } from "@/lib/zona-horaria";
import { RegistrarPago, type ReservaACobrar } from "@/components/registrar-pago";

interface Deuda {
  id: string;
  cancha: { nombre: string; tipo: string; complejo: { nombre: string; zonaHoraria: string } };
  player: { primerNombre: string; apellidos: string; apodo: string | null; telefono: string | null };
  slotInicio: string;
  slotFin: string;
  /**
   * Derivado al traer los datos y no en el render: `Date.now()` durante el
   * render es impuro y da resultados distintos en cada repintado. Acá además
   * es lo correcto semánticamente — es una foto del momento de la consulta.
   */
  yaSeJugo: boolean;
  montoTotal: number;
  montoPagado: number;
  saldoPendiente: number;
  estado: string;
}

const fPrecio = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

const nombreDe = (p: Deuda["player"]) => `${p.primerNombre} ${p.apellidos}`.trim();

/**
 * Cuentas por cobrar.
 *
 * Deber no es un estado: una reserva puede estar PENDIENTE_PAGO, PAGO_PARCIAL
 * o COMPLETADA —el partido se jugó y quedó debiendo— y en los tres casos hay
 * plata que cobrar. Por eso el filtro del API es por saldo y no por estado.
 *
 * Sin esta pantalla la deuda era invisible: ninguna vista del dueño mostraba
 * el saldo, así que nadie podía cobrar lo que no veía.
 */
export default function OwnerCobros() {
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [loading, setLoading] = useState(true);
  const [cobrando, setCobrando] = useState<ReservaACobrar | null>(null);

  const cargar = useCallback(() => {
    fetch("/api/reservas?conSaldo=true")
      .then(r => r.json())
      .then((data: Omit<Deuda, "yaSeJugo">[]) => {
        const ahora = Date.now();
        setDeudas(
          (Array.isArray(data) ? data : []).map(d => ({
            ...d,
            yaSeJugo: new Date(d.slotFin).getTime() < ahora,
          }))
        );
      })
      .catch(() => setDeudas([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const total = deudas.reduce((acc, d) => acc + Number(d.saldoPendiente), 0);

  return (
    <div className="p-4 pb-28 sm:p-6 md:pb-8 lg:p-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-text">Cuentas por cobrar</h1>
        <p className="mt-1 text-sm text-text-muted">
          Reservas con saldo pendiente. Registrá acá lo que cobres en efectivo o por transferencia.
        </p>
      </header>

      {!loading && deudas.length > 0 && (
        <div className="mb-6 rounded-2xl border border-warning/30 bg-warning/10 p-4">
          <p className="text-xs uppercase tracking-wider text-text-muted">Total por cobrar</p>
          <p className="mt-1 text-2xl font-bold text-text">{fPrecio(total)}</p>
          <p className="mt-1 text-xs text-text-muted">
            {deudas.length} {deudas.length === 1 ? "reserva" : "reservas"}
          </p>
        </div>
      )}

      {loading ? (
        <div role="status" aria-label="Cargando las cuentas por cobrar" className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-surface" />)}
        </div>
      ) : deudas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center sm:p-14">
          <p className="text-base text-text-muted">No hay nada por cobrar. Todo al día.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {deudas.map(d => {
            const zona = d.cancha.complejo.zonaHoraria;

            return (
              <li key={d.id} className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-text">{nombreDe(d.player)}</p>
                    {d.player.telefono && (
                      <a href={`tel:${d.player.telefono}`} className="text-sm text-grass hover:text-grass-light">
                        {d.player.telefono}
                      </a>
                    )}
                    <p className="mt-1 text-sm text-text-muted">
                      {d.cancha.nombre} · {d.cancha.complejo.nombre}
                    </p>
                    <p className="text-sm text-text-muted">
                      <time dateTime={d.slotInicio}>
                        {formatearFecha(d.slotInicio, zona, { weekday: "long", day: "numeric", month: "long" })}
                        {" · "}
                        {formatearHora(d.slotInicio, zona)}
                      </time>
                      {d.yaSeJugo && <span className="ml-2 text-xs text-warning">ya se jugó</span>}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-text-muted">Debe</p>
                    <p className="text-lg font-bold text-warning">{fPrecio(Number(d.saldoPendiente))}</p>
                    <p className="text-xs text-text-dim">
                      de {fPrecio(Number(d.montoTotal))}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setCobrando({
                    id: d.id,
                    saldoPendiente: Number(d.saldoPendiente),
                    titular: nombreDe(d.player),
                  })}
                  className="mt-4 min-h-11 w-full rounded-xl bg-grass px-4 text-sm font-semibold text-white hover:bg-grass-light sm:w-auto">
                  Registrar pago
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {cobrando && (
        <RegistrarPago
          reserva={cobrando}
          onCerrar={() => setCobrando(null)}
          onRegistrado={() => { setCobrando(null); cargar(); }}
        />
      )}
    </div>
  );
}
