"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/campo-texto";

/**
 * Pedir el link para volver a entrar.
 *
 * El servidor responde lo mismo exista o no la cuenta, así que esta pantalla
 * tampoco puede decir "ese email no está registrado": sería filtrar por la
 * interfaz justo lo que el endpoint se cuida de no filtrar.
 */
export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/recuperar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No pudimos procesar el pedido.");
        return;
      }
      setMensaje(data.mensaje);
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-field">
          <span className="text-xl">⚽</span>
        </div>

        {mensaje ? (
          <div className="text-center">
            <h1 className="text-lg font-semibold text-text">Revisá tu correo</h1>
            <p className="mt-2 text-sm text-text-muted">{mensaje}</p>
            <p className="mt-1 text-sm text-text-dim">El link vence en 30 minutos.</p>
            <Link
              href="/auth/login"
              className="mt-5 inline-block rounded-xl bg-grass px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-grass-light"
            >
              Volver al ingreso
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-center text-lg font-semibold text-text">Recuperar tu cuenta</h1>
            <p className="mt-2 mb-6 text-center text-sm text-text-muted">
              Poné tu email y te mandamos un link para elegir una contraseña nueva.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                id="email"
                label="Email"
                type="email"
                required
                value={email}
                onChange={setEmail}
                placeholder="tu@email.com"
                autoComplete="email"
              />

              {error && (
                <div className="rounded-lg bg-error-bg px-4 py-3 text-sm text-error">{error}</div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-grass px-4 py-3.5 text-base sm:text-sm font-semibold text-white shadow-sm transition-colors hover:bg-grass-light disabled:opacity-50"
              >
                {loading ? "Enviando..." : "Mandarme el link"}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-text-muted">
              <Link href="/auth/login" className="font-medium text-grass hover:text-grass-light">
                Volver al ingreso
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
