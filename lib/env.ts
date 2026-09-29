/**
 * Fronteras de entorno.
 * En producción (incluido preview de Vercel, NODE_ENV=production) no hay
 * admin abierto ni datos ficticios, aunque ALLOW_DEMO_MODE=true.
 * En `next dev` el mock local sigue disponible si no hay Supabase.
 */

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !key) return false;
  if (url.includes("YOUR_PROJECT") || url.includes("placeholder")) return false;
  return true;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Flag histórica. En producción se ignora. */
export function isDemoModeAllowed(): boolean {
  return process.env.ALLOW_DEMO_MODE === "true";
}

/** Datos mock solo en desarrollo local y sin Supabase. */
export function canUseMockFallback(): boolean {
  if (isProduction()) return false;
  if (isSupabaseConfigured()) return false;
  return true;
}

/** Admin sin sesión solo en desarrollo local y sin Supabase. Nunca en producción. */
export function isDemoAdminOpen(): boolean {
  if (isProduction()) return false;
  if (isSupabaseConfigured()) return false;
  return true;
}
