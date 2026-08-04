import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { assertSafeSupabaseEnvironment } from "@/lib/supabase/environment";

export function createAdminClient() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error("Supabase service credentials are missing.");
  }

  assertSafeSupabaseEnvironment(env.supabaseUrl, "Supabase admin client");

  return createSupabaseClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
