"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

// Helper para leer query params sin useSearchParams (evita necesidad de Suspense)
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

export default function ReservarPage() {
  const params = useParams();
  const router = useRouter();
  const canchaId = params.id as string;

  const [cancha, setCancha] = useState<CanchaInfo | null>(null);
  const [precio, setPrecio] = useState<PrecioData | null>(null);
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [codigo, setCodigo] = useState("");
  const [montoSeleccionado, setMontoSeleccionado] = useState<"50" | "100" | "otro">("50");
  const [montoOtro, setMontoOtro] = useState("");
  const [loading, setLoading] = useState(true); // empieza cargando si hay params
  const [error, setError] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [saldoPendiente, setSaldoPendiente] = useState(0);
  const [step, setStep] = useState<"select" | "precio" | "pagar">("select");
  const [prefilledFecha, setPrefilledFecha] = useState<string | null>(null);
  const [prefilledHora, setPrefilledHora] = useState<string | null>(null);

  // Inicializar: leer query params + saldo + info cancha + auto-calcular
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

    // Saldo
    fetch("/api/me/saldo")
      .then((r) => r.json())
      .then((d) => setSaldoPendiente(d.saldoPendiente || 0))
      .catch(() => {});

    // Info cancha (solo si tenemos canchaId)
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

  // Auto-calcular cuando tenemos fecha y hora pre-llenadas
  useEffect(() => {
    if (!prefilledFecha || !prefilledHora) return;

    const params = new URLSearchParams({ fecha: prefilledFecha, hora: prefilledHora });
    fetch(`/api/canchas/${canchaId}/precio?${params}`)
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

  const calcularPrecio = async () => {
    if (!fecha || !hora) {
      setError("Seleccioná fecha y hora");
      return;
    }
    setLoading(true);
    setError("");

    const params = new URLSearchParams({ fecha, hora });
    if (codigo) params.set("codigo", codigo);

    const res = await fetch(`/api/canchas/${canchaId}/precio?${params}`);
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Error al calcular precio");
    } else {
      setPrecio(data);
      setStep("precio");
    }
    setLoading(false);
  };

  const iniciarPago = async () => {
    if (!precio) return;

    let monto = 0;
    if (montoSeleccionado === "50") monto = precio.pagoMinimo;
    else if (montoSeleccionado === "100") monto = precio.precioFinal;
    else monto = parseInt(montoOtro) || 0;

    if (monto < precio.pagoMinimo) {
      setError(`El pago mínimo es ${precio.pagoMinimo.toLocaleString("es-CO")} COP`);
      return;
    }

    // Primero crear la reserva
    setLoading(true);
    setError("");

    const slotInicio = new Date(`${fecha}T${hora}:00`).toISOString();
    const slotFin = new Date(new Date(`${fecha}T${hora}:00`).getTime() + 60 * 60 * 1000).toISOString();

    const resReserva = await fetch("/api/reservas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        canchaId,
        slotInicio,
        slotFin,
      }),
    });

    const reservaData = await resReserva.json();

    if (!resReserva.ok) {
      setError(reservaData.error || "Error al crear reserva");
      setLoading(false);
      return;
    }

    // Luego iniciar pago
    const resPago = await fetch(`/api/reservas/${reservaData.id}/pagar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reservaId: reservaData.id, monto }),
    });

    const pagoData = await resPago.json();

    if (!resPago.ok) {
      setError(pagoData.error || "Error al iniciar pago");
    } else {
      setCheckoutUrl(pagoData.checkoutUrl);
      setStep("pagar");
      // Redirigir a MP
      window.location.href = pagoData.checkoutUrl;
    }
    setLoading(false);
  };

  const bloqueado = saldoPendiente > 0;

  return (
    <div className="p-6 lg:p-8 max-w-lg mx-auto">
      <Link href="/player/buscar" className="text-sm text-text-dim hover:text-grass mb-6 inline-block">
        ← Volver a buscar
      </Link>

      <h1 className="text-2xl font-bold text-text mb-2">Reservar cancha</h1>
      {cancha && (
        <p className="text-text-muted mb-6">
          {cancha.nombre} · {cancha.tipo} · {cancha.complejo.nombre}
        </p>
      )}

      {/* Bloqueo por saldo */}
      {bloqueado && (
        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-4 mb-6">
          <p className="text-sm font-semibold text-yellow-400">⚠️ Tenés saldo pendiente</p>
          <p className="text-xs text-text-dim mt-1">
            Regularizá tus pagos antes de reservar. Saldo: {saldoPendiente.toLocaleString("es-CO")} COP
          </p>
          <Link href="/player/saldo" className="text-sm text-grass hover:text-grass-light mt-2 inline-block">
            Ver mis pagos →
          </Link>
        </div>
      )}

      {/* Step 1: Seleccionar fecha/hora — solo si no vienen de búsqueda */}
      {step === "select" && !prefilledFecha && (
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-xl border border-border bg-field px-4 py-2.5 text-sm text-text"
              min={new Date().toISOString().slice(0, 10)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Hora</label>
            <select value={hora} onChange={(e) => setHora(e.target.value)}
              className="w-full rounded-xl border border-border bg-field px-4 py-2.5 text-sm text-text">
              <option value="">Seleccionar hora</option>
              {Array.from({ length: 15 }, (_, i) => i + 7).map((h) => (
                <option key={h} value={`${String(h).padStart(2, "0")}:00`}>
                  {h}:00
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Código promocional (opcional)</label>
            <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="Ej: VERANO20"
              className="w-full rounded-xl border border-border bg-field px-4 py-2.5 text-sm text-text" />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button onClick={calcularPrecio} disabled={loading || bloqueado}
            className="w-full rounded-xl bg-grass px-5 py-3 text-sm font-semibold text-white hover:bg-grass-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? "Calculando..." : bloqueado ? "Saldo pendiente — no podés reservar" : "Calcular precio"}
          </button>
        </div>
      )}

      {/* Loading mientras se auto-calcula */}
      {step === "select" && prefilledFecha && loading && (
        <div className="rounded-2xl border border-border bg-surface p-12 text-center">
          <p className="text-text-muted">Calculando precio...</p>
        </div>
      )}

      {/* Error de auto-cálculo — mostrar select como fallback */}
      {step === "select" && prefilledFecha && !loading && error && (
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-4">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={() => { setPrefilledFecha(null); setError(""); }}
            className="w-full rounded-xl border border-border px-5 py-3 text-sm text-text-muted">
            Intentar con otra fecha
          </button>
        </div>
      )}

      {/* Step 2: Ver precio y seleccionar monto */}
      {step === "precio" && precio && (
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-4">
          {/* Datos de la reserva */}
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <span className="text-2xl">⚽</span>
            <div>
              <p className="text-sm font-semibold text-text">
                {prefilledFecha ? new Date(prefilledFecha + "T00:00:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" }) : fecha}
              </p>
              <p className="text-2xl font-bold text-text">
                {prefilledHora || hora}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Precio base</span>
              <span className="text-text">{precio.precioBase.toLocaleString("es-CO")} COP</span>
            </div>
            {precio.factorAplicado !== 1 && (
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Factor horario</span>
                <span className="text-text">×{precio.factorAplicado}</span>
              </div>
            )}
            {precio.descuento > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-grass-light">Descuento {precio.promocionAplicada}</span>
                <span className="text-grass-light">-{precio.descuento.toLocaleString("es-CO")} COP</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold pt-2 border-t border-border">
              <span className="text-text">Total</span>
              <span className="text-text">{precio.precioFinal.toLocaleString("es-CO")} COP</span>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <label className="block text-sm font-medium text-text">¿Cuánto querés pagar ahora?</label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name="monto" value="50" checked={montoSeleccionado === "50"}
                onChange={() => setMontoSeleccionado("50")} className="accent-grass" />
              <span className="text-sm text-text">50% — {precio.pagoMinimo.toLocaleString("es-CO")} COP (mínimo)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name="monto" value="100" checked={montoSeleccionado === "100"}
                onChange={() => setMontoSeleccionado("100")} className="accent-grass" />
              <span className="text-sm text-text">100% — {precio.precioFinal.toLocaleString("es-CO")} COP</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name="monto" value="otro" checked={montoSeleccionado === "otro"}
                onChange={() => setMontoSeleccionado("otro")} className="accent-grass" />
              <span className="text-sm text-text">Otro monto</span>
            </label>
            {montoSeleccionado === "otro" && (
              <input type="number" value={montoOtro} onChange={(e) => setMontoOtro(e.target.value)}
                min={precio.pagoMinimo} max={precio.precioFinal}
                placeholder={`Mín ${precio.pagoMinimo.toLocaleString("es-CO")}`}
                className="w-full rounded-xl border border-border bg-field px-4 py-2.5 text-sm text-text mt-1" />
            )}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={() => setStep("select")}
              className="flex-1 rounded-xl border border-border px-5 py-3 text-sm font-medium text-text-muted hover:bg-surface-hover transition-colors">
              Volver
            </button>
            <button onClick={iniciarPago} disabled={loading}
              className="flex-1 rounded-xl bg-grass px-5 py-3 text-sm font-semibold text-white hover:bg-grass-light transition-colors disabled:opacity-50">
              {loading ? "Procesando..." : "Pagar con PSE"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Redirigiendo a MP */}
      {step === "pagar" && (
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-sm text-center">
          <p className="text-lg font-semibold text-text mb-2">Redirigiendo a MercadoPago...</p>
          <p className="text-sm text-text-muted">Completá el pago para confirmar tu reserva.</p>
          {checkoutUrl && (
            <a href={checkoutUrl} className="mt-4 inline-block text-sm text-grass hover:text-grass-light">
              Si no se redirige, click aquí →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
