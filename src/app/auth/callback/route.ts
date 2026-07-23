import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { syncConfirmedEmailChange } from "@/lib/auth/email-change";
import { getAppUrl } from "@/lib/app-url";
import { getPostAuthRedirect, type PostAuthResult } from "@/lib/auth/post-auth";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
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

function createTokenVerificationClient(request: NextRequest) {
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

function emailChangeRedirect(requestUrl: URL, message: string, status: "error" | "success" = "error") {
  const searchParams = new URLSearchParams({ message, status });
  const path = status === "success" ? "/facilitator" : "/auth/login";

  return NextResponse.redirect(new URL(`${path}?${searchParams.toString()}`, getAppUrl(requestUrl.origin)));
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

function linkIdentityMessage(provider: string | null, detail = "Prøv igen fra Login og sikkerhed.") {
  return `Tilknytning af ${oauthProviderLabel(provider)} kunne ikke gennemføres. ${detail}`;
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

function authErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const details = error as {
    code?: string;
    message?: string;
    name?: string;
    requestId?: string;
    request_id?: string;
    status?: number;
  };

  return {
    code: details.code ?? null,
    message: details.message ?? null,
    name: details.name ?? null,
    requestId: details.requestId ?? details.request_id ?? null,
    status: details.status ?? null,
  };
}

function logPasswordRecovery(
  stage: string,
  requestUrl: URL,
  details?: {
    error?: unknown;
    redirectPath?: string;
    sessionUserFound?: boolean;
    success?: boolean;
  },
) {
  console.info("[auth:password-recovery]", {
    hasCode: requestUrl.searchParams.has("code"),
    hasTokenHash: requestUrl.searchParams.has("token_hash"),
    host: requestUrl.host,
    next: requestUrl.searchParams.get("next"),
    path: requestUrl.pathname,
    redirectPath: details?.redirectPath ?? null,
    sessionUserFound: details?.sessionUserFound ?? null,
    stage,
    success: details?.success ?? null,
    supabaseError: authErrorDetails(details?.error),
    timestamp: new Date().toISOString(),
    type: requestUrl.searchParams.get("type"),
  });
}

function passwordResetLinkUnavailableRedirect(requestUrl: URL) {
  return passwordResetRedirect(
    requestUrl,
    "Linket kan ikke længere bruges. Det kan allerede være anvendt. Bestil et nyt link, hvis du stadig mangler at oprette din adgangskode.",
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
  if (result.type === "missing_profile") {
    console.info("Auth callback redirecting without facilitator profile", {
      path: result.path,
      type: result.type,
    });

    return NextResponse.redirect(new URL(result.path, getAppUrl(requestUrl.origin)));
  }

  console.info("Auth callback redirecting after profile preparation", {
    path: result.path,
    role: result.profile.role,
    type: result.type,
  });

  return NextResponse.redirect(new URL(result.path, getAppUrl(requestUrl.origin)));
}

function emailConfirmationRedirectResponse(requestUrl: URL, result: PostAuthResult) {
  if (result.type === "missing_profile") {
    return postAuthRedirectResponse(requestUrl, result);
  }

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
  const isPasswordResetFlow = next === "/auth/update-password" || type === "recovery";
  const hasOAuthCookie = Boolean(request.cookies.get(oauthFlowCookie)?.value);
  const isOAuthFlow = flow === "oauth" || hasOAuthCookie;
  const isIdentityLinkFlow = flow === "link-identity";

  if (isPasswordResetFlow) {
    logPasswordRecovery("callback_received", requestUrl);
  }

  if (error) {
    const errorText = `${error} ${errorDescription ?? ""}`;
    console.error("Auth callback returned an error", errorText);

    if (isIdentityLinkFlow) {
      const searchParams = new URLSearchParams({
        message: linkIdentityMessage(
          provider,
          "Hvis loginmetoden allerede tilhører en anden SoulEvents-konto, kan den ikke tilknyttes her.",
        ),
        status: "error",
      });

      return NextResponse.redirect(new URL(`/facilitator?${searchParams.toString()}`, getAppUrl(requestUrl.origin)));
    }

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

  if (flow === "email-change") {
    if (!tokenHash) {
      return emailChangeRedirect(
        requestUrl,
        "Bekræftelseslinket til mailændringen mangler en sikker token. Start ændringen igen fra Login og sikkerhed.",
      );
    }

    if (type !== "email_change") {
      return emailChangeRedirect(
        requestUrl,
        "Bekræftelseslinket til mailændringen har en ugyldig type. Start ændringen igen fra Login og sikkerhed.",
      );
    }

    const emailChangeClient = createTokenVerificationClient(request);
    const { error: verifyError } = await emailChangeClient.supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "email_change",
    });

    if (verifyError) {
      console.error("Email change token verification failed", {
        message: verifyError.message,
      });

      const {
        data: { user: existingUser },
      } = await emailChangeClient.supabase.auth.getUser();

      if (existingUser) {
        const { data: completedRequest } = await emailChangeClient.supabase
          .from("email_change_requests")
          .select("id")
          .eq("profile_id", existingUser.id)
          .eq("status", "completed")
          .ilike("new_email", existingUser.email?.trim().toLowerCase() ?? "")
          .order("confirmed_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (completedRequest) {
          return emailChangeClient.applyCookies(
            emailChangeRedirect(requestUrl, "Mailadressen er allerede blevet bekræftet.", "success"),
          );
        }
      }

      return emailChangeRedirect(
        requestUrl,
        "Bekræftelseslinket er ugyldigt eller udløbet. Start ændringen af mailadresse igen fra Login og sikkerhed.",
      );
    }

    const {
      data: { user },
    } = await emailChangeClient.supabase.auth.getUser();

    if (!user) {
      return emailChangeClient.applyCookies(
        emailChangeRedirect(requestUrl, "Mailændringen blev bekræftet, men sessionen kunne ikke hentes. Log ind og prøv igen."),
      );
    }

    const result = await syncConfirmedEmailChange(user);

    return emailChangeClient.applyCookies(emailChangeRedirect(requestUrl, result.message, result.status));
  }

  if (isPasswordResetFlow && tokenHash && type === "recovery") {
    const passwordResetClient = createTokenVerificationClient(request);
    logPasswordRecovery("verify_token_started", requestUrl);
    const { error: verifyError } = await passwordResetClient.supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });

    if (verifyError) {
      const {
        data: { user: existingUser },
      } = await passwordResetClient.supabase.auth.getUser();

      logPasswordRecovery("verify_token_failed", requestUrl, {
        error: verifyError,
        redirectPath: existingUser ? "/auth/update-password" : "/auth/forgot-password",
        sessionUserFound: Boolean(existingUser),
        success: false,
      });

      if (existingUser) {
        return passwordResetClient.applyCookies(passwordResetRedirect(requestUrl));
      }

      return passwordResetLinkUnavailableRedirect(requestUrl);
    }

    const {
      data: { user },
    } = await passwordResetClient.supabase.auth.getUser();

    logPasswordRecovery("verify_token_succeeded", requestUrl, {
      redirectPath: "/auth/update-password",
      sessionUserFound: Boolean(user),
      success: true,
    });

    return passwordResetClient.applyCookies(passwordResetRedirect(requestUrl));
  }

  if (code) {
    const passwordResetClient = isPasswordResetFlow ? createTokenVerificationClient(request) : null;
    const supabase = passwordResetClient?.supabase ?? (await createClient());
    if (isPasswordResetFlow) {
      logPasswordRecovery("exchange_code_started", requestUrl);
    }
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

      if (isPasswordResetFlow) {
        const {
          data: { user: existingUser },
        } = await supabase.auth.getUser();

        logPasswordRecovery("exchange_code_failed", requestUrl, {
          error: exchangeError,
          redirectPath: existingUser ? "/auth/update-password" : "/auth/forgot-password",
          sessionUserFound: Boolean(existingUser),
          success: false,
        });

        if (existingUser) {
          return passwordResetClient?.applyCookies(passwordResetRedirect(requestUrl)) ?? passwordResetRedirect(requestUrl);
        }
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
        return passwordResetLinkUnavailableRedirect(requestUrl);
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

    if (flow === "email-change") {
      const result = await syncConfirmedEmailChange(user);
      const searchParams = new URLSearchParams({
        message: result.message,
      });

      return NextResponse.redirect(new URL(`/facilitator?${searchParams.toString()}`, getAppUrl(requestUrl.origin)));
    }

    if (isIdentityLinkFlow) {
      const linkedProvider = provider || user.identities?.at(-1)?.provider || "oauth";

      try {
        const admin = createAdminClient();
        const { data: facilitator } = await admin
          .from("facilitator_profiles")
          .select("id")
          .eq("profile_id", user.id)
          .maybeSingle();

        await admin.from("admin_audit_log").insert({
          action: "profile_login_identity_linked",
          actor_profile_id: user.id,
          facilitator_id: facilitator?.id ?? null,
          new_value: linkedProvider,
          old_value: "existing_profile",
          reason: "Facilitator linked an OAuth login method from Login and security.",
        });
      } catch (auditError) {
        console.warn("[auth:link-identity] audit log failed", {
          message: auditError instanceof Error ? auditError.message : "Unknown audit error",
        });
      }

      const searchParams = new URLSearchParams({
        message: `${oauthProviderLabel(linkedProvider)} er nu tilknyttet din SoulEvents-konto.`,
        status: "success",
      });

      return NextResponse.redirect(new URL(`/facilitator?${searchParams.toString()}`, getAppUrl(requestUrl.origin)));
    }

    if (isPasswordResetFlow) {
      logPasswordRecovery("exchange_code_succeeded", requestUrl, {
        redirectPath: "/auth/update-password",
        sessionUserFound: true,
        success: true,
      });
      return passwordResetClient?.applyCookies(passwordResetRedirect(requestUrl)) ?? passwordResetRedirect(requestUrl);
    }

    if (isOAuthFlow || isOAuthUser(user)) {
      let postAuthResult: PostAuthResult;

      try {
        postAuthResult = await getPostAuthRedirect({ createProfileIfMissing: false, user });
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
        return redirectAndClearOAuthCookie(
          NextResponse.redirect(new URL(postAuthResult.path, requestUrl), 303),
          hasOAuthCookie,
        );
      }

      return redirectAndClearOAuthCookie(
        postAuthRedirectResponse(requestUrl, postAuthResult),
        hasOAuthCookie,
      );
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
      return NextResponse.redirect(new URL(postAuthResult.path, requestUrl), 303);
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
          postAuthResult = await getPostAuthRedirect({ createProfileIfMissing: false, user });
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
          return redirectAndClearOAuthCookie(
            NextResponse.redirect(new URL(postAuthResult.path, requestUrl), 303),
            hasOAuthCookie,
          );
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
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      logPasswordRecovery("missing_recovery_code", requestUrl, {
        redirectPath: user ? "/auth/update-password" : "/auth/forgot-password",
        sessionUserFound: Boolean(user),
        success: Boolean(user),
      });

      if (user) {
        return passwordResetRedirect(requestUrl);
      }

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
