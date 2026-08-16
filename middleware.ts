import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminOnlyRoute, isAdminRoute, isProtectedRoute } from "@/lib/auth/route-protection";
import type { Enums } from "@/types/database";

type MiddlewareProfile = {
  role: Enums<"app_role">;
  is_active: boolean;
};

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (!isProtectedRoute(pathname)) {
    return response;
  }

  if (!user) {
    const redirectUrl = new URL("/sign-in", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  const { data } = await supabase
    .from("profiles")
    .select("role,is_active")
    .eq("id", user.id)
    .maybeSingle();
  const profile = data as MiddlewareProfile | null;

  if (!profile?.is_active) {
    const redirectUrl = new URL("/sign-in", request.url);
    redirectUrl.searchParams.set("error", "inactive");
    return NextResponse.redirect(redirectUrl);
  }

  if (isAdminOnlyRoute(pathname) && profile.role !== "admin") {
    return NextResponse.redirect(new URL("/my-schedule", request.url));
  }

  if (isAdminRoute(pathname) && profile.role !== "admin" && profile.role !== "organizer") {
    return NextResponse.redirect(new URL("/my-schedule", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
