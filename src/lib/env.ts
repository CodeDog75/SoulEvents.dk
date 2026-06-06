function optionalEnv(name: string) {
  return process.env[name] || "";
}

export const env = {
  appUrl: optionalEnv("NEXT_PUBLIC_APP_URL"),
  supabaseUrl: optionalEnv("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: optionalEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") || optionalEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  supabaseServiceRoleKey: optionalEnv("SUPABASE_SERVICE_ROLE_KEY"),
  mapboxToken: optionalEnv("NEXT_PUBLIC_MAPBOX_TOKEN"),
  resendApiKey: optionalEnv("RESEND_API_KEY"),
  resendFromEmail: optionalEnv("RESEND_FROM_EMAIL"),
};

export function assertServerEnv(keys: Array<keyof typeof env>) {
  const missing = keys.filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
}
