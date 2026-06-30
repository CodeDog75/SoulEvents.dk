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

async function ensureOAuthProfile(user: {
  id: string;
  email?: string;
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
    return { error: profileLookupError, isNewProfile: false, role: "facilitator" as AppRole };
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
      return { error: profileError, isNewProfile, role };
    }
  }

  if (role === "facilitator") {
    const { data: facilitatorProfile, error: facilitatorLookupError } = await admin
      .from("facilitator_profiles")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (facilitatorLookupError) {
      return { error: facilitatorLookupError, isNewProfile, role };
    }

    if (!facilitatorProfile) {
      const { error: facilitatorError } = await admin.from("facilitator_profiles").insert({
        profile_id: user.id,
        status: "pending",
      });

      if (facilitatorError) {
        return { error: facilitatorError, isNewProfile, role };
      }
    }
  }

  return { error: null, isNewProfile, role };
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
      if (!isExpiredOrInvalidLink(exchangeError.message)) {
        return confirmedRedirect(requestUrl, {
          session: "missing",
        });
      }

      const message =
        "Bekræftelseslinket er udløbet eller er allerede brugt. Skriv din e-mailadresse herunder, så sender vi et nyt link.";

      return confirmationRedirect(requestUrl, message, isExpiredOrInvalidLink(exchangeError.message) ? "expired" : "needed");
    }

    if (flow === "oauth") {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return confirmationRedirect(requestUrl, "Login kunne ikke gennemføres. Prøv igen.");
      }

      const { error: profileError, isNewProfile, role } = await ensureOAuthProfile(user);

      if (profileError) {
        return confirmationRedirect(requestUrl, "Login lykkedes, men profilen kunne ikke gøres klar. Prøv igen om lidt.");
      }

      if (isNewProfile && role === "facilitator") {
        const profileUrl = new URL("/facilitator/profile", getAppUrl(requestUrl.origin));
        profileUrl.searchParams.set("message", "Velkommen til SoulEvents. Færdiggør din profil, så vi kan gøre den klar til godkendelse.");
        return NextResponse.redirect(profileUrl);
      }

      return NextResponse.redirect(new URL(role === "admin" ? "/admin" : "/dashboard", getAppUrl(requestUrl.origin)));
    }
  } else {
    return confirmationRedirect(
      requestUrl,
      "Bekræftelseslinket mangler en kode. Åbn det nyeste link fra din indbakke, eller send en ny bekræftelsesmail herunder.",
    );
  }

  return confirmedRedirect(requestUrl, { next });
}
