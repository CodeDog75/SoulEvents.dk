import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/app-url";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/database";

export const dynamic = "force-dynamic";

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
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileLookupError) {
    return { error: profileLookupError, isNewProfile: false, needsProfileCompletion: true, role: "facilitator" as AppRole };
  }

  const role = (existingProfile?.role ?? (user.user_metadata?.role === "admin" ? "admin" : "facilitator")) as AppRole;
  const isNewProfile = !existingProfile;

  if (!existingProfile) {
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
      .eq("profile_id", user.id)
      .maybeSingle();

    if (facilitatorLookupError) {
      return { error: facilitatorLookupError, isNewProfile, needsProfileCompletion, role };
    }

    if (!facilitatorProfile) {
      const { error: facilitatorError } = await admin.from("facilitator_profiles").insert({
        profile_id: user.id,
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
    return NextResponse.redirect(new URL("/admin", getAppUrl(requestUrl.origin)));
  }

  if (input.needsProfileCompletion) {
    const profileUrl = new URL("/facilitator/profile", getAppUrl(requestUrl.origin));

    if (input.isNewProfile) {
      profileUrl.searchParams.set(
        "message",
        "Velkommen til SoulEvents. Færdiggør din profil, så vi kan gøre den klar til godkendelse.",
      );
    }

    return NextResponse.redirect(profileUrl);
  }

  return NextResponse.redirect(new URL("/facilitator", getAppUrl(requestUrl.origin)));
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const flow = requestUrl.searchParams.get("flow");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";

  if (error) {
    const errorText = `${error} ${errorDescription ?? ""}`;
    const message = isExpiredOrInvalidLink(errorText)
      ? "Bekræftelseslinket er udløbet eller er allerede brugt. Skriv din e-mailadresse herunder, så sender vi et nyt link."
      : "E-mailbekræftelsen kunne ikke gennemføres. Prøv det nyeste link fra din indbakke, eller send en ny bekræftelsesmail.";

    return confirmationRedirect(requestUrl, message, isExpiredOrInvalidLink(errorText) ? "expired" : "needed");
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("Auth callback session exchange failed", exchangeError);

      if (!isExpiredOrInvalidLink(exchangeError.message)) {
        return confirmedRedirect(requestUrl, {
          session: "missing",
        });
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
      return confirmationRedirect(requestUrl, "Login kunne ikke gennemføres. Prøv igen.");
    }

    if (flow === "oauth" || isOAuthUser(user)) {
      const { error: profileError, isNewProfile, needsProfileCompletion, role } = await ensureOAuthProfile(user);

      if (profileError) {
        console.error("OAuth profile preparation failed", profileError);
        return confirmationRedirect(requestUrl, "Login lykkedes, men profilen kunne ikke gøres klar. Prøv igen om lidt.");
      }

      return oauthRedirectFor(requestUrl, { isNewProfile, needsProfileCompletion, role });
    }
  } else {
    return confirmationRedirect(
      requestUrl,
      "Bekræftelseslinket mangler en kode. Åbn det nyeste link fra din indbakke, eller send en ny bekræftelsesmail herunder.",
    );
  }

  return confirmedRedirect(requestUrl, { next });
}
