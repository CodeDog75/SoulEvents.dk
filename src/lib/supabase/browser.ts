import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export function createClient() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error("Supabase browser credentials are missing.");
  }

  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
