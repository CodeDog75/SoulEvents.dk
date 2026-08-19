import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { assertSafeSupabaseEnvironment } from "@/lib/supabase/environment";

export function createPublicClient() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error("Supabase public credentials are missing.");
  }

  assertSafeSupabaseEnvironment(env.supabaseUrl, "Supabase public client");

  return createSupabaseClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
