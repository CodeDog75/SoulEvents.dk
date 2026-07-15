import type { CookieOptions } from "@supabase/ssr";

const productionCookieDomain = ".soulevents.dk";

function isProductionHost(hostname: string | null | undefined) {
  return hostname === "soulevents.dk" || hostname === "www.soulevents.dk";
}

export function supabaseCookieOptions(hostname?: string | null): CookieOptions {
  const options: CookieOptions = {
    path: "/",
    sameSite: "lax",
  };

  if (isProductionHost(hostname)) {
    options.domain = productionCookieDomain;
    options.secure = true;
  }

  return options;
}

export function normalizeSupabaseCookieOptions(options: CookieOptions | undefined, hostname?: string | null): CookieOptions {
  return {
    ...(options ?? {}),
    ...supabaseCookieOptions(hostname),
  };
}

export function supabaseCookieDeleteOptions(hostname?: string | null): CookieOptions[] {
  const baseOptions = supabaseCookieOptions(hostname);
  const options: CookieOptions[] = [
    {
      ...baseOptions,
      maxAge: 0,
    },
  ];

  if (baseOptions.domain) {
    options.push({
      path: "/",
      sameSite: "lax",
      secure: true,
      maxAge: 0,
    });
  }

  return options;
}

export function isSupabaseAuthCookie(name: string) {
  return name.startsWith("sb-") && name.includes("-auth-token");
}

