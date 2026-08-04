import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import { normalizeSupabaseCookieOptions, supabaseCookieOptions } from "@/lib/supabase/auth-cookies";
import { assertSafeSupabaseEnvironment } from "@/lib/supabase/environment";

export async function createClient() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error("Supabase server credentials are missing.");
  }

  assertSafeSupabaseEnvironment(env.supabaseUrl, "Supabase server client");

  const cookieStore = await cookies();
  const headerStore = await headers();
  const hostname = headerStore.get("x-forwarded-host")?.split(":")[0] || headerStore.get("host")?.split(":")[0] || null;

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookieOptions: supabaseCookieOptions(hostname),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, normalizeSupabaseCookieOptions(options, hostname));
          });
        } catch {
          // Server Components cannot set cookies. Middleware handles session refresh.
        }
      },
    },
  });
}
