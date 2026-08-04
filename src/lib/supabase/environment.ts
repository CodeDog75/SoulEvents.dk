let hasLoggedLocalSupabase = false;

function isLocalSupabaseUrl(value: string) {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function isHostedSupabaseUrl(value: string) {
  try {
    return new URL(value).hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

export function assertSafeSupabaseEnvironment(supabaseUrl: string | undefined, clientName: string) {
  if (process.env.NODE_ENV !== "development") return;

  if (!supabaseUrl) return;

  if (isLocalSupabaseUrl(supabaseUrl)) {
    if (!hasLoggedLocalSupabase) {
      hasLoggedLocalSupabase = true;
      console.info(`[SoulEvents local dev] Bruger lokal Supabase: ${supabaseUrl}`);
    }
    return;
  }

  const hostedLabel = isHostedSupabaseUrl(supabaseUrl) ? "hosted Supabase" : "ikke-lokal Supabase";
  throw new Error(
    `[SoulEvents local dev] ${clientName} blokeret: NODE_ENV=development må ikke bruge ${hostedLabel} (${supabaseUrl}). Brug lokal Supabase fra npx supabase start.`,
  );
}

export function isLocalSupabaseDevelopment() {
  return process.env.NODE_ENV === "development" && isLocalSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
}
