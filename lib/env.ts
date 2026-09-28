/**
 * Fronteras de entorno explícitas.
 * En producción: mock/admin demo solo con ALLOW_DEMO_MODE=true.
 * En desarrollo local: mock permitido sin Supabase para no romper el UI.
 */

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !key) return false;
  if (url.includes("YOUR_PROJECT") || url.includes("placeholder")) return false;
  return true;
}

/** Flag explícita (prod o preview) para demo sin backend. */
export function isDemoModeAllowed(): boolean {
  return process.env.ALLOW_DEMO_MODE === "true";
}

function isNonProduction(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** Datos mock solo si no hay Supabase y estamos en demo/dev. */
export function canUseMockFallback(): boolean {
  if (isSupabaseConfigured()) return false;
  return isDemoModeAllowed() || isNonProduction();
}

/** Admin abierto sin auth solo en demo/dev sin Supabase. */
export function isDemoAdminOpen(): boolean {
  if (isSupabaseConfigured()) return false;
  return isDemoModeAllowed() || isNonProduction();
}
