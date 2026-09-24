"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

function getQueryParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  return url.searchParams.get(key);
}

interface PrecioData {
  canchaId: string;
  precioBase: number;
  factorAplicado: number;
  descuento: number;
  descuentoTipo: "porcentaje" | "monto_fijo" | null;
  promocionAplicada: string | null;
  precioFinal: number;
  pagoMinimo: number;
}

interface CanchaInfo {
  id: string;
  nombre: string;
  tipo: string;
  capacidad: number;
  complejo: { nombre: string; ciudad: string };
}

type MontoOption = "50" | "100" | "otro";

export default function ReservarPage() {
  const params = useParams();
  const router = useRouter();
  const canchaId = params.id as string;

  const [cancha, setCancha] = useState<CanchaInfo | null>(null);
  const [precio, setPrecio] = useState<PrecioData | null>(null);
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [codigo, setCodigo] = useState("");
  const [montoOption, setMontoOption] = useState<MontoOption>("50");
  const [montoOtro, setMontoOtro] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saldoPendiente, setSaldoPendiente] = useState(0);
  const [step, setStep] = useState<"select" | "precio" | "pagar">("select");
  const [prefilledFecha, setPrefilledFecha] = useState<string | null>(null);
  const [prefilledHora, setPrefilledHora] = useState<string | null>(null);

  // Monto seleccionado calculado dinámicamente
  const montoSeleccionado = useMemo(() => {
    if (!precio) return 0;
    if (montoOption === "50") return precio.pagoMinimo;
    if (montoOption === "100") return precio.precioFinal;
    return parseInt(montoOtro) || 0;
  }, [montoOption, montoOtro, precio]);

  // Porcentaje del total que representa el monto
  const porcentaje = useMemo(() => {
    if (!precio || precio.precioFinal === 0) return 0;
    return Math.round((montoSeleccionado / precio.precioFinal) * 100);
  }, [montoSeleccionado, precio]);

  // Saldo restante si paga menos del 100%
  const saldoRestante = useMemo(() => {
    if (!precio) return 0;
    return Math.max(0, precio.precioFinal - montoSeleccionado);
  }, [montoSeleccionado, precio]);

  // Inicializar
  useEffect(() => {
    const f = getQueryParam("fecha");
    const h = getQueryParam("hora");

    if (f && h) {
      setPrefilledFecha(f);
      setPrefilledHora(h);
      setFecha(f);
      setHora(h);
    } else {
      setLoading(false);
    }

    fetch("/api/me/saldo")
      .then((r) => r.json())
      .then((d) => setSaldoPendiente(d.saldoPendiente || 0))
      .catch(() => {});

    if (canchaId) {
      fetch(`/api/canchas?tipo=&complejoId=&page=1&limit=100`)
        .then((r) => r.json())
        .then((data) => {
          const c = Array.isArray(data) ? data.find((c: any) => c.id === canchaId) : null;
          if (c) setCancha(c);
        })
        .catch(() => {});
    }
  }, [canchaId]);

  // Auto-calcular
  useEffect(() => {
    if (!prefilledFecha || !prefilledHora) return;
    const q = new URLSearchParams({ fecha: prefilledFecha, hora: prefilledHora });
    fetch(`/api/canchas/${canchaId}/precio?${q}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setStep("select");
        } else {
          setPrecio(data);
          setStep("precio");
        }
      })
      .catch(() => setError("Error al calcular precio"))
      .finally(() => setLoading(false));
  }, [prefilledFecha, prefilledHora, canchaId]);

  const calcularPrecioManual = async () => {
    if (!fecha || !hora) { setError("Seleccioná fecha y hora"); return; }
    setLoading(true);
    setError("");
    const q = new URLSearchParams({ fecha, hora });
    if (codigo) q.set("codigo", codigo);
    const res = await fetch(`/api/canchas/${canchaId}/precio?${q}`);
    const data = await res.json();
    if (!res.ok) setError(data.error || "Error al calcular precio");
    else { setPrecio(data); setStep("precio"); }
    setLoading(false);
  };

  const iniciarPago = async () => {
    if (!precio) return;
    const monto = montoSeleccionado;
    if (monto < precio.pagoMinimo) {
      setError(`El pago mínimo es ${precio.pagoMinimo.toLocaleString("es-CO")} COP`);
      return;
    }

    setSubmitting(true);
    setError("");

    // fecha y hora son locales de la cancha; el servidor calcula el instante y la duración
    const resReserva = await fetch("/api/reservas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canchaId, fecha: prefilledFecha || fecha, hora: prefilledHora || hora }),
    });
    const reservaData = await resReserva.json();

    if (!resReserva.ok) {
      setError(reservaData.error || "Error al crear reserva");
      setSubmitting(false);
      return;
    }

    const resPago = await fetch(`/api/reservas/${reservaData.id}/pagar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reservaId: reservaData.id, monto }),
    });
    const pagoData = await resPago.json();

    if (!resPago.ok) {
      setError(pagoData.error || "Error al iniciar pago");
    } else {
      setStep("pagar");
      window.location.href = pagoData.checkoutUrl;
    }
    setSubmitting(false);
  };

  const bloqueado = saldoPendiente > 0;

  return (
    <div className="px-4 pt-4 pb-32 max-w-lg mx-auto w-full">
        <Link href="/player/buscar" className="text-sm text-text-dim hover:text-grass mb-4 inline-block">
          ← Volver
        </Link>

        {cancha && (
          <div className="mb-4">
            <h1 className="text-lg font-bold text-text">{cancha.nombre}</h1>
            <p className="text-sm text-text-dim">{cancha.tipo} · {cancha.complejo.nombre}</p>
          </div>
        )}

        {/* Bloqueo por saldo */}
        {bloqueado && (
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 mb-4">
            <p className="text-sm font-semibold text-yellow-400">⚠️ Saldo pendiente: {saldoPendiente.toLocaleString("es-CO")} COP</p>
            <Link href="/player/saldo" className="text-xs text-grass mt-1 inline-block">Regularizar pagos →</Link>
          </div>
        )}

        {/* Loading */}
        {loading && prefilledFecha && (
          <div className="rounded-xl border border-border bg-surface p-8 text-center">
            <div className="animate-spin h-6 w-6 border-2 border-grass border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm text-text-muted">Calculando precio...</p>
          </div>
        )}

        {/* Step: Error + fallback */}
        {step === "select" && prefilledFecha && !loading && error && (
          <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={() => { setPrefilledFecha(null); setError(""); }}
              className="w-full rounded-xl border border-border px-5 py-3 text-sm text-text-muted">
              Intentar con otra fecha
            </button>
          </div>
        )}

        {/* Step: Precio */}
        {step === "precio" && precio && (
          <div className="space-y-4">
            {/* Fecha y hora confirmadas */}
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-sm text-text-muted mb-1">
                <span>📅</span>
                <span>
                  {prefilledFecha
                    ? new Date(prefilledFecha + "T00:00:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })
                    : fecha}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xl font-bold text-text">
                <span>🕐</span>
                <span>{prefilledHora || hora}</span>
              </div>
            </div>

            {/* Breakdown de precio */}
            <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Precio base</span>
                <span className="text-text">{precio.precioBase.toLocaleString("es-CO")} COP</span>
              </div>
              {precio.factorAplicado !== 1 && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Factor horario</span>
                  <span className="text-text">×{precio.factorAplicado.toFixed(1)}</span>
                </div>
              )}
              {precio.descuento > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-grass-light">Descuento {precio.promocionAplicada}</span>
                  <span className="text-grass-light">−{precio.descuento.toLocaleString("es-CO")}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold pt-2 border-t border-border">
                <span className="text-text">Total</span>
                <span className="text-text">{precio.precioFinal.toLocaleString("es-CO")} COP</span>
              </div>
            </div>

            {/* Selector de monto */}
            <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
              <p className="text-sm font-medium text-text">¿Cuánto querés pagar ahora?</p>

              {(["50", "100", "otro"] as MontoOption[]).map((opt) => (
                <label key={opt}
                  onClick={() => setMontoOption(opt)}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 cursor-pointer transition-all active:scale-[0.98] ${
                    montoOption === opt ? "border-grass bg-grass/5" : "border-border"
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      montoOption === opt ? "border-grass" : "border-border"
                    }`}>
                      {montoOption === opt && <div className="w-2.5 h-2.5 rounded-full bg-grass" />}
                    </div>
                    <span className="text-sm text-text">
                      {opt === "50" ? "50% (mínimo)" : opt === "100" ? "100% (total)" : "Otro monto"}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-text">
                    {opt === "50" ? precio.pagoMinimo.toLocaleString("es-CO") :
                     opt === "100" ? precio.precioFinal.toLocaleString("es-CO") :
                     montoOtro ? parseInt(montoOtro).toLocaleString("es-CO") : "—"} COP
                  </span>
                </label>
              ))}

              {montoOption === "otro" && (
                <input type="number" value={montoOtro} onChange={(e) => setMontoOtro(e.target.value)}
                  min={precio.pagoMinimo} max={precio.precioFinal}
                  placeholder={`Mín ${precio.pagoMinimo.toLocaleString("es-CO")}`}
                  className="w-full rounded-xl border border-border bg-field px-4 py-3 text-sm text-text mt-1"
                  inputMode="numeric" />
              )}

              {/* Indicador dinámico */}
              {montoSeleccionado > 0 && porcentaje < 100 && (
                <div className="pt-2 border-t border-border">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Pagás ahora</span>
                    <span className="text-text font-semibold">{montoSeleccionado.toLocaleString("es-CO")} COP</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-text-muted">Saldo pendiente</span>
                    <span className="text-yellow-400">{saldoRestante.toLocaleString("es-CO")} COP</span>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Step: Redirigiendo */}
        {step === "pagar" && (
          <div className="rounded-xl border border-border bg-surface p-8 text-center space-y-3">
            <div className="animate-spin h-8 w-8 border-2 border-grass border-t-transparent rounded-full mx-auto" />
            <p className="text-base font-semibold text-text">Redirigiendo a MercadoPago...</p>
            <p className="text-sm text-text-muted">Completá el pago para confirmar tu reserva.</p>
          </div>
        )}

        {/* Bottom CTA */}
        {step === "precio" && precio && (
        <div className="mt-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-text-muted">Total a pagar</span>
            <span className="text-xl font-bold text-text">{montoSeleccionado.toLocaleString("es-CO")} COP</span>
          </div>
          <button onClick={iniciarPago} disabled={submitting || bloqueado}
            className="w-full rounded-xl bg-grass px-5 py-3.5 text-base font-semibold text-white hover:bg-grass-light transition-colors disabled:opacity-50 active:scale-[0.98]">
            {submitting ? "Procesando..." : bloqueado ? "Saldo pendiente — no podés pagar" : "Pagar con PSE"}
          </button>
        </div>
      )}
    </div>
  );
}
