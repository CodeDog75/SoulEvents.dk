import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/app-url";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/database";

export const dynamic = "force-dynamic";
const oauthFlowCookie = "soulevents_oauth_flow";

function redirectAndClearOAuthCookie(response: NextResponse, shouldClear: boolean) {
  if (shouldClear) {
    response.cookies.delete(oauthFlowCookie);
  }

  return response;
}

function confirmationRedirect(requestUrl: URL, message: string, confirmation: "expired" | "needed" = "needed") {
  const searchParams = new URLSearchParams({
    confirmation,
    message,
    status: "error",
  });

  return NextResponse.redirect(new URL(`/auth/confirmed?${searchParams.toString()}`, getAppUrl(requestUrl.origin)));
}

function confirmedRedirect(requestUrl: URL, params?: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  const path = searchParams.size > 0 ? `/auth/confirmed?${searchParams.toString()}` : "/auth/confirmed";

  return NextResponse.redirect(new URL(path, getAppUrl(requestUrl.origin)));
}

function passwordResetRedirect(requestUrl: URL, message?: string) {
  const path = message ? `/auth/forgot-password?message=${encodeURIComponent(message)}` : "/auth/update-password";

  return NextResponse.redirect(new URL(path, getAppUrl(requestUrl.origin)));
}

function authCookieNames(cookies: Array<{ name: string }>) {
  return cookies.map((cookie) => cookie.name).filter((name) => name.startsWith("sb-"));
}

function authErrorSummary(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: String(error) };
  }

  const record = error as { code?: unknown; message?: unknown; name?: unknown; status?: unknown };

  return {
    code: typeof record.code === "string" ? record.code : null,
    message: typeof record.message === "string" ? record.message : null,
    name: typeof record.name === "string" ? record.name : null,
    status: typeof record.status === "number" || typeof record.status === "string" ? record.status : null,
  };
}

function createPasswordResetClient(request: NextRequest) {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error("Supabase server credentials are missing.");
  }

  const cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }> = [];
  const responseHeaders: Record<string, string> = {};
  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(nextCookies, headers) {
        cookiesToSet.push(...nextCookies);
        Object.assign(responseHeaders, headers);
      },
    },
  });

  return {
    supabase,
    debugCookies() {
      return {
        cookieCount: cookiesToSet.length,
        cookieNames: cookiesToSet.map((cookie) => cookie.name),
        cookieOptions: cookiesToSet.map((cookie) => ({
          domain: cookie.options.domain ?? null,
          httpOnly: cookie.options.httpOnly ?? null,
          name: cookie.name,
          path: cookie.options.path ?? null,
          sameSite: cookie.options.sameSite ?? null,
          secure: cookie.options.secure ?? null,
        })),
        headerNames: Object.keys(responseHeaders),
      };
    },
    applyCookies(response: NextResponse) {
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });

      return response;
    },
  };
}

function loginErrorRedirect(requestUrl: URL, message: string) {
  const searchParams = new URLSearchParams({ message });

  return NextResponse.redirect(new URL(`/auth/login?${searchParams.toString()}`, getAppUrl(requestUrl.origin)));
}

function isExpiredOrInvalidLink(errorText: string) {
  const normalized = errorText.toLowerCase();

  return (
    normalized.includes("expired") ||
    normalized.includes("invalid") ||
    normalized.includes("otp") ||
    normalized.includes("token")
  );
}

function userDisplayName(user: {
  email?: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
  };
}) {
  return user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Arrangør";
}

function isOAuthUser(user: {
  app_metadata?: {
    provider?: string;
  };
  identities?: Array<{
    provider?: string;
  }>;
}) {
  const provider = user.app_metadata?.provider;

  if (provider && provider !== "email") {
    return true;
  }

  return Boolean(user.identities?.some((identity) => identity.provider && identity.provider !== "email"));
}

function isFacilitatorProfileComplete(facilitatorProfile: {
  city: string | null;
  company_name: string | null;
  facilitator_categories?: Array<{ category_id: string }> | null;
  postal_code: string | null;
  short_description: string | null;
}) {
  return (
    Boolean(facilitatorProfile.company_name) &&
    Boolean(facilitatorProfile.postal_code) &&
    Boolean(facilitatorProfile.city) &&
    Boolean(facilitatorProfile.short_description && facilitatorProfile.short_description.trim().length >= 20) &&
    Boolean(facilitatorProfile.facilitator_categories?.length)
  );
}

async function ensureOAuthProfile(user: {
  id: string;
  email?: string;
  app_metadata?: {
    provider?: string;
  };
  identities?: Array<{
    provider?: string;
  }>;
  user_metadata?: {
    full_name?: string;
    name?: string;
    role?: string;
  };
}) {
  const admin = createAdminClient();
  const { data: existingProfile, error: profileLookupError } = await admin
    .from("profiles")
    .select("id, role, full_name, email, phone")
    .eq("id", user.id)
    .maybeSingle();

  if (profileLookupError) {
    return { error: profileLookupError, isNewProfile: false, needsProfileCompletion: true, role: "facilitator" as AppRole };
  }

  let appProfile = existingProfile;

  if (!appProfile && user.email) {
    const { data: emailProfile, error: emailProfileError } = await admin
      .from("profiles")
      .select("id, role, full_name, email, phone")
      .eq("email", user.email)
      .maybeSingle();

    if (emailProfileError) {
      return { error: emailProfileError, isNewProfile: false, needsProfileCompletion: true, role: "facilitator" as AppRole };
    }

    appProfile = emailProfile;
  }

  const role = (appProfile?.role ?? (user.user_metadata?.role === "admin" ? "admin" : "facilitator")) as AppRole;
  const isNewProfile = !appProfile;
  const appProfileId = appProfile?.id ?? user.id;

  if (!appProfile) {
    const { error: profileError } = await admin.from("profiles").insert({
      email: user.email || "",
      full_name: userDisplayName(user),
      id: user.id,
      phone: null,
      role,
    });

    if (profileError) {
      return { error: profileError, isNewProfile, needsProfileCompletion: true, role };
    }
  }

  let needsProfileCompletion = role === "facilitator";

  if (role === "facilitator") {
    const { data: facilitatorProfile, error: facilitatorLookupError } = await admin
      .from("facilitator_profiles")
      .select("id, company_name, short_description, postal_code, city, facilitator_categories(category_id)")
      .eq("profile_id", appProfileId)
      .maybeSingle();

    if (facilitatorLookupError) {
      return { error: facilitatorLookupError, isNewProfile, needsProfileCompletion, role };
    }

    if (!facilitatorProfile) {
      const { error: facilitatorError } = await admin.from("facilitator_profiles").insert({
        profile_id: appProfileId,
        status: "pending",
      });

      if (facilitatorError) {
        return { error: facilitatorError, isNewProfile, needsProfileCompletion, role };
      }
    } else {
      needsProfileCompletion = !isFacilitatorProfileComplete(facilitatorProfile);
    }
  }

  return { error: null, isNewProfile, needsProfileCompletion, role };
}

function oauthRedirectFor(requestUrl: URL, input: { isNewProfile: boolean; needsProfileCompletion: boolean; role: AppRole }) {
  if (input.role === "admin") {
    console.info("OAuth callback redirecting admin to /admin");
    return NextResponse.redirect(new URL("/admin", getAppUrl(requestUrl.origin)));
  }

  if (input.needsProfileCompletion) {
    console.info("OAuth callback redirecting facilitator to /facilitator/profile");
    const profileUrl = new URL("/facilitator/profile", getAppUrl(requestUrl.origin));

    if (input.isNewProfile) {
      profileUrl.searchParams.set(
        "message",
        "Velkommen til SoulEvents. Færdiggør din profil, så vi kan gøre den klar til godkendelse.",
      );
    }

    return NextResponse.redirect(profileUrl);
  }

  console.info("OAuth callback redirecting facilitator to /facilitator");
  return NextResponse.redirect(new URL("/facilitator", getAppUrl(requestUrl.origin)));
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const flow = requestUrl.searchParams.get("flow");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";
  const isPasswordResetFlow = next === "/auth/update-password";
  const hasOAuthCookie = Boolean(request.cookies.get(oauthFlowCookie)?.value);
  const isOAuthFlow = flow === "oauth" || hasOAuthCookie;
  const incomingAuthCookies = authCookieNames(request.cookies.getAll());

  if (isPasswordResetFlow) {
    console.info("Password reset callback received", {
      authCookieCount: incomingAuthCookies.length,
      authCookieNames: incomingAuthCookies,
      codePresent: Boolean(code),
      errorCode: requestUrl.searchParams.get("error_code"),
      errorDescriptionPresent: Boolean(errorDescription),
      errorPresent: Boolean(error),
      next,
      tokenHashPresent: Boolean(requestUrl.searchParams.get("token_hash")),
      type: requestUrl.searchParams.get("type"),
    });
  }

  if (error) {
    const errorText = `${error} ${errorDescription ?? ""}`;
    console.error("Auth callback returned an error", errorText);

    if (isOAuthFlow || !isExpiredOrInvalidLink(errorText)) {
      return redirectAndClearOAuthCookie(
        loginErrorRedirect(
          requestUrl,
          "Google-login kunne ikke gennemføres. Hvis du allerede har en SoulEvents-konto med samme e-mail, så log ind med e-mail og adgangskode denne gang.",
        ),
        hasOAuthCookie,
      );
    }

    if (isPasswordResetFlow) {
      return passwordResetRedirect(
        requestUrl,
        "Linket til ny adgangskode er udløbet eller er allerede brugt. Skriv din e-mailadresse, så sender vi et nyt link.",
      );
    }

    return confirmationRedirect(
      requestUrl,
      "Bekræftelseslinket er udløbet eller er allerede brugt. Skriv din e-mailadresse herunder, så sender vi et nyt link.",
      "expired",
    );
  }

  if (code) {
    const passwordResetClient = isPasswordResetFlow ? createPasswordResetClient(request) : null;
    const supabase = passwordResetClient?.supabase ?? (await createClient());
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      if (isPasswordResetFlow) {
        console.info("Password reset callback exchange failed", authErrorSummary(exchangeError));
      }
      console.error("Auth callback session exchange failed", exchangeError);

      if (isOAuthFlow) {
        return redirectAndClearOAuthCookie(
          loginErrorRedirect(
            requestUrl,
            "Google-login kunne ikke gennemføres. Prøv igen, eller log ind med e-mail og adgangskode.",
          ),
          hasOAuthCookie,
        );
      }

      if (!isExpiredOrInvalidLink(exchangeError.message)) {
        if (isPasswordResetFlow) {
          return passwordResetRedirect(requestUrl, "Linket til ny adgangskode kunne ikke åbnes. Send et nyt link og prøv igen.");
        }

        return confirmedRedirect(requestUrl, {
          session: "missing",
        });
      }

      if (isPasswordResetFlow) {
        return passwordResetRedirect(
          requestUrl,
          "Linket til ny adgangskode er udløbet eller er allerede brugt. Skriv din e-mailadresse, så sender vi et nyt link.",
        );
      }

      const message =
        "Bekræftelseslinket er udløbet eller er allerede brugt. Skriv din e-mailadresse herunder, så sender vi et nyt link.";

      return confirmationRedirect(requestUrl, message, isExpiredOrInvalidLink(exchangeError.message) ? "expired" : "needed");
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      if (isPasswordResetFlow) {
        console.info("Password reset callback exchange completed without user", passwordResetClient?.debugCookies());
      }
      console.error("Auth callback completed without a session user");
      if (isOAuthFlow) {
        return redirectAndClearOAuthCookie(
          loginErrorRedirect(requestUrl, "Google-login kunne ikke gennemføres. Prøv igen."),
          hasOAuthCookie,
        );
      }

      if (isPasswordResetFlow) {
        return passwordResetRedirect(requestUrl, "Linket til ny adgangskode kunne ikke åbnes. Send et nyt link og prøv igen.");
      }

      return confirmationRedirect(requestUrl, "Login kunne ikke gennemføres. Prøv igen.");
    }

    if (isOAuthFlow || isOAuthUser(user)) {
      const { error: profileError, isNewProfile, needsProfileCompletion, role } = await ensureOAuthProfile(user);

      if (profileError) {
        console.error("OAuth profile preparation failed", profileError);
        return redirectAndClearOAuthCookie(
          loginErrorRedirect(requestUrl, "Login lykkedes, men profilen kunne ikke gøres klar. Prøv igen om lidt."),
          hasOAuthCookie,
        );
      }

      return redirectAndClearOAuthCookie(
        oauthRedirectFor(requestUrl, { isNewProfile, needsProfileCompletion, role }),
        hasOAuthCookie,
      );
    }

    if (isPasswordResetFlow) {
      console.info("Password reset callback exchange succeeded", passwordResetClient?.debugCookies());
      return passwordResetClient?.applyCookies(passwordResetRedirect(requestUrl)) ?? passwordResetRedirect(requestUrl);
    }
  } else {
    if (isOAuthFlow) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { error: profileError, isNewProfile, needsProfileCompletion, role } = await ensureOAuthProfile(user);

        if (profileError) {
          console.error("OAuth profile preparation failed without callback code", profileError);
          return redirectAndClearOAuthCookie(
            loginErrorRedirect(requestUrl, "Login lykkedes, men profilen kunne ikke gøres klar. Prøv igen om lidt."),
            hasOAuthCookie,
          );
        }

        return redirectAndClearOAuthCookie(
          oauthRedirectFor(requestUrl, { isNewProfile, needsProfileCompletion, role }),
          hasOAuthCookie,
        );
      }

      return redirectAndClearOAuthCookie(
        loginErrorRedirect(
          requestUrl,
          "Google-login kunne ikke gennemføres. Prøv igen, eller log ind med e-mail og adgangskode.",
        ),
        hasOAuthCookie,
      );
    }

    if (isPasswordResetFlow) {
      return passwordResetRedirect(
        requestUrl,
        "Linket til ny adgangskode mangler en kode. Åbn det nyeste link fra din indbakke, eller send et nyt link.",
      );
    }

    return confirmationRedirect(
      requestUrl,
      "Bekræftelseslinket mangler en kode. Åbn det nyeste link fra din indbakke, eller send en ny bekræftelsesmail herunder.",
    );
  }

  return confirmedRedirect(requestUrl, { next });
}
