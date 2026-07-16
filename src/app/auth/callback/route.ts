import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getAppUrl } from "@/lib/app-url";
import { getPostAuthRedirect, type PostAuthResult } from "@/lib/auth/post-auth";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { normalizeSupabaseCookieOptions, supabaseCookieOptions } from "@/lib/supabase/auth-cookies";

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

function createPasswordResetClient(request: NextRequest) {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error("Supabase server credentials are missing.");
  }

  const callbackHostname = new URL(request.url).hostname;
  const cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }> = [];
  const responseHeaders: Record<string, string> = {};
  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookieOptions: supabaseCookieOptions(callbackHostname),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(nextCookies, headers) {
        cookiesToSet.push(...nextCookies);
        Object.assign(responseHeaders, headers);
        nextCookies.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
      },
    },
  });

  return {
    supabase,
    applyCookies(response: NextResponse) {
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, normalizeSupabaseCookieOptions(options, callbackHostname));
      });
      Object.entries(responseHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    },
  };
}

function loginErrorRedirect(requestUrl: URL, message: string) {
  const searchParams = new URLSearchParams({ message });

  return NextResponse.redirect(new URL(`/auth/login?${searchParams.toString()}`, getAppUrl(requestUrl.origin)));
}

function oauthProviderLabel(provider: string | null) {
  if (provider === "apple") return "Apple";
  if (provider === "facebook") return "Facebook";
  if (provider === "google") return "Google";
  return "socialt login";
}

function oauthErrorMessage(provider: string | null, detail = "Prøv igen, eller log ind med e-mail og adgangskode.") {
  return `Login med ${oauthProviderLabel(provider)} kunne ikke gennemføres. ${detail}`;
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

function postAuthRedirectResponse(requestUrl: URL, result: PostAuthResult) {
  console.info("Auth callback redirecting after profile preparation", {
    path: result.path,
    role: result.profile.role,
    type: result.type,
  });

  return NextResponse.redirect(new URL(result.path, getAppUrl(requestUrl.origin)));
}

function emailConfirmationRedirectResponse(requestUrl: URL, result: PostAuthResult) {
  if (result.profile.role !== "facilitator") {
    return postAuthRedirectResponse(requestUrl, result);
  }

  if (result.path === "/facilitator/profile") {
    return NextResponse.redirect(new URL("/facilitator/profile?confirmed=1", getAppUrl(requestUrl.origin)));
  }

  return postAuthRedirectResponse(requestUrl, result);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const flow = requestUrl.searchParams.get("flow");
  const provider = requestUrl.searchParams.get("provider");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const isPasswordResetFlow = next === "/auth/update-password";
  const hasOAuthCookie = Boolean(request.cookies.get(oauthFlowCookie)?.value);
  const isOAuthFlow = flow === "oauth" || hasOAuthCookie;

  if (error) {
    const errorText = `${error} ${errorDescription ?? ""}`;
    console.error("Auth callback returned an error", errorText);

    if (isOAuthFlow || !isExpiredOrInvalidLink(errorText)) {
      return redirectAndClearOAuthCookie(
        loginErrorRedirect(
          requestUrl,
          oauthErrorMessage(
            provider,
            "Hvis du allerede har en SoulEvents-konto med samme e-mail, så log ind med e-mail og adgangskode denne gang.",
          ),
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

  if (isPasswordResetFlow && tokenHash && type === "recovery") {
    const passwordResetClient = createPasswordResetClient(request);
    const { error: verifyError } = await passwordResetClient.supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });

    if (verifyError) {
      console.error("Password reset token verification failed", verifyError);
      return passwordResetRedirect(
        requestUrl,
        "Linket til ny adgangskode er udløbet eller er allerede brugt. Skriv din e-mailadresse, så sender vi et nyt link.",
      );
    }

    return passwordResetClient.applyCookies(passwordResetRedirect(requestUrl));
  }

  if (code) {
    const passwordResetClient = isPasswordResetFlow ? createPasswordResetClient(request) : null;
    const supabase = passwordResetClient?.supabase ?? (await createClient());
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("Auth callback session exchange failed", exchangeError);

      if (isOAuthFlow) {
        return redirectAndClearOAuthCookie(
          loginErrorRedirect(
            requestUrl,
            oauthErrorMessage(provider),
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
      console.error("Auth callback completed without a session user");
      if (isOAuthFlow) {
        return redirectAndClearOAuthCookie(
          loginErrorRedirect(requestUrl, oauthErrorMessage(provider, "Prøv igen.")),
          hasOAuthCookie,
        );
      }

      if (isPasswordResetFlow) {
        return passwordResetRedirect(requestUrl, "Linket til ny adgangskode kunne ikke åbnes. Send et nyt link og prøv igen.");
      }

      return confirmationRedirect(requestUrl, "Login kunne ikke gennemføres. Prøv igen.");
    }

    if (isOAuthFlow || isOAuthUser(user)) {
      let postAuthResult: PostAuthResult;

      try {
        postAuthResult = await getPostAuthRedirect({ user });
      } catch (profileError) {
        console.error("OAuth profile preparation failed", {
          message: profileError instanceof Error ? profileError.message : "Unknown profile error",
        });
        return redirectAndClearOAuthCookie(
          loginErrorRedirect(requestUrl, "Login lykkedes, men profilen kunne ikke gøres klar. Prøv igen om lidt."),
          hasOAuthCookie,
        );
      }

      if (postAuthResult.type === "disabled") {
        await supabase.auth.signOut();
        return redirectAndClearOAuthCookie(loginErrorRedirect(requestUrl, postAuthResult.message), hasOAuthCookie);
      }

      return redirectAndClearOAuthCookie(
        postAuthRedirectResponse(requestUrl, postAuthResult),
        hasOAuthCookie,
      );
    }

    if (isPasswordResetFlow) {
      return passwordResetClient?.applyCookies(passwordResetRedirect(requestUrl)) ?? passwordResetRedirect(requestUrl);
    }

    let postAuthResult: PostAuthResult;

    try {
      postAuthResult = await getPostAuthRedirect({ user });
    } catch (profileError) {
      console.error("Email confirmation profile preparation failed", {
        message: profileError instanceof Error ? profileError.message : "Unknown profile error",
      });

      return confirmedRedirect(requestUrl, {
        next,
      });
    }

    if (postAuthResult.type === "disabled") {
      await supabase.auth.signOut();
      return loginErrorRedirect(requestUrl, postAuthResult.message);
    }

    return emailConfirmationRedirectResponse(requestUrl, postAuthResult);
  } else {
    if (isOAuthFlow) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        let postAuthResult: PostAuthResult;

        try {
          postAuthResult = await getPostAuthRedirect({ user });
        } catch (profileError) {
          console.error("OAuth profile preparation failed without callback code", {
            message: profileError instanceof Error ? profileError.message : "Unknown profile error",
          });
          return redirectAndClearOAuthCookie(
            loginErrorRedirect(requestUrl, "Login lykkedes, men profilen kunne ikke gøres klar. Prøv igen om lidt."),
            hasOAuthCookie,
          );
        }

        if (postAuthResult.type === "disabled") {
          await supabase.auth.signOut();
          return redirectAndClearOAuthCookie(loginErrorRedirect(requestUrl, postAuthResult.message), hasOAuthCookie);
        }

        return redirectAndClearOAuthCookie(
          postAuthRedirectResponse(requestUrl, postAuthResult),
          hasOAuthCookie,
        );
      }

      return redirectAndClearOAuthCookie(
        loginErrorRedirect(
          requestUrl,
          oauthErrorMessage(provider),
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
