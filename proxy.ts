import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoAdminOpen, isSupabaseConfigured } from "@/lib/env";
import { applySecurityHeaders } from "@/lib/security-headers";
import { decideVehicleRoute } from "@/lib/vehicle-route";

function gonePage(): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Vehículo retirado</title></head><body style="font-family:sans-serif;background:#050a14;color:#e8eef6;padding:3rem"><h1>Este vehículo ya no está publicado</h1><p>La unidad no está en Salgado Automotriz. Revisa el <a href="/catalogo">catálogo</a>.</p></body></html>`;
}

async function vehicleProxy(request: NextRequest, slug: string): Promise<NextResponse | null> {
  const decision = await decideVehicleRoute(slug);
  if (decision.action === "redirect") {
    const target = decision.location.startsWith("http")
      ? decision.location
      : new URL(decision.location, request.url);
    const response = NextResponse.redirect(target, 301);
    applySecurityHeaders(response.headers);
    return response;
  }
  if (decision.action === "gone") {
    const response = new NextResponse(gonePage(), {
      status: 410,
      headers: { "content-type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" },
    });
    applySecurityHeaders(response.headers);
    return response;
  }
  return null;
}

function isAdminUser(user: { app_metadata?: Record<string, unknown> } | null): boolean {
  if (!user) return false;
  const meta = user.app_metadata ?? {};
  return meta.is_admin === true || meta.role === "admin";
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  const detail = path.match(/^\/catalogo\/detalle\/([^/]+)\/?$/);
  if (detail) {
    try {
      const decided = await vehicleProxy(request, detail[1]);
      if (decided) return decided;
    } catch (err) {
      console.error("[proxy:vehiculo]", err);
    }
  }
  const isAdminRoute = path === "/admin" || path.startsWith("/admin/");
  const isLogin = path === "/admin/login" || path.startsWith("/admin/login/");

  if (!isAdminRoute) return response;

  // Sin Supabase el panel solo existe en `next dev`. En producción exige auth.
  if (!isSupabaseConfigured()) {
    if (isDemoAdminOpen()) return response;
    if (!isLogin) {
      const login = request.nextUrl.clone();
      login.pathname = "/admin/login";
      return NextResponse.redirect(login);
    }
    return response;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = isAdminUser(user);

  if (!isLogin && !admin) {
    const login = request.nextUrl.clone();
    login.pathname = "/admin/login";
    return NextResponse.redirect(login);
  }

  if (isLogin && admin) {
    const dash = request.nextUrl.clone();
    dash.pathname = "/admin";
    return NextResponse.redirect(dash);
  }

  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/catalogo/detalle/:slug"],
};
