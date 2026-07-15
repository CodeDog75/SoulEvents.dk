import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  isSupabaseAuthCookie,
  normalizeSupabaseCookieOptions,
  supabaseCookieDeleteOptions,
  supabaseCookieOptions,
} from "@/lib/supabase/auth-cookies";

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const hostname = request.nextUrl.hostname;
  const cookieOptions = supabaseCookieOptions(hostname);
  const authCookieNames = request.cookies
    .getAll()
    .map((cookie) => cookie.name)
    .filter(isSupabaseAuthCookie);
  const cookieHeaderSize = request.headers.get("cookie")?.length ?? 0;

  if (authCookieNames.length > 0 || cookieHeaderSize > 6_000) {
    console.info("Supabase auth cookies on request", {
      cookieHeaderSize,
      names: authCookieNames,
    });
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, normalizeSupabaseCookieOptions(options, hostname));
        });
      },
    },
  });

  const clearSupabaseCookies = (nextResponse = response) => {
    request.cookies.getAll().forEach((cookie) => {
      if (isSupabaseAuthCookie(cookie.name)) {
        request.cookies.delete(cookie.name);
        supabaseCookieDeleteOptions(hostname).forEach((options) => {
          nextResponse.cookies.set(cookie.name, "", options);
        });
      }
    });

    return nextResponse;
  };

  const redirectToLogin = () => {
    if (request.nextUrl.pathname.startsWith("/auth/")) {
      return clearSupabaseCookies();
    }

    if (request.nextUrl.pathname.startsWith("/admin") || request.nextUrl.pathname.startsWith("/dashboard") || request.nextUrl.pathname.startsWith("/facilitator")) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/auth/login";
      redirectUrl.search = "";
      return clearSupabaseCookies(NextResponse.redirect(redirectUrl));
    }

    return clearSupabaseCookies();
  };

  try {
    const result = await supabase.auth.getUser();
    if (result.error) {
      console.warn("Supabase middleware session is invalid", {
        message: result.error.message,
      });
      return redirectToLogin();
    }

    if (!result.data.user && authCookieNames.length > 0) {
      console.warn("Supabase middleware session is missing a user", {
        cookieHeaderSize,
        names: authCookieNames,
      });
      return redirectToLogin();
    }
  } catch (error) {
    console.warn("Supabase middleware session refresh failed", {
      message: error instanceof Error ? error.message : "Unknown auth error",
    });
    return redirectToLogin();
  }

  return response;
}
