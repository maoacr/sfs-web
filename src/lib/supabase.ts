import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Supabase no configurado: NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY son requeridos");
    client = createClient(url, key);
  }
  return client;
}

/**
 * Obtiene el cliente de Supabase. Lanza error si no está configurado.
 */
export function getSupabase(): SupabaseClient {
  return getClient();
}
