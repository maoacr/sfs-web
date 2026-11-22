"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatAddress } from "@/lib/address";
import { fechaHoy, formatearHora } from "@/lib/zona-horaria";
import { apiFetch } from "@/lib/api-client";
import { RegistrarPago, type ReservaACobrar } from "@/components/registrar-pago";
import { ConfirmarCancelacion } from "@/components/confirmar-cancelacion";
import { sePuedeCobrar, sePuedeMarcarJugada, sePuedeCancelar } from "@/lib/acciones-de-reserva";

interface Complejo { id: string; nombre: string; direccion: string; canchas: { id: string; nombre: string; tipo: string }[]; }

interface ReservaDeHoy {
  id: string;
  cancha: { nombre: string; tipo?: string; complejo: { nombre: string; zonaHoraria: string } };
  player: { primerNombre: string; apellidos: string; apodo: string | null; telefono?: string | null };
  slotInicio: string;
  slotFin: string;
  estado: string;
  montoTotal: number;
  montoPagado: number;
  saldoPendiente: number;
  /** Null cuando la reserva está vinculada a una cuenta real. */
  invitadoNombre: string | null;
  /** El último intento de pago: es lo que explica por qué no se acreditó. */
  ultimoPago: { estadoPago: string; detalleEstado: string | null; monto: number; createdAt: string } | null;
}

const formatearPrecio = (monto: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(monto);

const nombreDe = (reserva: ReservaDeHoy) =>
  reserva.invitadoNombre ?? `${reserva.player.primerNombre} ${reserva.player.apellidos}`.trim();

/** El API serializa los decimales como string; las decisiones piden números. */
const accionable = (reserva: ReservaDeHoy) => ({
  estado: reserva.estado,
  saldoPendiente: Number(reserva.saldoPendiente),
});

/** Cuántas reservas se listan como tarjeta antes de cortar. */
const TARJETAS_VISIBLES = 5;

/**
 * El partido se jugó y la reserva está cerrada. Es lo único que el panel saca
 * de la lista de tarjetas: desde el mostrador, un turno ya cerrado no es algo
 * que haya que atender. Sigue contando en "Reservas hoy", porque jugarse no la
 * borra del día.
 */
const ESTADO_CERRADO = "COMPLETADA";

/** Cada cuánto se repregunta. El dueño deja el panel abierto en el mostrador. */
const REFRESCO_MS = 10_000;

export default function OwnerDashboard() {
  const router = useRouter();
  const [complejos, setComplejos] = useState<Complejo[]>([]);
  const [loading, setLoading] = useState(true);

  const [reservasDeHoy, setReservasDeHoy] = useState<ReservaDeHoy[]>([]);
  const [verDetalleDe, setVerDetalleDe] = useState<ReservaDeHoy | null>(null);
  const [recargas, setRecargas] = useState(0);

  useEffect(() => {
    const load = () => {
      Promise.all([
        fetch("/api/complejos").then(r => r.json()),
        // `fecha` se manda SIEMPRE con el día de hoy: el API lee la fecha vacía
        // como "no filtres" y devolvía la historia entera, así que la sección
        // "hoy" mostraba reservas de cualquier día. Y `efectivas` en vez de un
        // estado suelto, porque una reserva con abono también es una reserva:
        // pedir sólo CONFIRMADA escondía las de PAGO_PARCIAL.
        fetch(`/api/reservas?fecha=${fechaHoy()}&efectivas=true`).then(r => r.json()),
      ]).then(([complejosData, reservasData]) => {
        setComplejos(Array.isArray(complejosData) ? complejosData : []);
        setReservasDeHoy(Array.isArray(reservasData) ? reservasData : []);
      }).catch(console.error).finally(() => setLoading(false));
    };
    load();
    const interval = setInterval(load, REFRESCO_MS);
    return () => clearInterval(interval);
    // `recargas` reinicia el intervalo además de repreguntar, y está bien: tras
    // una acción conviene que el próximo refresco cuente desde cero.
  }, [recargas]);

  function recargar() {
    setVerDetalleDe(null);
    setRecargas(n => n + 1);
  }

  const totalCanchas = complejos.reduce((acc, c) => acc + c.canchas.length, 0);

  // Dos preguntas distintas sobre la MISMA respuesta: cuántas reservas hubo hoy
  // (el contador) y qué falta cerrar (las tarjetas). Un segundo fetch para esto
  // sería pedirle dos veces lo mismo al servidor para filtrar distinto.
  const pendientesPorCompletar = reservasDeHoy.filter(r => r.estado !== ESTADO_CERRADO);

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
        <StatCard label="Reservas hoy" value={loading ? "—" : reservasDeHoy.length} icon="📅" />
      </div>

      {/* Lo que falta cerrar hoy, repreguntado cada REFRESCO_MS */}
      {pendientesPorCompletar.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Pendientes de completar</h2>
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
              {pendientesPorCompletar.slice(0, TARJETAS_VISIBLES).map(r => (
                <button key={r.id} type="button" onClick={() => setVerDetalleDe(r)}
                  className="rounded-xl border border-grass/20 bg-field/10 px-4 py-3 min-w-[220px] text-left hover:border-grass/50 transition-colors">
                  <p className="text-sm font-semibold text-text">{r.cancha.nombre}</p>
                  <p className="text-xs text-text-dim">{r.cancha.complejo.nombre}</p>
                  <p className="text-sm font-medium text-grass-light mt-2">
                    {formatearHora(r.slotInicio, r.cancha.complejo.zonaHoraria)} – {formatearHora(r.slotFin, r.cancha.complejo.zonaHoraria)}
                  </p>
                  <p className="text-xs text-text-dim mt-0.5">
                    {nombreDe(r)}
                    {r.player.apodo && !r.invitadoNombre && <span className="text-grass-light ml-1">@{r.player.apodo}</span>}
                  </p>
                  {Number(r.saldoPendiente) > 0 && (
                    <p className="text-xs text-warning mt-1.5">
                      Debe {formatearPrecio(Number(r.saldoPendiente))}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {verDetalleDe && (
        <DetalleDeReserva
          reserva={verDetalleDe}
          onCerrar={() => setVerDetalleDe(null)}
          onCambio={recargar}
        />
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
            <Link key={c.id} href={`/owner/complejos/${c.id}`} className="rounded-2xl border border-border bg-surface p-6 shadow-sm hover:border-grass/30 hover:shadow-md transition-all duration-150 block">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-text text-base">{c.nombre}</h3>
                  <p className="text-sm text-text-dim mt-1">{formatAddress(c)}</p>
                </div>
                <span className="text-text-dim text-xs group-hover:text-grass-light">Gestionar →</span>
              </div>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-field/40 px-3 py-1 text-xs font-medium text-grass-light">
                <span className="h-1.5 w-1.5 rounded-full bg-grass-light" />
                {c.canchas.length} cancha{c.canchas.length !== 1 ? "s" : ""}
              </span>
              {c.canchas.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border space-y-1">
                  {c.canchas.map(ch => (
                    <div key={ch.id}
                      onClick={(e) => { e.stopPropagation(); router.push(`/owner/canchas/${ch.id}`); }}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-text-muted hover:text-grass hover:bg-surface-hover transition-colors cursor-pointer">
                      <span>{ch.nombre}</span>
                      <span className="text-xs text-text-dim">{ch.tipo}</span>
                    </div>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * El detalle de una reserva con las acciones del mostrador.
 *
 * No consulta nada: toda la data —la plata, el titular, el último intento de
 * pago— ya viene en la respuesta de `GET /api/reservas`, así que abrir el
 * detalle no cuesta un viaje más al servidor.
 *
 * Qué acciones se ofrecen lo decide `acciones-de-reserva.ts`, el mismo módulo
 * que usa `/owner/reservas`. Las dos pantallas pintan distinto pero no pueden
 * decidir distinto.
 */
function DetalleDeReserva({ reserva, onCerrar, onCambio }: {
  reserva: ReservaDeHoy;
  onCerrar: () => void;
  onCambio: () => void;
}) {
  const [cobrando, setCobrando] = useState<ReservaACobrar | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zona = reserva.cancha.complejo.zonaHoraria;
  const titular = nombreDe(reserva);
  const horario = `${formatearHora(reserva.slotInicio, zona)} – ${formatearHora(reserva.slotFin, zona)}`;
  const saldo = Number(reserva.saldoPendiente);

  async function cambiarEstado(estado: string) {
    setError(null);
    const res = await apiFetch(`/api/reservas/${reserva.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });

    if (!res.ok) {
      const detalle = await res.json().catch(() => null);
      return setError(detalle?.error ?? "No pudimos actualizar la reserva. Intentá de nuevo.");
    }
    onCambio();
  }

  // Mientras se cobra o se confirma la cancelación, el detalle se aparta: dos
  // diálogos encimados dejan al teclado sin saber dónde está.
  if (cobrando) {
    return (
      <RegistrarPago
        reserva={cobrando}
        onCerrar={() => setCobrando(null)}
        onRegistrado={onCambio}
      />
    );
  }

  if (cancelando) {
    return (
      <ConfirmarCancelacion
        reserva={{
          titular,
          cancha: reserva.cancha.nombre,
          horario,
          montoPagado: Number(reserva.montoPagado ?? 0),
        }}
        onCerrar={() => setCancelando(false)}
        onConfirmar={() => { setCancelando(false); cambiarEstado("CANCELADA"); }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <div role="dialog" aria-labelledby="titulo-detalle"
        className="w-full max-w-md rounded-t-2xl border border-border bg-bg p-5 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="titulo-detalle" className="text-lg font-bold text-text">{reserva.cancha.nombre}</h2>
            <p className="text-sm text-text-muted">
              {reserva.cancha.complejo.nombre}
              {reserva.cancha.tipo && <span className="text-text-dim"> · {reserva.cancha.tipo}</span>}
            </p>
          </div>
          <button onClick={onCerrar} type="button" aria-label="Cerrar el detalle"
            className="rounded-lg border border-border px-2.5 py-1 text-sm text-text-muted hover:bg-surface-hover">
            ✕
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-text">
            {error}
          </p>
        )}

        <dl className="mt-4 space-y-2 rounded-xl border border-border bg-surface p-3 text-sm">
          <Dato termino="Horario" valor={horario} />
          <Dato termino="Jugador" valor={titular} />
          {reserva.invitadoNombre && (
            <Dato termino="Cuenta" valor="Invitado sin cuenta en el sistema" />
          )}
          {reserva.player.telefono && !reserva.invitadoNombre && (
            <Dato termino="Teléfono" valor={reserva.player.telefono} />
          )}
          <Dato termino="Estado" valor={reserva.estado} />
        </dl>

        <dl className="mt-3 space-y-2 rounded-xl border border-border bg-surface p-3 text-sm">
          <Dato termino="Total" valor={formatearPrecio(Number(reserva.montoTotal))} />
          <Dato termino="Pagado" valor={formatearPrecio(Number(reserva.montoPagado))} />
          <Dato termino="Saldo" valor={formatearPrecio(saldo)}
            resaltado={saldo > 0 ? "text-warning font-semibold" : undefined} />
        </dl>

        {reserva.ultimoPago && (
          <div className="mt-3 rounded-xl border border-border bg-surface p-3 text-sm">
            <p className="text-xs uppercase tracking-wider text-text-dim">Último intento de pago</p>
            <p className="mt-1 text-text">
              {formatearPrecio(Number(reserva.ultimoPago.monto))} ·{" "}
              <span className={reserva.ultimoPago.estadoPago === "APROBADO" ? "text-grass" : "text-error"}>
                {reserva.ultimoPago.estadoPago}
              </span>
            </p>
            {reserva.ultimoPago.detalleEstado && (
              <p className="mt-0.5 text-xs text-text-dim">{reserva.ultimoPago.detalleEstado}</p>
            )}
          </div>
        )}

        <div className="mt-5 space-y-2">
          {sePuedeCobrar(accionable(reserva)) && (
            <button type="button"
              onClick={() => setCobrando({
                id: reserva.id,
                saldoPendiente: saldo,
                titular,
                estado: reserva.estado,
              })}
              className="min-h-11 w-full rounded-xl bg-grass px-4 text-sm font-semibold text-white hover:bg-grass-light">
              Cobrar {formatearPrecio(saldo)}
            </button>
          )}

          <div className="flex gap-2">
            {sePuedeMarcarJugada(accionable(reserva)) && (
              <button type="button" onClick={() => cambiarEstado("COMPLETADA")}
                aria-label={`Marcar como jugada la reserva de ${titular}`}
                className="min-h-11 flex-1 rounded-xl border border-border px-4 text-sm font-medium text-text-muted hover:border-grass hover:text-grass">
                Marcar jugada
              </button>
            )}
            {sePuedeCancelar(accionable(reserva)) && (
              <button type="button" onClick={() => setCancelando(true)}
                aria-label={`Cancelar la reserva de ${titular}`}
                className="min-h-11 flex-1 rounded-xl border border-border px-4 text-sm font-medium text-text-muted hover:border-error hover:text-error">
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Dato({ termino, valor, resaltado }: { termino: string; valor: string; resaltado?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-dim">{termino}</dt>
      <dd className={resaltado ?? "text-text"}>{valor}</dd>
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
