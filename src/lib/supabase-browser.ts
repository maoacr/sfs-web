"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase para el browser — existe SOLO para el baile de OAuth.
 *
 * `src/lib/supabase.ts` no sirve acá: usa `SUPABASE_URL` / `SUPABASE_ANON_KEY`,
 * que son variables de servidor y en el browser llegan `undefined`. Estas dos
 * tienen que ser `NEXT_PUBLIC_` para que Next las inyecte en el bundle.
 *
 * La sesión que Supabase crea acá es un recibo del trámite, no la sesión de
 * SFS: `/auth/callback` la canjea por nuestras cookies y la descarta con
 * `signOut({ scope: "local" })`. La sesión real de SFS es siempre `sfs_token`.
 */
let client: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error(
        "Falta NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY"
      );
    }
    client = createClient(url, key);
  }
  return client;
}
