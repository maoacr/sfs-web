"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

/**
 * Pantalla de vuelta de Google.
 *
 * Supabase devuelve sus tokens en el fragment de la URL (`#access_token=...`),
 * que nunca viaja al servidor — por eso este canje es client-side. El cliente
 * de Supabase lo levanta solo (`detectSessionInUrl`), y acá lo cambiamos por
 * nuestras cookies `sfs_token` / `sfs_refresh`.
 *
 * El access token es lo único que mandamos: el servidor lo verifica contra
 * Supabase y de ahí saca email, nombre y `sub`. Nada de identidad sale de acá.
 */
export default function CallbackPage() {
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelado = false;

    async function canjearSesion() {
      try {
        const supabase = getSupabaseBrowser();
        const { data, error: errorSesion } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;

        if (errorSesion || !accessToken) {
          if (!cancelado) setError("No pudimos leer la respuesta de Google. Probá de nuevo.");
          return;
        }

        const res = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken }),
        });
        const payload = await res.json();

        // El recibo de Supabase ya cumplió su función. La sesión de SFS son
        // nuestras cookies; dejar la de Supabase viva sólo confunde.
        await supabase.auth.signOut({ scope: "local" });

        if (!res.ok) {
          if (!cancelado) setError(payload.error || "No pudimos iniciar tu sesión.");
          return;
        }

        window.location.href =
          payload.user?.role === "OWNER" ? "/owner/dashboard" : "/player/buscar";
      } catch {
        if (!cancelado) setError("Error de conexión. Intentá de nuevo.");
      }
    }

    canjearSesion();
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-field">
          <span className="text-xl">⚽</span>
        </div>

        {error ? (
          <>
            <h1 className="text-lg font-semibold text-text">No pudimos entrar</h1>
            <div className="mt-3 rounded-lg bg-error-bg px-4 py-3 text-sm text-error">{error}</div>
            <Link
              href="/auth/login"
              className="mt-5 inline-block rounded-xl bg-grass px-5 py-3 text-sm font-semibold text-white hover:bg-grass-light transition-colors"
            >
              Volver al login
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-text">Entrando…</h1>
            <p className="mt-1 text-sm text-text-muted">Estamos verificando tu cuenta de Google.</p>
          </>
        )}
      </div>
    </div>
  );
}
