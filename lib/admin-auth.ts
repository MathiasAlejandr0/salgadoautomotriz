import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDemoAdminOpen, isSupabaseConfigured } from "@/lib/env";

/** El panel demo local no exige JWT. En producción exige admin de Supabase. */
export async function requireAdmin(): Promise<NextResponse | null> {
  if (isDemoAdminOpen()) return null;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meta = user?.app_metadata ?? {};
  const ok = meta.is_admin === true || meta.role === "admin";
  if (!ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return null;
}
