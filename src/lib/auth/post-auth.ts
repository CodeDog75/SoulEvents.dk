import { createAdminClient } from "@/lib/supabase/admin";
import type { AppRole } from "@/types/database";

export const disabledFacilitatorLoginMessage =
  "Din arrangørkonto er deaktiveret. Kontakt SoulEvents, hvis du mener, at dette er en fejl.";

export type AuthUserLike = {
  app_metadata?: {
    provider?: string;
  };
  email?: string | null;
  id: string;
  identities?: Array<{
    provider?: string;
  }>;
  user_metadata?: {
    full_name?: string;
    name?: string;
    role?: string;
  };
};

export type AppProfile = {
  email: string;
  full_name: string;
  id: string;
  phone: string | null;
  role: AppRole;
};

export type EnsuredAuthProfile = {
  facilitatorProfile: {
    city: string | null;
    company_name: string | null;
    facilitator_categories?: Array<{ category_id: string }> | null;
    id: string;
    is_disabled: boolean;
    is_paused?: boolean | null;
    postal_code: string | null;
    short_description: string | null;
    status?: string | null;
  } | null;
  isNewProfile: boolean;
  needsProfileCompletion: boolean;
  profile: AppProfile;
};

export type PostAuthContext = {
  email?: string | null;
  intendedPath?: string | null;
  user: AuthUserLike;
};

export type PostAuthResult =
  | {
      path: string;
      profile: AppProfile;
      type: "redirect";
    }
  | {
      message: string;
      path: string;
      profile: AppProfile;
      type: "disabled";
    };

function userDisplayName(user: AuthUserLike) {
  return user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Bruger";
}

function roleForUser(user: AuthUserLike): AppRole {
  return user.user_metadata?.role === "admin" ? "admin" : "facilitator";
}

function isFacilitatorProfileComplete(facilitatorProfile: NonNullable<EnsuredAuthProfile["facilitatorProfile"]>) {
  return (
    Boolean(facilitatorProfile.company_name) &&
    Boolean(facilitatorProfile.postal_code) &&
    Boolean(facilitatorProfile.city) &&
    Boolean(facilitatorProfile.short_description && facilitatorProfile.short_description.trim().length >= 20) &&
    Boolean(facilitatorProfile.facilitator_categories?.length)
  );
}

export async function ensureAppProfileForAuthUser(user: AuthUserLike): Promise<EnsuredAuthProfile> {
  const admin = createAdminClient();
  const { data: profileById, error: profileByIdError } = await admin
    .from("profiles")
    .select("id, role, full_name, email, phone")
    .eq("id", user.id)
    .maybeSingle();

  if (profileByIdError) {
    throw profileByIdError;
  }

  let appProfile = profileById as AppProfile | null;

  if (!appProfile && user.email) {
    const { data: profileByEmail, error: profileByEmailError } = await admin
      .from("profiles")
      .select("id, role, full_name, email, phone")
      .eq("email", user.email)
      .maybeSingle();

    if (profileByEmailError) {
      throw profileByEmailError;
    }

    appProfile = profileByEmail as AppProfile | null;
  }

  const isNewProfile = !appProfile;
  const role = appProfile?.role ?? roleForUser(user);

  if (!appProfile) {
    const { data: insertedProfile, error: profileError } = await admin
      .from("profiles")
      .insert({
        email: user.email || "",
        full_name: userDisplayName(user),
        id: user.id,
        phone: null,
        role,
      })
      .select("id, role, full_name, email, phone")
      .single();

    if (profileError || !insertedProfile) {
      throw profileError ?? new Error("App profile could not be created.");
    }

    appProfile = insertedProfile as AppProfile;
  }

  let facilitatorProfile: EnsuredAuthProfile["facilitatorProfile"] = null;
  let needsProfileCompletion = appProfile.role === "facilitator";

  if (appProfile.role === "facilitator") {
    const { data: existingFacilitatorProfile, error: facilitatorLookupError } = await admin
      .from("facilitator_profiles")
      .select("id, company_name, short_description, postal_code, city, status, is_paused, is_disabled, facilitator_categories(category_id)")
      .eq("profile_id", appProfile.id)
      .maybeSingle();

    if (facilitatorLookupError) {
      throw facilitatorLookupError;
    }

    if (!existingFacilitatorProfile) {
      const { data: insertedFacilitatorProfile, error: facilitatorError } = await admin
        .from("facilitator_profiles")
        .insert({
          profile_id: appProfile.id,
          status: "pending",
        })
        .select("id, company_name, short_description, postal_code, city, status, is_paused, is_disabled, facilitator_categories(category_id)")
        .single();

      if (facilitatorError || !insertedFacilitatorProfile) {
        throw facilitatorError ?? new Error("Facilitator profile could not be created.");
      }

      facilitatorProfile = insertedFacilitatorProfile as NonNullable<EnsuredAuthProfile["facilitatorProfile"]>;
    } else {
      facilitatorProfile = existingFacilitatorProfile as NonNullable<EnsuredAuthProfile["facilitatorProfile"]>;
    }

    needsProfileCompletion = !isFacilitatorProfileComplete(facilitatorProfile);
  }

  return {
    facilitatorProfile,
    isNewProfile,
    needsProfileCompletion,
    profile: appProfile,
  };
}

export async function getPostAuthRedirect(context: PostAuthContext): Promise<PostAuthResult> {
  const ensuredProfile = await ensureAppProfileForAuthUser({
    ...context.user,
    email: context.email ?? context.user.email,
  });

  if (ensuredProfile.profile.role === "admin") {
    return {
      path: "/admin",
      profile: ensuredProfile.profile,
      type: "redirect",
    };
  }

  if (ensuredProfile.facilitatorProfile?.is_disabled) {
    return {
      message: disabledFacilitatorLoginMessage,
      path: "/auth/login",
      profile: ensuredProfile.profile,
      type: "disabled",
    };
  }

  if (ensuredProfile.needsProfileCompletion) {
    const path = ensuredProfile.isNewProfile
      ? "/facilitator/profile?message=" +
        encodeURIComponent("Velkommen til SoulEvents. Færdiggør din profil, så vi kan gøre den klar til godkendelse.")
      : "/facilitator/profile";

    return {
      path,
      profile: ensuredProfile.profile,
      type: "redirect",
    };
  }

  return {
    path: context.intendedPath && context.intendedPath.startsWith("/") && !context.intendedPath.startsWith("//")
      ? context.intendedPath
      : "/facilitator",
    profile: ensuredProfile.profile,
    type: "redirect",
  };
}
