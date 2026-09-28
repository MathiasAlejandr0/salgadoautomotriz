import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoAdminOpen, isSupabaseConfigured } from "@/lib/env";

function isAdminUser(user: {
  app_metadata?: Record<string, unknown>;
} | null): boolean {
  if (!user) return false;
  const meta = user.app_metadata ?? {};
  return meta.is_admin === true || meta.role === "admin";
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  const isAdminRoute = path.startsWith("/admin");
  const isLogin = path.startsWith("/admin/login");

  if (!isAdminRoute) return response;

  // Sin Supabase: admin solo en demo/dev (nunca en prod sin flag)
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
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
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
  matcher: ["/admin/:path*"],
};
