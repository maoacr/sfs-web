import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
let adminClient: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Supabase no configurado");
    client = createClient(url, key);
  }
  return client;
}

function getAdminClient(): SupabaseClient {
  if (!adminClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase service role key no configurada");
    adminClient = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return adminClient;
}

/** Cliente con permisos de admin (bypass RLS) — usar solo server-side */
export function getSupabaseAdmin(): SupabaseClient {
  return getAdminClient();
}

/** Cliente público — respeta RLS */
export function getSupabase(): SupabaseClient {
  return getClient();
}
