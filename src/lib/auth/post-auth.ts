import { createAdminClient } from "@/lib/supabase/admin";
import { getFacilitatorOnboardingStateForProfile } from "@/lib/facilitators/onboarding-state";
import { resolveNameParts } from "@/lib/auth/names";
import { notifyInternalAdminOfNewFacilitatorProfile } from "@/lib/email/facilitator-profile-created-admin";
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
    first_name?: string;
    full_name?: string;
    last_name?: string;
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

type EnsureAppProfileOptions = {
  createFacilitatorIfMissing?: boolean;
  createProfileIfMissing?: boolean;
};

export type PostAuthContext = {
  createFacilitatorIfMissing?: boolean;
  createProfileIfMissing?: boolean;
  email?: string | null;
  intendedPath?: string | null;
  user: AuthUserLike;
};

export type PostAuthResult =
  | {
      path: string;
      type: "missing_profile";
    }
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

function userNameParts(user: AuthUserLike) {
  const fallbackName = user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Bruger";
  return resolveNameParts({
    firstName: user.user_metadata?.first_name,
    fullName: fallbackName,
    lastName: user.user_metadata?.last_name,
  });
}

function roleForUser(user: AuthUserLike): AppRole {
  return user.user_metadata?.role === "admin" ? "admin" : "facilitator";
}

export async function ensureAppProfileForAuthUser(
  user: AuthUserLike,
  options: EnsureAppProfileOptions = {},
): Promise<EnsuredAuthProfile> {
  const createProfileIfMissing = options.createProfileIfMissing !== false;
  const createFacilitatorIfMissing = options.createFacilitatorIfMissing === true;
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
    if (!createProfileIfMissing) {
      return {
        facilitatorProfile: null,
        isNewProfile: true,
        needsProfileCompletion: true,
        profile: {
          email: user.email || "",
          full_name: userNameParts(user).fullName,
          id: user.id,
          phone: null,
          role,
        },
      };
    }

    const nameParts = userNameParts(user);
    const { data: insertedProfile, error: profileError } = await admin
      .from("profiles")
      .insert({
        email: user.email || "",
        full_name: nameParts.fullName,
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
      if (!createFacilitatorIfMissing) {
        return {
          facilitatorProfile: null,
          isNewProfile,
          needsProfileCompletion: true,
          profile: appProfile,
        };
      }

      const { data: insertedFacilitatorProfile, error: facilitatorError } = await admin
        .from("facilitator_profiles")
        .insert({
          profile_id: appProfile.id,
          status: "draft",
        })
        .select("id, slug, company_name, short_description, postal_code, city, status, created_at, is_paused, is_disabled, facilitator_categories(category_id)")
        .single();

      if (facilitatorError || !insertedFacilitatorProfile) {
        throw facilitatorError ?? new Error("Facilitator profile could not be created.");
      }

      facilitatorProfile = insertedFacilitatorProfile as NonNullable<EnsuredAuthProfile["facilitatorProfile"]>;
      notifyInternalAdminOfNewFacilitatorProfile({
        city: insertedFacilitatorProfile.city,
        createdAt: insertedFacilitatorProfile.created_at,
        displayName: insertedFacilitatorProfile.company_name,
        email: appProfile.email,
        fullName: appProfile.full_name,
        phone: appProfile.phone,
        profileId: insertedFacilitatorProfile.id,
        publicSlug: insertedFacilitatorProfile.slug,
        status: insertedFacilitatorProfile.status,
      });
    } else {
      facilitatorProfile = existingFacilitatorProfile as NonNullable<EnsuredAuthProfile["facilitatorProfile"]>;
    }

    needsProfileCompletion = true;
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
  }, {
    createFacilitatorIfMissing: context.createFacilitatorIfMissing,
    createProfileIfMissing: context.createProfileIfMissing,
  });

  if (!ensuredProfile.facilitatorProfile && ensuredProfile.profile.role === "facilitator") {
    return {
      path: "/auth/oauth-profile",
      type: "missing_profile",
    };
  }

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
      path: "/facilitator/deactivated",
      profile: ensuredProfile.profile,
      type: "disabled",
    };
  }

  const admin = createAdminClient();
  const onboardingState = ensuredProfile.facilitatorProfile
    ? await getFacilitatorOnboardingStateForProfile(admin, {
        fullName: ensuredProfile.profile.full_name,
        profileId: ensuredProfile.profile.id,
      })
    : "onboarding";

  if (onboardingState === "onboarding" || onboardingState === "changes_requested") {
    const path = ensuredProfile.isNewProfile
      ? "/facilitator/welcome"
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
