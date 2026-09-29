import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** Lectura pública sin cookies: permite ISR. No usar para admin ni auth. */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase no está configurado");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
