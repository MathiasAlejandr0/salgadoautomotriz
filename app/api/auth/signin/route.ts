import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clientIp, rateLimit, readJsonLimited, tooManyRequests } from "@/lib/abuse";
import { canUseMockFallback, isSupabaseConfigured } from "@/lib/env";
import { parseSignIn } from "@/lib/validation";

export async function POST(req: Request) {
  if (!rateLimit(`signin:${clientIp(req)}`, 8, 15 * 60 * 1000)) return tooManyRequests();

  const parsedBody = await readJsonLimited(req, 8_000);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = parseSignIn(parsedBody.body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    if (canUseMockFallback()) {
      return NextResponse.json({ ok: true, demo: true });
    }
    return NextResponse.json({ error: "Autenticación no configurada" }, { status: 503 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    const meta = data.user?.app_metadata ?? {};
    const isAdmin = meta.is_admin === true || meta.role === "admin";
    if (!isAdmin) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "Esta cuenta no tiene permisos de administrador" },
        { status: 403 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/signin]", err);
    return NextResponse.json({ error: "Error de autenticación" }, { status: 500 });
  }
}
