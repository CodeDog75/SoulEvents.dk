import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const clearSupabaseCookies = () => {
    request.cookies.getAll().forEach((cookie) => {
      if (cookie.name.startsWith("sb-")) {
        request.cookies.delete(cookie.name);
        response.cookies.delete(cookie.name);
      }
    });
  };

  try {
    const result = await supabase.auth.getUser();
    if (result.error) {
      console.warn("Supabase middleware session is invalid", {
        message: result.error.message,
      });
      clearSupabaseCookies();
    }
  } catch (error) {
    console.warn("Supabase middleware session refresh failed", {
      message: error instanceof Error ? error.message : "Unknown auth error",
    });
    clearSupabaseCookies();
  }

  return response;
}
