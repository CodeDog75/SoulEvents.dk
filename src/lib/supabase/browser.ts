import { createBrowserClient } from "@supabase/ssr";
import { supabaseCookieOptions } from "@/lib/supabase/auth-cookies";
import { assertSafeSupabaseEnvironment } from "@/lib/supabase/environment";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase browser credentials are missing.");
  }

  assertSafeSupabaseEnvironment(supabaseUrl, "Supabase browser client");

  const hostname = typeof window === "undefined" ? null : window.location.hostname;

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: supabaseCookieOptions(hostname),
  });
}
