"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatearFecha, formatearHora } from "@/lib/zona-horaria";
import { apiFetch } from "@/lib/api-client";
import { explicarPago, explicarVueltaDeMp, sePuedeReintentarElPago } from "@/lib/resultado-pago";
import { formatearPrecio } from "@/lib/moneda";

interface UltimoPago {
  estadoPago: string;
  detalleEstado: string | null;
  /** Hace falta para medir la espera tras un rechazo por duplicado. */
  createdAt: string;
}

interface Reserva {
  id: string; cancha: { nombre: string; tipo: string; complejo: { nombre: string; zonaHoraria: string } };
  slotInicio: string; slotFin: string; montoTotal: number; montoPagado: number; saldoPendiente: number; estado: string;
  ultimoPago?: UltimoPago | null;
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

function Esqueleto() {
  return (
    <div role="status" aria-label="Cargando tus reservas" className="space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface border border-border" />)}
    </div>
  );
}

/**
 * `useSearchParams` obliga a una frontera de Suspense: sin ella Next no puede
 * prerenderizar la página y el build falla. La cáscara estática queda afuera y
 * sólo lo que depende de la query espera adentro.
 */
export default function PlayerReservasPage() {
  return (
    <Suspense fallback={<div className="p-4 pb-28 sm:p-6 md:pb-8 lg:p-8"><Esqueleto /></div>}>
      <PlayerReservas />
    </Suspense>
  );
}

function PlayerReservas() {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // MercadoPago devuelve al jugador con `status` en la query. Es lo primero
  // que sabemos del resultado —el webhook puede tardar— así que es lo que le
  // mostramos apenas vuelve. Si no lo entendemos, no se muestra nada: la
  // tarjeta ya cuenta la verdad y viene de la base, no de la URL.
  const statusDeMp = useSearchParams().get("status");
  const vuelta = explicarVueltaDeMp(statusDeMp);

  useEffect(() => {
    fetch("/api/reservas").then(respuesta => respuesta.json()).then(setReservas).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function pagarSaldo(reserva: Reserva) {
    setError(null);
    // Sin `monto`: el saldo lo decide el servidor al momento de cobrar. Un
    // número traído en el `fetch` de hace diez minutos puede estar viejo —un
    // compañero pudo abonar, o el dueño registrar efectivo— y acá hay plata.
    const res = await apiFetch(`/api/reservas/${reserva.id}/pagar-saldo`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.checkoutUrl) {
      setError(data?.error ?? "No pudimos iniciar el pago. Intentá de nuevo en un momento.");
      return;
    }
    window.location.href = data.checkoutUrl;
  }

  async function cancelar(id: string) {
    await apiFetch(`/api/reservas/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado: "CANCELADA" }) });
    setReservas(prev => prev.map(reserva => reserva.id === id ? { ...reserva, estado: "CANCELADA" } : reserva));
  }


  // Las dos secciones quieren órdenes opuestos y por eso se ordenan acá, donde
  // se sabe qué significa cada una: en las próximas interesa la que viene
  // primero, y en el historial lo último que pasó. Dejarlo librado al orden
  // del API hacía que el historial mostrara arriba la reserva más vieja.
  const porFecha = (dir: 1 | -1) => (a: Reserva, b: Reserva) =>
    dir * (new Date(a.slotInicio).getTime() - new Date(b.slotInicio).getTime());

  const activas = reservas.filter(reserva => !TERMINALES.has(reserva.estado)).sort(porFecha(1));
  const pasadas = reservas.filter(reserva => TERMINALES.has(reserva.estado)).sort(porFecha(-1));

  const secciones: { id: string; titulo: string; lista: Reserva[] }[] = [
    { id: "proximas", titulo: "Próximas", lista: activas },
    { id: "historial", titulo: "Historial", lista: pasadas },
  ];

  return (
    // `pb-28` deja aire para la BottomTabBar, que es fixed y taparía el final.
    <div className="p-4 pb-28 sm:p-6 md:pb-8 lg:p-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-text">Mis reservas</h1>
        <p className="mt-1 text-sm text-text-muted">Historial de canchas reservadas</p>
      </header>

      {vuelta && (
        <Aviso tono={vuelta.tono}>
          {vuelta.mensaje}
        </Aviso>
      )}

      {error && <Aviso tono="error">{error}</Aviso>}

      {loading ? (
        <Esqueleto />
      ) : reservas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center sm:p-14">
          <p className="text-text-muted text-base">No tenés reservas todavía.</p>
          <Link href="/player/buscar" className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-grass hover:text-grass-light">Buscar canchas →</Link>
        </div>
      ) : (
        <div className="space-y-8">
          {secciones.filter(seccion => seccion.lista.length > 0).map(seccion => (
            <section key={seccion.id} aria-labelledby={seccion.id}>
              <h2 id={seccion.id} className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">{seccion.titulo}</h2>
              <ul className="space-y-3">
                {seccion.lista.map(reserva => <ReservaCard key={reserva.id} reserva={reserva} cancelar={cancelar} pagarSaldo={pagarSaldo} formatearPrecio={formatearPrecio} />)}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

const TONOS = {
  ok: "border-grass/30 bg-grass/10 text-grass-light",
  error: "border-error/30 bg-error/10 text-text",
  espera: "border-warning/30 bg-warning/10 text-text",
} as const;

function Aviso({ tono, children }: { tono: keyof typeof TONOS; children: React.ReactNode }) {
  return (
    <div role="alert" className={`mb-6 rounded-xl border p-4 text-sm ${TONOS[tono]}`}>
      {children}
    </div>
  );
}

function ReservaCard({ reserva, cancelar, pagarSaldo, formatearPrecio }: {
  reserva: Reserva; cancelar: (id: string) => void; pagarSaldo: (reserva: Reserva) => void;
  formatearPrecio: (monto: number) => string;
}) {
  const [confirmando, setConfirmando] = useState(false);

  const estadoVisual = ESTADOS[reserva.estado];
  const saldo = Number(reserva.saldoPendiente ?? 0);
  const activa = !TERMINALES.has(reserva.estado);
  const zona = reserva.cancha.complejo.zonaHoraria;

  // Sólo explicamos cuando MercadoPago dijo algo concreto. Sin `detalleEstado`
  // no hay nada honesto que contar, y un mensaje vago asusta más que ayuda.
  const ultimo = reserva.ultimoPago;
  const explicacion = ultimo?.detalleEstado ? explicarPago(undefined, ultimo.detalleEstado) : null;

  // La decisión vive en `resultado-pago.ts` porque necesita dos cosas a la vez:
  // lo que dijo MercadoPago y cuánta plata entró en ESTA reserva. Calcularla
  // acá fue lo que dejó que un "duplicado" de MP —que mide entre sus
  // operaciones, no por reserva— escondiera el botón de una reserva en cero.
  const puedeReintentar = sePuedeReintentarElPago({
    montoPagado: Number(reserva.montoPagado),
    ultimoPago: ultimo ?? null,
  });

  const cuando = `${formatearFecha(reserva.slotInicio, zona, { weekday: "long", day: "numeric", month: "long" })} · ${formatearHora(reserva.slotInicio, zona)} – ${formatearHora(reserva.slotFin, zona)}`;
  // Los botones se leen fuera de contexto en un lector de pantalla: sin esto,
  // una lista de cinco reservas suena como cinco "Cancelar" idénticos.
  const cual = `${reserva.cancha.nombre}, ${cuando}`;

  const accion = "inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors sm:flex-none";

  return (
    <li className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-field/30 text-lg">⚽</span>

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-text">{reserva.cancha.nombre}</p>
          <p className="text-sm text-text-muted">{reserva.cancha.complejo.nombre} — {reserva.cancha.tipo}</p>
          <p className="mt-1 text-sm text-text-muted">
            <time dateTime={reserva.slotInicio}>{cuando}</time>
          </p>
        </div>

        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${estadoVisual?.color}`}>{estadoVisual?.label}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-t border-border pt-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text">{formatearPrecio(Number(reserva.montoTotal))}</p>
          {saldo > 0 && (
            <p className="text-xs text-warning">Saldo pendiente: {formatearPrecio(saldo)}</p>
          )}
        </div>

        {activa && !confirmando && (
          <div className="flex w-full gap-2 sm:w-auto">
            {saldo > 0 && puedeReintentar && (
              <button onClick={() => pagarSaldo(reserva)} aria-label={`Pagar saldo de ${cual}`}
                className={`${accion} bg-grass text-white hover:bg-grass-light`}>Pagar saldo</button>
            )}
            <button onClick={() => setConfirmando(true)} aria-label={`Cancelar la reserva de ${cual}`}
              className={`${accion} border border-border text-text-dim hover:border-error hover:text-error`}>Cancelar</button>
          </div>
        )}
      </div>

      {explicacion && ultimo?.estadoPago !== "APROBADO" && (
        <p className="mt-3 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-text">
          {explicacion.mensaje}
        </p>
      )}

      {confirmando && (
        <div className="mt-3 rounded-xl border border-error/30 bg-error/10 p-3">
          <p className="text-sm text-text">¿Seguro que querés cancelar esta reserva?</p>
          <div className="mt-3 flex w-full gap-2">
            <button onClick={() => { setConfirmando(false); cancelar(reserva.id); }}
              aria-label={`Sí, cancelar la reserva de ${cual}`}
              className={`${accion} bg-error text-white hover:opacity-90`}>Sí, cancelar</button>
            <button onClick={() => setConfirmando(false)}
              className={`${accion} border border-border text-text-muted hover:text-text`}>No, dejarla</button>
          </div>
        </div>
      )}
    </li>
  );
}
