"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/campo-texto";

/**
 * Elegir la contraseña nueva.
 *
 * Mismo criterio que el registro: se puede ver lo que se escribe y se pide dos
 * veces. Si acá se tipea mal, la persona vuelve a quedar afuera — y está en
 * esta pantalla precisamente porque ya le pasó una vez.
 */
export function FormularioRestablecer({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [listo, setListo] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmacion) {
      setError("Las contraseñas no coinciden. Revisá que las dos sean iguales.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/restablecer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No pudimos cambiar tu contraseña.");
        return;
      }
      setListo(true);
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (listo) {
    return (
      <Marco>
        <h1 className="text-lg font-semibold text-text">Contraseña actualizada</h1>
        <p className="mt-2 text-sm text-text-muted">Ya podés entrar con tu contraseña nueva.</p>
        <Link
          href="/auth/login"
          className="mt-5 inline-block rounded-xl bg-grass px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-grass-light"
        >
          Iniciar sesión
        </Link>
      </Marco>
    );
  }

  if (!token) {
    return (
      <Marco>
        <h1 className="text-lg font-semibold text-text">Link incompleto</h1>
        <p className="mt-2 text-sm text-text-muted">
          Este link no trae el código que necesitamos. Pedí uno nuevo.
        </p>
        <Link
          href="/auth/recuperar"
          className="mt-5 inline-block rounded-xl bg-grass px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-grass-light"
        >
          Pedir otro link
        </Link>
      </Marco>
    );
  }

  return (
    <Marco centrado={false}>
      <h1 className="text-center text-lg font-semibold text-text">Elegí una contraseña nueva</h1>
      <p className="mt-2 mb-6 text-center text-sm text-text-muted">
        Mínimo 8 caracteres. Podés verla con el ojo para no equivocarte.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          id="password"
          label="Contraseña nueva"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={setPassword}
          placeholder="Mínimo 8 caracteres"
          autoComplete="new-password"
        />
        <Input
          id="confirmacion"
          label="Repetir contraseña"
          type="password"
          required
          minLength={8}
          value={confirmacion}
          onChange={setConfirmacion}
          placeholder="Escribila de nuevo"
          autoComplete="new-password"
        />

        {error && (
          <div className="rounded-lg bg-error-bg px-4 py-3 text-sm text-error">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-grass px-4 py-3.5 text-base sm:text-sm font-semibold text-white shadow-sm transition-colors hover:bg-grass-light disabled:opacity-50"
        >
          {loading ? "Guardando..." : "Guardar contraseña"}
        </button>
      </form>
    </Marco>
  );
}

/** Mismo marco que `/auth/callback`: tarjeta centrada con el escudo arriba. */
function Marco({ children, centrado = true }: { children: React.ReactNode; centrado?: boolean }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className={`w-full max-w-sm ${centrado ? "text-center" : ""}`}>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-field">
          <span className="text-xl">⚽</span>
        </div>
        {children}
      </div>
    </div>
  );
}
