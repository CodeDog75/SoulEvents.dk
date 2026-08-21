"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/app-url";
import { requireProfile } from "@/lib/auth/roles";
import { resolveNameParts } from "@/lib/auth/names";
import { sendEmailChangeSecurityNotice } from "@/lib/email/email-change";
import {
  getAllStrings,
  getOptionalString,
  getString,
} from "@/lib/forms/form-data";
import {
  profileApprovalUrl,
  sendFacilitatorProfileReadyEmail,
} from "@/lib/email/facilitator-profile-ready";
import {
  normalizeFacilitatorMoodImagePaths,
  normalizeFacilitatorMoodImageSlots,
} from "@/lib/facilitators/mood-image-slots";
import {
  facilitatorSubmissionMissingLabels,
  getFacilitatorProfileReadiness,
  getFacilitatorSubmissionReadiness,
} from "@/lib/facilitators/profile-readiness";
import { getProfileLocationSaveValidation } from "@/lib/facilitators/profile-location-save-validation";
import { facilitatorWorkAreaSlugs } from "@/lib/facilitators/work-areas";
import {
  getMissingRequiredLegalAcceptances,
  organizerAcceptanceTypes,
  recordLegalAcceptances,
} from "@/lib/legal/documents";
import {
  inferProfileCountryCode,
  isDanishProfileCountry,
  isOtherProfileCountry,
  normalizeInternationalPostalCode,
} from "@/lib/locations/countries";
import {
  getLocalDanishPostalCity,
  normalizeDanishPostalCode,
} from "@/lib/locations/danish-postal-codes";
import { geocodeDanishAddress } from "@/lib/mapbox/geocode";
import { inferRegionSlug } from "@/lib/regions/infer-region";
import {
  assertRateLimit,
  isRateLimitExceededError,
  RATE_LIMIT_MESSAGE,
} from "@/lib/rate-limit";
import { validateSocialProfileLink } from "@/lib/social-profile-links";
import { publicFacilitatorPath } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ensureMediaStorageBucket } from "@/lib/supabase/storage-buckets";
import {
  danishPhoneValidationMessage,
  normalizeDanishPhoneNumber,
} from "@/lib/danish-phone";

export type ChangePasswordFormState = {
  fieldErrors?: {
    confirmPassword?: string;
    currentPassword?: string;
    newPassword?: string;
  };
  message?: string;
  status: "error" | "idle" | "success";
};

export type ChangeEmailFormState = {
  fieldErrors?: {
    confirmEmail?: string;
    currentPassword?: string;
    newEmail?: string;
  };
  message?: string;
  status: "error" | "idle" | "success";
};

function safeRedirectOrigin(origin: string | null) {
  if (!origin) {
    return null;
  }

  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();
    const isLocalNetwork =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.");
    const isKnownHost =
      hostname === "soul-events-dk.vercel.app" ||
      hostname === "soulevents.dk" ||
      hostname === "www.soulevents.dk";

    if (
      (url.protocol === "http:" || url.protocol === "https:") &&
      (isLocalNetwork || isKnownHost)
    ) {
      return url.origin;
    }
  } catch {
    return null;
  }

  return null;
}

function shortId(value: string | null | undefined) {
  return value ? value.slice(0, 8) : null;
}

function logCategorySaveError(context: {
  action: string;
  allowedAreaSlugs?: string[];
  categoryIds: string[];
  error: { code?: string; details?: string; hint?: string; message?: string };
  facilitatorId?: string | null;
  invalidValues?: string[];
  profileId?: string | null;
  resolvedAreaIds?: string[];
  stage: string;
  yogaRow?: {
    id: string;
    is_active: boolean | null;
    name: string | null;
    slug: string | null;
  } | null;
}) {
  console.error("[facilitator-profile] category save failed", {
    action: context.action,
    allowedAreaSlugs: context.allowedAreaSlugs,
    categoryCount: context.categoryIds.length,
    code: context.error.code,
    details: context.error.details,
    facilitatorId: shortId(context.facilitatorId),
    hint: context.error.hint,
    invalidValues: context.invalidValues,
    message: context.error.message,
    profileId: shortId(context.profileId),
    receivedAreaValues: context.categoryIds,
    resolvedAreaIds: context.resolvedAreaIds,
    stage: context.stage,
    yogaRow: context.yogaRow,
  });
}

function categorySaveMessage(error: { code?: string; message?: string }) {
  if (error.code === "42703" && error.message?.includes("specialties")) {
    return "Databasen mangler feltet til specialer. Kør migration 068_facilitator_areas_and_specialties.sql og prøv igen.";
  }

  return "Arrangørprofilen kunne ikke gemmes.";
}

function profileSaveMessage(
  error: { code?: string; message?: string },
  section: ProfileSection,
) {
  if (section === "location") {
    return "Kontrollér postnummer og by.";
  }

  return categorySaveMessage(error);
}

async function revalidatePublicFacilitatorProfilePaths(
  supabase: ReturnType<typeof createAdminClient>,
  facilitatorId: string,
  ...knownSlugs: Array<string | null | undefined>
) {
  revalidatePath("/facilitators/" + facilitatorId);

  const { data: currentProfile } = await supabase
    .from("facilitator_profiles")
    .select("slug")
    .eq("id", facilitatorId)
    .maybeSingle();
  const slugs = new Set(
    [...knownSlugs, currentProfile?.slug]
      .map((slug) => slug?.trim())
      .filter((slug): slug is string => Boolean(slug)),
  );

  if (slugs.size === 0) {
    revalidatePath(publicFacilitatorPath(facilitatorId));
    return;
  }

  for (const slug of slugs) {
    revalidatePath(publicFacilitatorPath(slug));
  }
}

function sanitizedLocationPayload(
  updates: Record<string, string | number | boolean | string[] | null>,
) {
  return {
    cityPresent:
      typeof updates.city === "string" && updates.city.trim().length > 0,
    country: typeof updates.country === "string" ? updates.country : null,
    countryNamePresent:
      typeof updates.country_name === "string" &&
      updates.country_name.trim().length > 0,
    hasAddressLine:
      typeof updates.address_line === "string" &&
      updates.address_line.trim().length > 0,
    postalCode:
      typeof updates.postal_code === "string"
        ? {
            length: updates.postal_code.length,
            value: updates.postal_code,
          }
        : null,
    regionIdPresent:
      typeof updates.region_id === "string" &&
      updates.region_id.trim().length > 0,
    regionTextPresent:
      typeof updates.region_text === "string" &&
      updates.region_text.trim().length > 0,
  };
}

function isMissingOptionalLocationColumnError(error: {
  code?: string;
  message?: string;
}) {
  const message = error.message ?? "";
  return (
    (error.code === "PGRST204" || error.code === "42703") &&
    (message.includes("country_name") ||
      message.includes("region_text") ||
      message.includes("show_public_location"))
  );
}

function withoutOptionalLocationColumns(
  updates: Record<string, string | number | boolean | string[] | null>,
) {
  const fallbackUpdates = { ...updates };
  delete fallbackUpdates.country_name;
  delete fallbackUpdates.region_text;
  delete fallbackUpdates.show_public_location;
  return fallbackUpdates;
}

async function updateFacilitatorProfileRecord(input: {
  match: { column: "id" | "profile_id"; value: string };
  supabase: ReturnType<typeof createAdminClient>;
  updates: Record<string, string | number | boolean | string[] | null>;
}) {
  const runUpdate = (
    updates: Record<string, string | number | boolean | string[] | null>,
  ) =>
    input.supabase
      .from("facilitator_profiles")
      .update(updates)
      .eq(input.match.column, input.match.value);

  const result = await runUpdate(input.updates);

  if (!result.error || !isMissingOptionalLocationColumnError(result.error)) {
    return {
      error: result.error,
      omittedOptionalLocationColumns: false,
      originalError: null,
    };
  }

  const fallbackUpdates = withoutOptionalLocationColumns(input.updates);
  const fallbackResult = await runUpdate(fallbackUpdates);

  return {
    error: fallbackResult.error,
    omittedOptionalLocationColumns: !fallbackResult.error,
    originalError: result.error,
  };
}

async function getAllowedCategoryIds(
  supabase: ReturnType<typeof createAdminClient>,
) {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, is_active")
    .in("slug", facilitatorWorkAreaSlugs)
    .eq("is_active", true);

  if (error) return { error, ids: new Set<string>(), rows: [] };

  return {
    error: null,
    ids: new Set((data ?? []).map((category) => category.id as string)),
    rows: data ?? [],
  };
}

function categoryDebugContext(
  allowedCategoryResult: Awaited<ReturnType<typeof getAllowedCategoryIds>>,
  invalidValues: string[] = [],
) {
  return {
    allowedAreaSlugs: allowedCategoryResult.rows
      .map((category) => category.slug as string)
      .filter(Boolean),
    invalidValues,
    resolvedAreaIds: allowedCategoryResult.rows
      .map((category) => category.id as string)
      .filter(Boolean),
    yogaRow: allowedCategoryResult.rows.find(
      (category) => category.slug === "yoga",
    ) as
      | {
          id: string;
          is_active: boolean | null;
          name: string | null;
          slug: string | null;
        }
      | undefined,
  };
}

const editableProfileSections = [
  "contact",
  "location",
  "social",
  "images",
  "categories",
  "payment",
  "services",
] as const;
type EditableProfileSection = (typeof editableProfileSections)[number];
type ProfileSection = EditableProfileSection | "all";

type ProfileAutosaveInput = {
  adminTargetFacilitatorId?: string | null;
  section: EditableProfileSection;
  values: Record<string, boolean | string | string[] | null>;
};

const profileImageMaxFileSize = 10 * 1024 * 1024;
const moodImageActionMaxFileSize = 15 * 1024 * 1024;
const specialtyMaxLength = 180;

function normalizeSpecialtyText(input: string | null | undefined) {
  return (input ?? "").replace(/\s+/g, " ").trim();
}

function isEditableProfileSection(
  value: string | null | undefined,
): value is EditableProfileSection {
  return editableProfileSections.includes(value as EditableProfileSection);
}

function normalizeProfileSection(
  value: string | null | undefined,
): ProfileSection | null {
  return value === "all" || isEditableProfileSection(value) ? value : null;
}

function savesSection(section: ProfileSection, target: EditableProfileSection) {
  return section === "all" || section === target;
}

function fallbackErrorSection(
  section: ProfileSection,
  fallback: EditableProfileSection,
): EditableProfileSection {
  return section === "all" ? fallback : section;
}

function logProfileReference(profileId: string) {
  return profileId.length > 8 ? profileId.slice(0, 8) + "..." : "unknown";
}

async function updateProfileContactFields(input: {
  fullName: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  profileId: string;
}) {
  const admin = createAdminClient();
  const nameParts = resolveNameParts({
    firstName: input.firstName,
    fullName: input.fullName,
    lastName: input.lastName,
  });

  const { data: authUserData, error: authUserError } =
    await admin.auth.admin.getUserById(input.profileId);
  const profileRef = logProfileReference(input.profileId);
  if (authUserError) {
    console.error(
      "[facilitator-profile:contact] Auth user metadata could not be loaded",
      {
        code: authUserError.code,
        message: authUserError.message,
        profileRef,
      },
    );
    return { error: authUserError, ok: false };
  }

  const existingMetadata =
    authUserData.user?.user_metadata &&
    typeof authUserData.user.user_metadata === "object"
      ? authUserData.user.user_metadata
      : {};
  const { error: authMetadataError } = await admin.auth.admin.updateUserById(
    input.profileId,
    {
      user_metadata: {
        ...existingMetadata,
        first_name: nameParts.firstName || undefined,
        full_name: nameParts.fullName,
        last_name: nameParts.lastName || undefined,
      },
    },
  );

  if (authMetadataError) {
    console.error(
      "[facilitator-profile:contact] Auth user metadata could not be updated",
      {
        code: authMetadataError.code,
        message: authMetadataError.message,
        profileRef,
      },
    );
    return { error: authMetadataError, ok: false };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: nameParts.fullName,
      phone: input.phone,
    })
    .eq("id", input.profileId);

  if (profileError) {
    console.error(
      "[facilitator-profile:contact] Profile contact fields could not be updated",
      {
        code: profileError.code,
        details: profileError.details,
        hint: profileError.hint,
        message: profileError.message,
        profileRef,
      },
    );
    return { error: profileError, ok: false };
  }

  return { fullName: nameParts.fullName, ok: true };
}

function profileRedirect(
  message: string,
  origin?: string | null,
  errorSection?: EditableProfileSection,
): never {
  const params = new URLSearchParams({ message });

  if (errorSection) {
    params.set("errorSection", errorSection);
  }

  const path = `/facilitator/profile?${params.toString()}`;
  const redirectOrigin = safeRedirectOrigin(origin ?? null);

  redirect(redirectOrigin ? `${redirectOrigin}${path}` : path);
}

function safeAdminReturnPath(
  value: string | null | undefined,
  fallback = "/admin/users",
) {
  if (!value || !value.startsWith("/") || value.startsWith("//"))
    return fallback;

  try {
    const url = new URL(value, "https://soulevents.local");
    if (!url.pathname.startsWith("/admin")) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

function clearAdminUsersSearchParams(returnPath: string) {
  const url = new URL(returnPath, "https://soulevents.local");
  if (url.pathname !== "/admin/users") {
    return returnPath;
  }

  url.searchParams.delete("q");
  url.searchParams.delete("type");
  url.searchParams.delete("page");
  url.searchParams.delete("event_page");
  return url.pathname + (url.search ? url.search : "") + url.hash;
}

function adminProfileRedirect(
  message: string,
  returnTo: string | null | undefined,
  errorSection?: EditableProfileSection,
): never {
  const safeReturnTo = safeAdminReturnPath(returnTo);
  const params = new URLSearchParams({ message });

  if (errorSection) {
    params.set("errorSection", errorSection);
  }

  const separator = safeReturnTo.includes("?") ? "&" : "?";
  redirect(`${safeReturnTo}${separator}${params.toString()}`);
}

function extensionForUpload(file: File, contentType = file.type) {
  if (contentType === "image/jpeg") {
    return "jpg";
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension && /^[a-z0-9]+$/.test(extension) ? extension : "jpg";
}

function isHeicImage(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    extension === "heic" ||
    extension === "heif"
  );
}

function isValidWebUrl(value: string) {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parsePaymentDeadlineDays(value: string) {
  const fallback = value ? Number(value) : 14;
  return Number.isInteger(fallback) && fallback >= 0 && fallback <= 60
    ? fallback
    : null;
}

function normalizeLocationFields(input: {
  city: string | null;
  country: string | null;
  countryName?: string | null;
  postalCode: string | null;
  regionText?: string | null;
}) {
  const rawCountry = input.country?.trim() ?? "";
  const country = inferProfileCountryCode(input);
  const isDanishLocation = isDanishProfileCountry(country);
  const isOtherCountry = isOtherProfileCountry(country);
  const postalCode = isDanishLocation
    ? normalizeDanishPostalCode(input.postalCode ?? "")
    : normalizeInternationalPostalCode(input.postalCode ?? "").trim();
  const localDanishCity =
    isDanishLocation && postalCode.length === 4
      ? getLocalDanishPostalCity(postalCode)
      : null;
  const countryNameFallback =
    rawCountry &&
    rawCountry.toUpperCase() !== "OTHER" &&
    rawCountry.toLowerCase() !== "andet land"
      ? rawCountry
      : "";
  const countryName = isOtherCountry
    ? (input.countryName?.trim() || countryNameFallback).slice(0, 80)
    : "";
  const regionText = isDanishLocation
    ? ""
    : (input.regionText?.trim().slice(0, 80) ?? "");

  return {
    city: localDanishCity || input.city?.trim() || "",
    country,
    countryName,
    isDanishLocation,
    isOtherCountry,
    postalCode,
    regionText,
  };
}

function validateLocationFields(
  input: ReturnType<typeof normalizeLocationFields>,
  options: {
    requireComplete?: boolean;
    requireOtherCountryName?: boolean;
  } = {},
) {
  return (
    getProfileLocationSaveValidation({
      city: input.city,
      countryName: input.countryName,
      isDanishLocation: input.isDanishLocation,
      isOtherCountry: input.isOtherCountry,
      postalCode: input.postalCode,
      requireComplete: options.requireComplete,
      requireOtherCountryName: options.requireOtherCountryName,
    }).validationMessage || null
  );
}

function isProfileReady(input: {
  categoryIds: string[];
  city: string | null;
  companyName: string | null;
  fullName: string | null;
  postalCode: string | null;
}) {
  return getFacilitatorProfileReadiness({
    categoryIds: input.categoryIds,
    city: input.city,
    companyName: input.companyName,
    fullName: input.fullName,
    postalCode: input.postalCode,
    requireLocation: true,
    shortDescription: "Indsendelse fra klassisk profilformular",
  }).isComplete;
}

function profileSuccessRedirect(
  message: string,
  ready: boolean,
  origin?: string | null,
  savedSection?: ProfileSection,
): never {
  const params = new URLSearchParams({ message });

  if (ready) {
    params.set("ready", "1");
  }

  if (savedSection) {
    params.set("saved", savedSection);
  }

  const path = `/facilitator/profile?${params.toString()}`;
  const redirectOrigin = safeRedirectOrigin(origin ?? null);

  redirect(redirectOrigin ? `${redirectOrigin}${path}` : path);
}

function adminProfileSuccessRedirect(
  message: string,
  returnTo: string | null | undefined,
  savedSection?: ProfileSection,
): never {
  const safeReturnTo = clearAdminUsersSearchParams(
    safeAdminReturnPath(returnTo),
  );
  const params = new URLSearchParams({ message });

  if (savedSection) {
    params.set("saved", savedSection);
  }

  const separator = safeReturnTo.includes("?") ? "&" : "?";
  redirect(`${safeReturnTo}${separator}${params.toString()}`);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ukendt fejl";
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

function authProvidersForUser(
  user: { identities?: Array<{ provider?: string }> } | null | undefined,
) {
  return (
    user?.identities
      ?.map((identity) => identity.provider)
      .filter((provider): provider is string => Boolean(provider)) ?? []
  );
}

function hasEmailPasswordIdentity(
  user: { identities?: Array<{ provider?: string }> } | null | undefined,
) {
  return authProvidersForUser(user).includes("email");
}

async function findFacilitatorByProfileId(
  supabase: ReturnType<typeof createAdminClient>,
  profileId: string,
) {
  const { data } = await supabase
    .from("facilitator_profiles")
    .select("id, company_name")
    .eq("profile_id", profileId)
    .maybeSingle();

  return data;
}

async function emailIsUsedByAnotherProfile(
  supabase: ReturnType<typeof createAdminClient>,
  email: string,
  profileId: string,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .neq("id", profileId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function emailIsPendingForAnotherProfile(
  supabase: ReturnType<typeof createAdminClient>,
  email: string,
  profileId: string,
) {
  const { data, error } = await supabase
    .from("email_change_requests")
    .select("id")
    .ilike("new_email", email)
    .neq("profile_id", profileId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function emailIsUsedByAnotherAuthUser(
  supabase: ReturnType<typeof createAdminClient>,
  email: string,
  profileId: string,
) {
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      console.warn("[email-change] Auth duplicate lookup failed", {
        message: error.message,
        profileRef: logProfileReference(profileId),
      });
      return false;
    }

    if (
      data.users.some(
        (user) => user.id !== profileId && normalizeEmail(user.email) === email,
      )
    ) {
      return true;
    }

    if (data.users.length < perPage) {
      return false;
    }

    page += 1;
  }
}

export async function changeFacilitatorPasswordAction(
  _previousState: ChangePasswordFormState,
  formData: FormData,
): Promise<ChangePasswordFormState> {
  const profile = await requireProfile();
  const currentPassword = getString(formData, "current_password");
  const newPassword = getString(formData, "new_password");
  const confirmPassword = getString(formData, "confirm_password");
  const fieldErrors: NonNullable<ChangePasswordFormState["fieldErrors"]> = {};

  if (!currentPassword) {
    fieldErrors.currentPassword = "Indtast din nuværende adgangskode.";
  }

  if (newPassword.length < 10) {
    fieldErrors.newPassword = "Adgangskoden skal være mindst 10 tegn.";
  }

  if (newPassword !== confirmPassword) {
    fieldErrors.confirmPassword = "De to adgangskoder er ikke ens.";
  }

  if (currentPassword && newPassword && currentPassword === newPassword) {
    fieldErrors.newPassword =
      "Den nye adgangskode skal være forskellig fra den nuværende.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, status: "error" };
  }

  try {
    await assertRateLimit("auth:password-change");
  } catch (error) {
    if (isRateLimitExceededError(error)) {
      return { message: RATE_LIMIT_MESSAGE, status: "error" };
    }

    return {
      message: "Adgangskoden kunne ikke ændres. Prøv igen.",
      status: "error",
    };
  }

  const supabase = await createClient();
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword,
    });

  if (signInError || signInData.user?.id !== profile.id) {
    return {
      fieldErrors: { currentPassword: "Adgangskoden kunne ikke bekræftes. Hvis du endnu ikke har en personlig adgangskode, skal du oprette eller nulstille den først." },
      status: "error",
    };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    return {
      message: "Adgangskoden kunne ikke ændres. Prøv igen.",
      status: "error",
    };
  }

  return { message: "Din adgangskode er ændret.", status: "success" };
}

export async function createFacilitatorPasswordAction(
  _previousState: ChangePasswordFormState,
  formData: FormData,
): Promise<ChangePasswordFormState> {
  const profile = await requireProfile();
  const newPassword = getString(formData, "new_password");
  const confirmPassword = getString(formData, "confirm_password");
  const fieldErrors: NonNullable<ChangePasswordFormState["fieldErrors"]> = {};

  if (newPassword.length < 10) {
    fieldErrors.newPassword = "Adgangskoden skal være mindst 10 tegn.";
  }

  if (newPassword !== confirmPassword) {
    fieldErrors.confirmPassword = "De to adgangskoder er ikke ens.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, status: "error" };
  }

  try {
    await assertRateLimit("auth:password-change");
  } catch (error) {
    if (isRateLimitExceededError(error)) {
      return { message: RATE_LIMIT_MESSAGE, status: "error" };
    }

    return {
      message: "Adgangskoden kunne ikke oprettes. Prøv igen.",
      status: "error",
    };
  }

  const admin = createAdminClient();
  const { data: authUserData, error: authUserError } =
    await admin.auth.admin.getUserById(profile.id);
  const providers = authProvidersForUser(authUserData.user);

  if (authUserError || !authUserData.user) {
    console.error(
      "[facilitator-password:create] Auth user could not be loaded",
      {
        error: authErrorDetails(authUserError),
        profileRef: logProfileReference(profile.id),
      },
    );
    return {
      message: "Adgangskoden kunne ikke oprettes. Prøv igen.",
      status: "error",
    };
  }

  if (hasEmailPasswordIdentity(authUserData.user)) {
    return {
      message:
        "Kontoen har allerede adgangskode. Brug Skift adgangskode i stedet.",
      status: "error",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: sessionError,
  } = await supabase.auth.getUser();

  if (sessionError || user?.id !== profile.id) {
    console.error("[facilitator-password:create] Session user mismatch", {
      error: authErrorDetails(sessionError),
      profileRef: logProfileReference(profile.id),
    });
    return {
      message:
        "Adgangskoden kunne ikke oprettes. Log ind igen og prøv derefter.",
      status: "error",
    };
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(
    profile.id,
    {
      password: newPassword,
    },
  );

  if (updateError) {
    console.error(
      "[facilitator-password:create] Password could not be created",
      {
        error: authErrorDetails(updateError),
        profileRef: logProfileReference(profile.id),
        providers,
      },
    );
    return {
      message: "Adgangskoden kunne ikke oprettes. Prøv igen.",
      status: "error",
    };
  }

  const facilitator = await findFacilitatorByProfileId(admin, profile.id);
  await admin.from("admin_audit_log").insert({
    action: "profile_password_created",
    actor_profile_id: profile.id,
    facilitator_id: facilitator?.id ?? null,
    new_value: "password_login_enabled",
    old_value: providers.join(",") || "oauth_only",
    reason:
      "Facilitator created email/password login for existing OAuth account.",
  });

  revalidatePath("/facilitator");
  return {
    message:
      "Din personlige adgangskode er oprettet. Du kan nu logge ind med både din eksterne loginmetode og din e-mailadresse.",
    status: "success",
  };
}

export async function requestFacilitatorEmailChangeAction(
  _previousState: ChangeEmailFormState,
  formData: FormData,
): Promise<ChangeEmailFormState> {
  const profile = await requireProfile();
  const currentPassword = getString(formData, "current_password");
  const newEmail = normalizeEmail(getString(formData, "new_email"));
  const confirmEmail = normalizeEmail(getString(formData, "confirm_new_email"));
  const currentEmail = normalizeEmail(profile.email);
  const fieldErrors: NonNullable<ChangeEmailFormState["fieldErrors"]> = {};

  if (!currentPassword) {
    fieldErrors.currentPassword = "Indtast din nuværende adgangskode.";
  }

  if (!isValidEmail(newEmail)) {
    fieldErrors.newEmail = "Indtast en gyldig mailadresse.";
  }

  if (newEmail !== confirmEmail) {
    fieldErrors.confirmEmail = "De to mailadresser er ikke ens.";
  }

  if (newEmail && newEmail === currentEmail) {
    fieldErrors.newEmail =
      "Den nye mailadresse er den samme som den nuværende.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, status: "error" };
  }

  try {
    await assertRateLimit("auth:email-change");
  } catch (error) {
    if (isRateLimitExceededError(error)) {
      return { message: RATE_LIMIT_MESSAGE, status: "error" };
    }

    return {
      message: "Mailændringen kunne ikke startes. Prøv igen.",
      status: "error",
    };
  }

  const supabase = createAdminClient();
  const pendingResult = await supabase
    .from("email_change_requests")
    .select("id, new_email, expires_at")
    .eq("profile_id", profile.id)
    .eq("status", "pending")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingResult.error) {
    return {
      message: "Aktuelle mailændringer kunne ikke kontrolleres.",
      status: "error",
    };
  }

  if (
    pendingResult.data &&
    new Date(pendingResult.data.expires_at).getTime() >= Date.now()
  ) {
    return {
      message:
        "Der findes allerede en mailændring, som afventer bekræftelse. Annullér den først, hvis du vil vælge en anden adresse.",
      status: "error",
    };
  }

  if (pendingResult.data) {
    await supabase
      .from("email_change_requests")
      .update({ status: "expired" })
      .eq("id", pendingResult.data.id);
  }

  try {
    const isDuplicate =
      (await emailIsUsedByAnotherProfile(supabase, newEmail, profile.id)) ||
      (await emailIsPendingForAnotherProfile(supabase, newEmail, profile.id)) ||
      (await emailIsUsedByAnotherAuthUser(supabase, newEmail, profile.id));

    if (isDuplicate) {
      return {
        fieldErrors: {
          newEmail: "Mailadressen bruges allerede af en anden konto.",
        },
        status: "error",
      };
    }
  } catch (error) {
    console.error("[email-change] Duplicate lookup failed", {
      message: errorMessage(error),
      profileRef: logProfileReference(profile.id),
    });
    return {
      message: "Mailadressen kunne ikke kontrolleres sikkert. Prøv igen.",
      status: "error",
    };
  }

  const userSupabase = await createClient();
  const { data: signInData, error: signInError } =
    await userSupabase.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword,
    });

  if (signInError || signInData.user?.id !== profile.id) {
    return {
      fieldErrors: { currentPassword: "Adgangskoden kunne ikke bekræftes. Hvis du endnu ikke har en personlig adgangskode, skal du oprette eller nulstille den først." },
      status: "error",
    };
  }

  const facilitator = await findFacilitatorByProfileId(supabase, profile.id);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: requestRow, error: requestError } = await supabase
    .from("email_change_requests")
    .insert({
      expires_at: expiresAt,
      facilitator_id: facilitator?.id ?? null,
      new_email: newEmail,
      old_email: profile.email,
      profile_id: profile.id,
      requested_by_profile_id: profile.id,
      requested_by_role: "facilitator",
    })
    .select("id")
    .single();

  if (requestError || !requestRow) {
    return {
      message: "Mailændringen kunne ikke registreres. Prøv igen.",
      status: "error",
    };
  }

  const { error: updateError } = await userSupabase.auth.updateUser(
    { email: newEmail },
    { emailRedirectTo: `${getAppUrl()}/auth/callback?flow=email-change` },
  );

  if (updateError) {
    await supabase
      .from("email_change_requests")
      .update({ status: "cancelled" })
      .eq("id", requestRow.id);
    return {
      message:
        "Supabase kunne ikke sende bekræftelsen til den nye mailadresse.",
      status: "error",
    };
  }

  await sendEmailChangeSecurityNotice({
    newEmail,
    oldEmail: profile.email,
    recipientName: profile.full_name,
    requestedBy: "facilitator",
  });

  await supabase.from("admin_audit_log").insert({
    action: "profile_email_change_requested",
    actor_profile_id: profile.id,
    facilitator_id: facilitator?.id ?? null,
    new_value: "email_change_pending",
    old_value: "email_change_current",
    reason: "Arrangør anmodede om ændring af loginmail.",
  });

  revalidatePath("/facilitator");
  return {
    message:
      "Vi har sendt en bekræftelse til den nye mailadresse. Din gamle mailadresse er aktiv, indtil ændringen er bekræftet.",
    status: "success",
  };
}

export async function cancelFacilitatorEmailChangeAction(
  _previousState: ChangeEmailFormState,
  _formData: FormData,
): Promise<ChangeEmailFormState> {
  const profile = await requireProfile();
  const supabase = createAdminClient();
  const { data: pendingRequest, error } = await supabase
    .from("email_change_requests")
    .select("id, facilitator_id")
    .eq("profile_id", profile.id)
    .eq("status", "pending")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { message: "Mailændringen kunne ikke hentes.", status: "error" };
  }

  if (!pendingRequest) {
    return {
      message: "Der er ingen aktiv mailændring at annullere.",
      status: "success",
    };
  }

  const { error: updateError } = await supabase
    .from("email_change_requests")
    .update({ cancelled_at: new Date().toISOString(), status: "cancelled" })
    .eq("id", pendingRequest.id);

  if (updateError) {
    return { message: "Mailændringen kunne ikke annulleres.", status: "error" };
  }

  const { error: authResetError } = await supabase.auth.admin.updateUserById(
    profile.id,
    {
      email: profile.email,
      email_confirm: true,
    },
  );

  if (authResetError) {
    console.warn(
      "[email-change] Pending auth email could not be reset after cancellation",
      {
        message: authResetError.message,
        profileRef: logProfileReference(profile.id),
      },
    );
  }

  await supabase.from("admin_audit_log").insert({
    action: "profile_email_change_cancelled",
    actor_profile_id: profile.id,
    facilitator_id: pendingRequest.facilitator_id,
    new_value: "email_change_cancelled",
    old_value: "email_change_pending",
    reason: "Arrangør annullerede mailændring.",
  });

  revalidatePath("/facilitator");
  return {
    message:
      "Mailændringen er annulleret. Din nuværende mailadresse er stadig aktiv.",
    status: "success",
  };
}

async function notifyAdminsIfReady(input: {
  facilitatorEmail: string;
  facilitatorId: string;
  facilitatorName: string;
  wasReady: boolean;
}) {
  if (input.wasReady) {
    return;
  }

  const supabase = createAdminClient();
  const { data: admins, error: adminsError } = await supabase
    .from("profiles")
    .select("email")
    .eq("role", "admin");

  if (adminsError) {
    console.error(
      "[facilitator-profile] Admin-notifikation kunne ikke forberedes",
      {
        error: adminsError.message,
        facilitatorId: input.facilitatorId,
      },
    );
    return;
  }

  const submittedAt = new Date().toISOString();
  const adminEmails = (admins ?? [])
    .map((admin) => admin.email)
    .filter((email): email is string => Boolean(email));

  if (adminEmails.length === 0) {
    console.error(
      "[facilitator-profile] Ingen admin-modtagere fundet til profilnotifikation",
      {
        facilitatorId: input.facilitatorId,
      },
    );
    return;
  }

  const results = await Promise.allSettled(
    adminEmails.map((adminEmail) =>
      sendFacilitatorProfileReadyEmail({
        adminEmail,
        facilitatorEmail: input.facilitatorEmail,
        facilitatorName: input.facilitatorName,
        profileUrl: profileApprovalUrl(),
        submittedAt,
      }),
    ),
  );

  const failedMessages = results
    .filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    )
    .map((result) => errorMessage(result.reason));

  if (failedMessages.length > 0) {
    console.error(
      "[facilitator-profile] Admin-notifikation fejlede efter profilgemning",
      {
        errors: failedMessages,
        failed: failedMessages.length,
        facilitatorId: input.facilitatorId,
      },
    );
  }
}

export async function autosaveFacilitatorProfileAction(
  input: ProfileAutosaveInput,
) {
  const profile = await requireProfile();
  const supabase = createAdminClient();
  const section = isEditableProfileSection(input.section)
    ? input.section
    : null;
  const adminTargetFacilitatorId =
    input.adminTargetFacilitatorId?.trim() || null;

  if (!section) {
    return { message: "Profilafsnittet kunne ikke genkendes.", ok: false };
  }

  if (adminTargetFacilitatorId && profile.role !== "admin") {
    return {
      message: "Du har ikke adgang til at redigere denne arrangørprofil.",
      ok: false,
    };
  }

  const profileLookup = supabase
    .from("facilitator_profiles")
    .select("id, profile_id, facilitator_images(image_path, sort_order)");
  const { data: existingProfile, error: existingProfileError } =
    adminTargetFacilitatorId
      ? await profileLookup.eq("id", adminTargetFacilitatorId).single()
      : await profileLookup.eq("profile_id", profile.id).single();

  if (existingProfileError || !existingProfile) {
    console.error("[facilitator-profile] Autosave profile lookup failed", {
      adminTargetFacilitatorRef: adminTargetFacilitatorId
        ? shortId(adminTargetFacilitatorId)
        : null,
      authenticatedProfileRef: logProfileReference(profile.id),
      code: existingProfileError?.code,
      details: existingProfileError?.details,
      hint: existingProfileError?.hint,
      message:
        existingProfileError?.message ??
        "No facilitator profile row matched the current profile.",
      operation: "select",
      section,
      table: "facilitator_profiles",
    });
    return { message: "Arrangørprofilen kunne ikke hentes.", ok: false };
  }

  const facilitatorId = existingProfile.id as string;
  const targetProfileId =
    (existingProfile.profile_id as string | null) ?? profile.id;
  const updates: Record<string, boolean | number | string | string[] | null> =
    {};

  if (section === "contact") {
    const fullName = valueForAutosave(input.values.full_name);
    const firstName = valueForAutosave(input.values.first_name);
    const lastName = valueForAutosave(input.values.last_name);
    const phoneInput = valueForAutosave(input.values.phone);
    const phone = normalizeDanishPhoneNumber(phoneInput);
    const companyName = valueForAutosave(input.values.company_name);
    const shortDescription = valueForAutosave(input.values.short_description);
    const longDescription = valueForAutosave(input.values.long_description);

    if (
      fullName.length > 80 ||
      firstName.length > 80 ||
      lastName.length > 80 ||
      companyName.length > 100 ||
      shortDescription.length > 300 ||
      longDescription.length > 2000
    ) {
      return { message: "Et felt er længere end tilladt.", ok: false };
    }

    if (phoneInput && phone === null) {
      return {
        message: danishPhoneValidationMessage,
        ok: false,
      };
    }

    const contactResult = await updateProfileContactFields({
      firstName,
      fullName,
      lastName,
      phone: phone || null,
      profileId: profile.id,
    });

    if (!contactResult.ok) {
      return { message: "Kontaktoplysningerne kunne ikke gemmes.", ok: false };
    }

    updates.company_name = companyName;
    updates.long_description = longDescription;
    updates.short_description = shortDescription;
  }

  if (section === "location") {
    const addressLine = valueForAutosave(input.values.address_line);
    const locationFields = normalizeLocationFields({
      city: valueForAutosave(input.values.city),
      country: valueForAutosave(input.values.country),
      countryName: valueForAutosave(input.values.country_name),
      postalCode: valueForAutosave(input.values.postal_code),
      regionText: valueForAutosave(input.values.region_text),
    });
    const isOnlineFacilitator = input.values.is_online_facilitator === true;

    if (
      addressLine.length > 120 ||
      locationFields.postalCode.length > 16 ||
      locationFields.city.length > 80 ||
      locationFields.country.length > 5 ||
      locationFields.countryName.length > 80 ||
      locationFields.regionText.length > 80
    ) {
      return { message: "Et lokationsfelt er længere end tilladt.", ok: false };
    }

    const locationValidationMessage = validateLocationFields(locationFields, {
      requireComplete: false,
      requireOtherCountryName: false,
    });

    if (locationValidationMessage) {
      return { message: locationValidationMessage, ok: false };
    }

    let regionId: string | null = null;
    const inferredSlug = locationFields.isDanishLocation
      ? inferRegionSlug({
          city: locationFields.city,
          postalCode: locationFields.postalCode,
        })
      : null;

    if (inferredSlug) {
      const { data: inferredRegion } = await supabase
        .from("regions")
        .select("id")
        .eq("slug", inferredSlug)
        .maybeSingle();
      regionId = inferredRegion?.id ?? null;
    }

    const coordinates =
      locationFields.isDanishLocation &&
      locationFields.postalCode &&
      locationFields.city
        ? await geocodeDanishAddress({
            addressLine,
            postalCode: locationFields.postalCode,
            city: locationFields.city,
          })
        : null;

    updates.address_line = addressLine;
    updates.city = locationFields.city;
    updates.country = locationFields.country;
    updates.country_name = locationFields.countryName || null;
    updates.is_online_facilitator = isOnlineFacilitator;
    updates.latitude = coordinates?.latitude ?? null;
    updates.longitude = coordinates?.longitude ?? null;
    updates.postal_code = locationFields.postalCode;
    updates.region_id = regionId;
    updates.region_text = locationFields.regionText || null;
    updates.show_public_location = input.values.show_public_location !== false;
  }

  if (section === "social") {
    const publicEmail = valueForAutosave(input.values.public_email);
    const publicPhone = valueForAutosave(input.values.public_phone);
    const websiteUrl = valueForAutosave(input.values.website_url);
    const facebookUrl = valueForAutosave(input.values.facebook_url);
    const instagramUrl = valueForAutosave(input.values.instagram_url);
    const youtubeUrl = valueForAutosave(input.values.youtube_url);
    const tiktokUrl = valueForAutosave(input.values.tiktok_url);

    if (
      publicEmail.length > 180 ||
      publicPhone.length > 40 ||
      websiteUrl.length > 300 ||
      facebookUrl.length > 300 ||
      instagramUrl.length > 300 ||
      youtubeUrl.length > 300 ||
      tiktokUrl.length > 300
    ) {
      return { message: "Et link er længere end tilladt.", ok: false };
    }

    const facebookValidation = validateSocialProfileLink(
      facebookUrl,
      "facebook",
    );
    if (!facebookValidation.ok) {
      return { message: facebookValidation.message, ok: false };
    }

    const instagramValidation = validateSocialProfileLink(
      instagramUrl,
      "instagram",
    );
    if (!instagramValidation.ok) {
      return { message: instagramValidation.message, ok: false };
    }

    updates.facebook_url = facebookValidation.value;
    updates.instagram_url = instagramValidation.value;
    updates.public_email = publicEmail;
    updates.public_phone = publicPhone;
    updates.tiktok_url = tiktokUrl;
    updates.website_url = websiteUrl;
    updates.youtube_url = youtubeUrl;
  }

  if (section === "payment") {
    const mobilepayNumber = valueForAutosave(
      input.values.payment_mobilepay_number,
    );
    const bankRegistrationNumber = valueForAutosave(
      input.values.payment_bank_registration_number,
    );
    const bankAccountNumber = valueForAutosave(
      input.values.payment_bank_account_number,
    );
    const bankAccountName = valueForAutosave(
      input.values.payment_bank_account_name,
    );
    const externalUrl = valueForAutosave(input.values.payment_external_url);
    const instructions = valueForAutosave(input.values.payment_instructions);
    const deadlineDays = parsePaymentDeadlineDays(
      valueForAutosave(input.values.payment_deadline_days),
    );

    if (
      mobilepayNumber.length > 40 ||
      bankRegistrationNumber.length > 20 ||
      bankAccountNumber.length > 40 ||
      bankAccountName.length > 120 ||
      externalUrl.length > 300 ||
      instructions.length > 800
    ) {
      return { message: "Et betalingsfelt er længere end tilladt.", ok: false };
    }

    if (!isValidWebUrl(externalUrl)) {
      return {
        message: "Betalingslink skal starte med http:// eller https://.",
        ok: false,
      };
    }

    if (deadlineDays === null) {
      return {
        message: "Betalingsfrist skal være mellem 0 og 60 dage.",
        ok: false,
      };
    }

    const { error: paymentSettingsError } = await supabase
      .from("facilitator_payment_settings")
      .upsert(
        {
          facilitator_id: facilitatorId,
          mobilepay_number: mobilepayNumber || null,
          bank_registration_number: bankRegistrationNumber || null,
          bank_account_number: bankAccountNumber || null,
          bank_account_name: bankAccountName || null,
          external_url: externalUrl || null,
          instructions: instructions || null,
          deadline_days: deadlineDays,
        },
        { onConflict: "facilitator_id" },
      );

    if (paymentSettingsError) {
      console.error(
        "[facilitator-profile:payment] Payment settings could not be saved",
        {
          authenticatedProfileRef: logProfileReference(profile.id),
          code: paymentSettingsError.code,
          details: paymentSettingsError.details,
          facilitatorId,
          facilitatorOwnerMatchesAuthenticatedProfile:
            targetProfileId === profile.id,
          hint: paymentSettingsError.hint,
          message: paymentSettingsError.message,
          operation: "upsert",
          payloadColumns: [
            "facilitator_id",
            "mobilepay_number",
            "bank_registration_number",
            "bank_account_number",
            "bank_account_name",
            "external_url",
            "instructions",
            "deadline_days",
          ],
          profileRef: logProfileReference(targetProfileId),
          table: "facilitator_payment_settings",
          upsertOnConflict: "facilitator_id",
        },
      );
      return {
        message: "Betalingsoplysningerne kunne ikke gemmes.",
        ok: false,
      };
    }
  }

  if (section === "services") {
    if (typeof input.values.offers_services !== "boolean") {
      return {
        message: "Vælg, om du også tilbyder individuelle ydelser.",
        ok: false,
      };
    }

    const offersServices = input.values.offers_services === true;
    const serviceDescription = valueForAutosave(
      input.values.service_description,
    );
    const showInLocalServiceResults =
      input.values.show_in_local_service_results === true;

    if (serviceDescription.length > 500) {
      return { message: "Et ydelsesfelt er længere end tilladt.", ok: false };
    }

    updates.offers_services = offersServices;
    updates.individual_service_other_title = null;
    updates.individual_service_types = [];
    updates.service_description = offersServices ? serviceDescription : null;
    updates.show_in_local_service_results =
      offersServices && showInLocalServiceResults;
  }

  if (section === "images") {
    // Banner and mood images are saved by dedicated image actions.
  }

  let autosaveCategoryDebug: ReturnType<typeof categoryDebugContext> | null =
    null;

  if (section === "categories") {
    const categoryIds = [
      ...new Set(arrayForAutosave(input.values.category_ids)),
    ];
    const specialties = normalizeSpecialtyText(
      valueForAutosave(input.values.specialties),
    );

    if (specialties.length > specialtyMaxLength) {
      return { message: "Specialet må højst være 180 tegn.", ok: false };
    }

    if (categoryIds.length === 0) {
      return { message: "Vælg mindst ét arbejdsområde.", ok: false };
    }

    const allowedCategoryResult = await getAllowedCategoryIds(supabase);
    if (allowedCategoryResult.error) {
      logCategorySaveError({
        action: "autosaveFacilitatorProfileAction",
        categoryIds,
        error: allowedCategoryResult.error,
        facilitatorId,
        profileId: targetProfileId,
        stage: "load_allowed_categories",
      });
      return {
        message: "Arbejdsområderne kunne ikke kontrolleres.",
        ok: false,
      };
    }

    const invalidCategoryIds = categoryIds.filter(
      (categoryId) => !allowedCategoryResult.ids.has(categoryId),
    );
    autosaveCategoryDebug = categoryDebugContext(
      allowedCategoryResult,
      invalidCategoryIds,
    );
    if (invalidCategoryIds.length > 0) {
      logCategorySaveError({
        action: "autosaveFacilitatorProfileAction",
        categoryIds,
        error: {
          message: "Invalid facilitator work area ids",
          details: invalidCategoryIds.join(","),
        },
        facilitatorId,
        ...autosaveCategoryDebug,
        profileId: targetProfileId,
        stage: "validate_allowed_categories",
      });
      return {
        message: "Vælg et gyldigt arbejdsområde fra listen.",
        ok: false,
      };
    }

    if (categoryIds.length > 0) {
      const { error: categoryError } = await supabase
        .from("facilitator_categories")
        .upsert(
          categoryIds.map((categoryId) => ({
            facilitator_id: facilitatorId,
            category_id: categoryId,
          })),
          { onConflict: "facilitator_id,category_id" },
        );

      if (categoryError) {
        logCategorySaveError({
          action: "autosaveFacilitatorProfileAction",
          categoryIds,
          error: categoryError,
          facilitatorId,
          ...autosaveCategoryDebug,
          profileId: targetProfileId,
          stage: "upsert_facilitator_categories",
        });
        return { message: "Arbejdsområderne kunne ikke gemmes.", ok: false };
      }

      const { error: deleteCategoryError } = await supabase
        .from("facilitator_categories")
        .delete()
        .eq("facilitator_id", facilitatorId)
        .not("category_id", "in", `(${categoryIds.join(",")})`);

      if (deleteCategoryError) {
        logCategorySaveError({
          action: "autosaveFacilitatorProfileAction",
          categoryIds,
          error: deleteCategoryError,
          facilitatorId,
          ...autosaveCategoryDebug,
          profileId: targetProfileId,
          stage: "delete_removed_facilitator_categories",
        });
        return { message: "Arbejdsområderne kunne ikke gemmes.", ok: false };
      }
    } else {
      const { error: deleteCategoryError } = await supabase
        .from("facilitator_categories")
        .delete()
        .eq("facilitator_id", facilitatorId);

      if (deleteCategoryError) {
        logCategorySaveError({
          action: "autosaveFacilitatorProfileAction",
          categoryIds,
          error: deleteCategoryError,
          facilitatorId,
          ...autosaveCategoryDebug,
          profileId: targetProfileId,
          stage: "delete_all_facilitator_categories",
        });
        return { message: "Arbejdsområderne kunne ikke gemmes.", ok: false };
      }
    }

    updates.specialties = specialties || null;
  }

  if (Object.keys(updates).length > 0) {
    const {
      error: facilitatorError,
      omittedOptionalLocationColumns,
      originalError,
    } = await updateFacilitatorProfileRecord({
      match: adminTargetFacilitatorId
        ? { column: "id", value: facilitatorId }
        : { column: "profile_id", value: profile.id },
      supabase,
      updates,
    });

    if (omittedOptionalLocationColumns) {
      console.warn(
        "[facilitator-profile] Optional international location columns are missing",
        {
          code: originalError?.code,
          message: originalError?.message,
          missingColumns: [
            "country_name",
            "region_text",
            "show_public_location",
          ],
          section,
        },
      );
    }

    if (facilitatorError) {
      if (section === "categories") {
        logCategorySaveError({
          action: "autosaveFacilitatorProfileAction",
          categoryIds: arrayForAutosave(input.values.category_ids),
          error: facilitatorError,
          facilitatorId,
          ...(autosaveCategoryDebug ?? {}),
          profileId: targetProfileId,
          stage: "update_facilitator_profile",
        });
      } else {
        console.error(
          "[facilitator-profile] Profile section could not be saved",
          {
            authenticatedProfileRef: logProfileReference(profile.id),
            code: facilitatorError.code,
            details: facilitatorError.details,
            facilitatorId,
            facilitatorOwnerMatchesAuthenticatedProfile:
              targetProfileId === profile.id,
            hint: facilitatorError.hint,
            locationPayload:
              section === "location"
                ? sanitizedLocationPayload(updates)
                : undefined,
            message: facilitatorError.message,
            operation: "update",
            payloadColumns: Object.keys(updates),
            profileRef: logProfileReference(targetProfileId),
            section,
            table: "facilitator_profiles",
          },
        );
      }
      return {
        message: profileSaveMessage(facilitatorError, section),
        ok: false,
      };
    }
  }

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/profile");

  return { message: "Gemt", ok: true };
}

function valueForAutosave(
  value: boolean | string | string[] | null | undefined,
) {
  return typeof value === "string" ? value.trim() : "";
}

function arrayForAutosave(
  value: boolean | string | string[] | null | undefined,
) {
  return Array.isArray(value) ? value.filter((item) => item.trim()) : [];
}

async function ensureMediaBucket(
  supabase: ReturnType<typeof createAdminClient>,
  redirectOrigin?: string | null,
  errorSection: EditableProfileSection = "images",
  adminReturnTo?: string | null,
) {
  const error = await ensureMediaStorageBucket(supabase);

  if (error && !error.message.toLowerCase().includes("already exists")) {
    if (adminReturnTo) {
      adminProfileRedirect(
        "Storage-bucket 'media' kunne ikke oprettes automatisk. Kør storage-migrationen i Supabase.",
        adminReturnTo,
        errorSection,
      );
    }
    profileRedirect(
      "Storage-bucket 'media' kunne ikke oprettes automatisk. Kør storage-migrationen i Supabase.",
      redirectOrigin,
      errorSection,
    );
  }
}

async function uploadImage(
  supabase: ReturnType<typeof createAdminClient>,
  file: FormDataEntryValue | null,
  prefix: string,
  redirectOrigin?: string | null,
  errorSection: EditableProfileSection = "images",
  adminReturnTo?: string | null,
  maxFileSizeBytes = profileImageMaxFileSize,
) {
  if (!(file instanceof File) || file.size === 0) {
    return null;
  }

  if (isHeicImage(file)) {
    if (adminReturnTo) {
      adminProfileRedirect(
        "HEIC-billedet kunne ikke konverteres. Prøv et andet billede eller eksportér som JPG.",
        adminReturnTo,
        errorSection,
      );
    }
    profileRedirect(
      "HEIC-billedet kunne ikke konverteres. Prøv et andet billede eller eksportér som JPG.",
      redirectOrigin,
      errorSection,
    );
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    if (adminReturnTo) {
      adminProfileRedirect(
        "Du kan uploade JPG, PNG, WEBP eller HEIC. HEIC konverteres automatisk i browseren.",
        adminReturnTo,
        errorSection,
      );
    }
    profileRedirect(
      "Du kan uploade JPG, PNG, WEBP eller HEIC. HEIC konverteres automatisk i browseren.",
      redirectOrigin,
      errorSection,
    );
  }

  if (file.size > maxFileSizeBytes) {
    const maxMegabytes = Math.round(maxFileSizeBytes / (1024 * 1024));
    if (adminReturnTo) {
      adminProfileRedirect(
        `Billedet er for stort. Vælg et billede på højst ${maxMegabytes} MB.`,
        adminReturnTo,
        errorSection,
      );
    }
    profileRedirect(
      `Billedet er for stort. Vælg et billede på højst ${maxMegabytes} MB.`,
      redirectOrigin,
      errorSection,
    );
  }

  await ensureMediaBucket(
    supabase,
    redirectOrigin,
    errorSection,
    adminReturnTo,
  );

  const path = `${prefix}/${crypto.randomUUID()}.${extensionForUpload(file)}`;
  const { error } = await supabase.storage.from("media").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    const maxMegabytes = Math.round(maxFileSizeBytes / (1024 * 1024));
    if (adminReturnTo) {
      adminProfileRedirect(
        `Billedet kunne ikke uploades. Tjek at media-bucket findes i Supabase, og at filen er JPG, PNG eller WebP under ${maxMegabytes} MB.`,
        adminReturnTo,
        errorSection,
      );
    }
    profileRedirect(
      `Billedet kunne ikke uploades. Tjek at media-bucket findes i Supabase, og at filen er JPG, PNG eller WebP under ${maxMegabytes} MB.`,
      redirectOrigin,
      errorSection,
    );
  }

  return path;
}

function imageActionError(message: string) {
  return { message, status: "error" as const };
}

function imageActionSuccess(paths: string[]) {
  return { paths, status: "success" as const };
}

function imageLogContext(
  context: Record<string, boolean | number | string | null | undefined>,
) {
  return Object.fromEntries(
    Object.entries(context).filter(([, value]) => value !== undefined),
  );
}

function safeIdSuffix(value: string | null | undefined) {
  return value ? `...${value.slice(-8)}` : null;
}

function safePathSuffix(value: string | null | undefined) {
  return value ? `...${value.slice(-32)}` : null;
}

function isOwnFacilitatorBannerPath(
  path: string | null | undefined,
  profileId: string | null | undefined,
) {
  return Boolean(path && profileId && path.startsWith(`hosts/${profileId}/banner/`));
}

function logMoodImageError(
  message: string,
  context: Record<string, boolean | number | string | null | undefined>,
  error?: { code?: string; message?: string } | null,
) {
  console.error(
    "[facilitator-profile:mood-image]",
    imageLogContext({
      ...context,
      errorCode: error?.code,
      errorMessage: error?.message,
      message,
    }),
  );
}

async function uploadImageForAction(
  supabase: ReturnType<typeof createAdminClient>,
  file: FormDataEntryValue | null,
  prefix: string,
  maxFileSizeBytes = moodImageActionMaxFileSize,
) {
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Vælg et billede, og prøv igen.", path: null };
  }

  if (isHeicImage(file)) {
    return {
      error:
        "HEIC-billedet kunne ikke konverteres. Prøv et andet billede eller eksportér som JPG.",
      path: null,
    };
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return { error: "Du kan uploade JPG, PNG eller WebP.", path: null };
  }

  if (file.size > maxFileSizeBytes) {
    const maxMegabytes = Math.round(maxFileSizeBytes / (1024 * 1024));
    return {
      error: `Billedet er for stort. Vælg et billede på højst ${maxMegabytes} MB.`,
      path: null,
    };
  }

  const path = `${prefix}/${crypto.randomUUID()}.${extensionForUpload(file)}`;
  const { error } = await supabase.storage.from("media").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    return { error: "Billedet kunne ikke uploades. Prøv igen.", path: null };
  }

  return { error: null, path };
}

export async function saveFacilitatorBannerImageAction(formData: FormData) {
  const profile = await requireProfile();
  const supabase = createAdminClient();
  const adminTargetFacilitatorId = getOptionalString(
    formData,
    "admin_target_facilitator_id",
  );
  const shouldRemove = formData.get("remove") === "yes";
  const imageFile = formData.get("image_file");
  const fileContext =
    imageFile instanceof File
      ? {
          fileSize: imageFile.size,
          mimeType: imageFile.type || "unknown",
        }
      : {
          fileSize: null,
          mimeType: null,
        };
  const baseLogContext = {
    action: "saveFacilitatorBannerImageAction",
    adminTargetFacilitatorId: safeIdSuffix(adminTargetFacilitatorId),
    profileId: safeIdSuffix(profile.id),
    shouldRemove,
    ...fileContext,
  };

  if (adminTargetFacilitatorId && profile.role !== "admin") {
    logMoodImageError(
      "Admin banner image target rejected for non-admin",
      baseLogContext,
    );
    return imageActionError(
      "Du har ikke adgang til at redigere denne arrangør.",
    );
  }

  let facilitatorProfileQuery = supabase
    .from("facilitator_profiles")
    .select("id, profile_id, facilitator_banner_image_path")
    .limit(1);

  facilitatorProfileQuery = adminTargetFacilitatorId
    ? facilitatorProfileQuery.eq("id", adminTargetFacilitatorId)
    : facilitatorProfileQuery.eq("profile_id", profile.id);

  const { data: facilitatorProfiles, error: profileError } =
    await facilitatorProfileQuery;
  const facilitatorProfile = facilitatorProfiles?.[0] ?? null;

  if (profileError || !facilitatorProfile) {
    logMoodImageError(
      "Facilitator profile lookup failed for banner image",
      baseLogContext,
      profileError,
    );
    return imageActionError("Arrangørprofilen kunne ikke hentes.");
  }

  const logContext = {
    ...baseLogContext,
    facilitatorId: safeIdSuffix(facilitatorProfile.id),
    targetProfileId: safeIdSuffix(facilitatorProfile.profile_id),
  };
  let uploadedPath: string | null = null;

  if (!shouldRemove) {
    const upload = await uploadImageForAction(
      supabase,
      imageFile,
      `hosts/${facilitatorProfile.profile_id ?? profile.id}/banner`,
      profileImageMaxFileSize,
    );

    if (upload.error || !upload.path) {
      logMoodImageError(
        upload.error ?? "Banner image upload failed",
        logContext,
      );
      return imageActionError(
        upload.error ?? "Bannerbilledet kunne ikke uploades.",
      );
    }

    uploadedPath = upload.path;
  }

  const { error: updateError } = await supabase
    .from("facilitator_profiles")
    .update({ facilitator_banner_image_path: uploadedPath })
    .eq("id", facilitatorProfile.id);

  if (updateError) {
    if (uploadedPath) {
      await supabase.storage.from("media").remove([uploadedPath]);
    }
    logMoodImageError(
      "Banner image database save failed",
      {
        ...logContext,
        uploadedPath: safePathSuffix(uploadedPath),
      },
      updateError,
    );
    return imageActionError("Bannerbilledet kunne ikke gemmes.");
  }

  const oldPath = facilitatorProfile.facilitator_banner_image_path;
  const oldPathIsOwnBanner = isOwnFacilitatorBannerPath(
    oldPath,
    facilitatorProfile.profile_id ?? profile.id,
  );
  if (oldPath && oldPath !== uploadedPath && oldPathIsOwnBanner) {
    const { error: removeOldFileError } = await supabase.storage
      .from("media")
      .remove([oldPath]);

    if (removeOldFileError) {
      logMoodImageError(
        "Old banner image storage cleanup failed",
        {
          ...logContext,
          oldPath: safePathSuffix(oldPath),
          uploadedPath: safePathSuffix(uploadedPath),
        },
        removeOldFileError,
      );
    }
  } else if (oldPath && oldPath !== uploadedPath) {
    logMoodImageError("Skipped banner storage cleanup outside own banner path", {
      ...logContext,
      oldPath: safePathSuffix(oldPath),
      uploadedPath: safePathSuffix(uploadedPath),
    });
  }

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/profile");
  if (adminTargetFacilitatorId) {
    revalidatePath(`/admin/facilitators/${adminTargetFacilitatorId}/edit`);
  }
  await revalidatePublicFacilitatorProfilePaths(
    supabase,
    facilitatorProfile.id,
  );

  return { path: uploadedPath, status: "success" as const };
}

export async function saveFacilitatorMoodImageAction(formData: FormData) {
  const profile = await requireProfile();
  const supabase = createAdminClient();
  const adminTargetFacilitatorId = getOptionalString(
    formData,
    "admin_target_facilitator_id",
  );
  const slotIndex = Number(formData.get("slot_index"));
  const shouldRemove = formData.get("remove") === "yes";
  const imageFile = formData.get("image_file");
  const fileContext =
    imageFile instanceof File
      ? {
          fileSize: imageFile.size,
          mimeType: imageFile.type || "unknown",
        }
      : {
          fileSize: null,
          mimeType: null,
        };
  const baseLogContext = {
    action: "saveFacilitatorMoodImageAction",
    adminTargetFacilitatorId: safeIdSuffix(adminTargetFacilitatorId),
    profileId: safeIdSuffix(profile.id),
    shouldRemove,
    slotIndex: Number.isFinite(slotIndex) ? slotIndex : null,
    ...fileContext,
  };

  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 2) {
    logMoodImageError("Invalid mood image slot", baseLogContext);
    return imageActionError("Billedpladsen kunne ikke genkendes. Prøv igen.");
  }

  if (adminTargetFacilitatorId && profile.role !== "admin") {
    logMoodImageError(
      "Admin mood image target rejected for non-admin",
      baseLogContext,
    );
    return imageActionError(
      "Du har ikke adgang til at redigere denne arrangør.",
    );
  }

  let facilitatorProfileQuery = supabase
    .from("facilitator_profiles")
    .select("id, profile_id")
    .limit(1);

  facilitatorProfileQuery = adminTargetFacilitatorId
    ? facilitatorProfileQuery.eq("id", adminTargetFacilitatorId)
    : facilitatorProfileQuery.eq("profile_id", profile.id);

  const { data: facilitatorProfiles, error: profileError } =
    await facilitatorProfileQuery;
  const facilitatorProfile = facilitatorProfiles?.[0] ?? null;

  if (profileError || !facilitatorProfile) {
    logMoodImageError(
      "Facilitator profile lookup failed",
      baseLogContext,
      profileError,
    );
    return imageActionError("Arrangørprofilen kunne ikke hentes.");
  }

  let uploadedPath: string | null = null;
  const sortOrder = slotIndex + 1;
  const logContext = {
    ...baseLogContext,
    facilitatorId: safeIdSuffix(facilitatorProfile.id),
    targetProfileId: safeIdSuffix(facilitatorProfile.profile_id),
    sortOrder,
  };

  const { data: beforeRows, error: beforeRowsError } = await supabase
    .from("facilitator_images")
    .select("image_path, sort_order")
    .eq("facilitator_id", facilitatorProfile.id)
    .order("sort_order");

  if (beforeRowsError) {
    logMoodImageError(
      "Mood image rows initial reload failed",
      logContext,
      beforeRowsError,
    );
    return imageActionError("Billedgalleriet kunne ikke hentes.");
  }

  const beforePaths = normalizeFacilitatorMoodImagePaths(
    beforeRows as
      | Array<{ image_path: string; sort_order: number }>
      | null
      | undefined,
  );

  if (shouldRemove) {
    const { error: deleteSlotError } = await supabase
      .from("facilitator_images")
      .delete()
      .eq("facilitator_id", facilitatorProfile.id)
      .eq("sort_order", sortOrder);

    if (deleteSlotError) {
      logMoodImageError(
        "Mood image delete failed",
        logContext,
        deleteSlotError,
      );
      return imageActionError("Billedet kunne ikke fjernes.");
    }
  } else {
    const upload = await uploadImageForAction(
      supabase,
      imageFile,
      `hosts/${facilitatorProfile.profile_id ?? profile.id}/gallery/${slotIndex + 1}`,
    );

    if (upload.error || !upload.path) {
      logMoodImageError(upload.error ?? "Mood image upload failed", logContext);
      return imageActionError(upload.error ?? "Billedet kunne ikke uploades.");
    }

    uploadedPath = upload.path;

    const { data: existingSlotRows, error: existingSlotError } = await supabase
      .from("facilitator_images")
      .select("id, image_path, sort_order, created_at")
      .eq("facilitator_id", facilitatorProfile.id)
      .eq("sort_order", sortOrder)
      .order("created_at", { ascending: true });

    if (existingSlotError) {
      await supabase.storage.from("media").remove([uploadedPath]);
      logMoodImageError(
        "Existing mood image slot lookup failed",
        { ...logContext, uploadedPath },
        existingSlotError,
      );
      return imageActionError("Billedgalleriet kunne ikke gemmes.");
    }

    const existingSlot = existingSlotRows?.[0] ?? null;
    const duplicateSlotIds = (existingSlotRows ?? [])
      .slice(1)
      .map((row: { id: string }) => row.id);
    const { error: saveImageError } = existingSlot
      ? await supabase
          .from("facilitator_images")
          .update({
            image_path: upload.path,
            alt_text: null,
            sort_order: sortOrder,
          })
          .eq("id", existingSlot.id)
      : await supabase.from("facilitator_images").insert({
          facilitator_id: facilitatorProfile.id,
          image_path: upload.path,
          alt_text: null,
          sort_order: sortOrder,
        });

    if (saveImageError) {
      await supabase.storage.from("media").remove([uploadedPath]);
      logMoodImageError(
        "Mood image database save failed",
        { ...logContext, uploadedPath, existingImage: Boolean(existingSlot) },
        saveImageError,
      );
      return imageActionError("Billedgalleriet kunne ikke gemmes.");
    }

    if (duplicateSlotIds.length > 0) {
      const { error: duplicateDeleteError } = await supabase
        .from("facilitator_images")
        .delete()
        .in("id", duplicateSlotIds);

      if (duplicateDeleteError) {
        logMoodImageError(
          "Duplicate mood image slot cleanup failed",
          {
            ...logContext,
            duplicateSlotCount: duplicateSlotIds.length,
            uploadedPath: safePathSuffix(uploadedPath),
          },
          duplicateDeleteError,
        );
      }
    }

    if (existingSlot?.image_path && existingSlot.image_path !== uploadedPath) {
      const { error: removeOldFileError } = await supabase.storage
        .from("media")
        .remove([existingSlot.image_path]);

      if (removeOldFileError) {
        logMoodImageError(
          "Old mood image storage cleanup failed",
          { ...logContext, oldPath: existingSlot.image_path, uploadedPath },
          removeOldFileError,
        );
      }
    }
  }

  const { data: updatedRows, error: updatedRowsError } = await supabase
    .from("facilitator_images")
    .select("image_path, sort_order")
    .eq("facilitator_id", facilitatorProfile.id)
    .order("sort_order");

  if (updatedRowsError) {
    logMoodImageError(
      "Mood image rows reload failed",
      logContext,
      updatedRowsError,
    );
    return imageActionError(
      "Billedgalleriet blev gemt, men kunne ikke hentes igen. Genindlæs siden.",
    );
  }

  const paths = normalizeFacilitatorMoodImagePaths(
    updatedRows as
      | Array<{ image_path: string; sort_order: number }>
      | null
      | undefined,
  );
  console.info(
    "[facilitator-profile:mood-image] slot save completed",
    imageLogContext({
      ...logContext,
      afterPaths: paths.map(safePathSuffix).join(" | "),
      beforePaths: beforePaths.map(safePathSuffix).join(" | "),
      paths: paths.map(safePathSuffix).join(" | "),
      uploadedPath: safePathSuffix(uploadedPath),
    }),
  );
  revalidatePath("/facilitator/profile");
  if (adminTargetFacilitatorId) {
    revalidatePath(`/admin/facilitators/${adminTargetFacilitatorId}/edit`);
  }
  return imageActionSuccess(paths);
}

export async function saveFacilitatorProfileImageAction(formData: FormData) {
  const profile = await requireProfile();
  const supabase = createAdminClient();
  const imageFile = formData.get("image_file");
  const fileContext =
    imageFile instanceof File
      ? {
          fileSize: imageFile.size,
          mimeType: imageFile.type || "unknown",
        }
      : {
          fileSize: null,
          mimeType: null,
        };
  const logContext = {
    action: "saveFacilitatorProfileImageAction",
    profileId: safeIdSuffix(profile.id),
    ...fileContext,
  };

  const { data: facilitatorProfile, error: profileError } = await supabase
    .from("facilitator_profiles")
    .select("id, profile_image_path")
    .eq("profile_id", profile.id)
    .single();

  if (profileError || !facilitatorProfile) {
    logMoodImageError(
      "Facilitator profile lookup failed for profile image",
      logContext,
      profileError,
    );
    return {
      message: "Arrangørprofilen kunne ikke hentes.",
      status: "error" as const,
    };
  }

  const upload = await uploadImageForAction(
    supabase,
    imageFile,
    `hosts/${profile.id}/profile`,
  );

  if (upload.error || !upload.path) {
    logMoodImageError(upload.error ?? "Profile image upload failed", {
      ...logContext,
      facilitatorId: safeIdSuffix(facilitatorProfile.id),
    });
    return {
      message: upload.error ?? "Profilbilledet kunne ikke uploades.",
      status: "error" as const,
    };
  }

  const { error: updateError } = await supabase
    .from("facilitator_profiles")
    .update({ profile_image_path: upload.path })
    .eq("id", facilitatorProfile.id);

  if (updateError) {
    await supabase.storage.from("media").remove([upload.path]);
    logMoodImageError(
      "Profile image database save failed",
      {
        ...logContext,
        facilitatorId: safeIdSuffix(facilitatorProfile.id),
        uploadedPath: upload.path,
      },
      updateError,
    );
    return {
      message: "Profilbilledet kunne ikke gemmes.",
      status: "error" as const,
    };
  }

  if (
    facilitatorProfile.profile_image_path &&
    facilitatorProfile.profile_image_path !== upload.path
  ) {
    const { error: removeOldFileError } = await supabase.storage
      .from("media")
      .remove([facilitatorProfile.profile_image_path]);

    if (removeOldFileError) {
      logMoodImageError(
        "Old profile image storage cleanup failed",
        {
          ...logContext,
          oldPath: facilitatorProfile.profile_image_path,
          uploadedPath: upload.path,
        },
        removeOldFileError,
      );
    }
  }

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/profile");

  return { path: upload.path, status: "success" as const };
}

export async function submitFacilitatorProfileForReviewAction(input: {
  acceptedTerms: boolean;
}) {
  const profile = await requireProfile();
  const supabase = createAdminClient();
  const { data: facilitatorProfile, error: profileError } = await supabase
    .from("facilitator_profiles")
    .select(
      "id, city, company_name, country, country_name, postal_code, profile_image_path, short_description, long_description, status, facilitator_categories(category_id), facilitator_images(image_path, sort_order)",
    )
    .eq("profile_id", profile.id)
    .single();

  const logContext = {
    action: "submitFacilitatorProfileForReviewAction",
    profileId: safeIdSuffix(profile.id),
  };

  if (profileError || !facilitatorProfile) {
    console.error(
      "[facilitator-profile:submit]",
      imageLogContext({
        ...logContext,
        errorCode: profileError?.code,
        errorMessage: profileError?.message,
        message: "Facilitator profile lookup failed",
      }),
    );
    return { message: "Arrangørprofilen kunne ikke hentes.", ok: false };
  }

  const locationFields = normalizeLocationFields({
    city: facilitatorProfile.city,
    country: facilitatorProfile.country,
    countryName: facilitatorProfile.country_name,
    postalCode: facilitatorProfile.postal_code,
  });
  const locationValidationMessage = validateLocationFields(locationFields);

  if (locationValidationMessage) {
    return { message: locationValidationMessage, ok: false };
  }
  const missingAcceptances = await getMissingRequiredLegalAcceptances(
    supabase,
    profile.id,
    organizerAcceptanceTypes,
  );

  if (missingAcceptances.length > 0 && !input.acceptedTerms) {
    return {
      message:
        "Du skal acceptere arrangørvilkår og retningslinjer, før profilen kan sendes til godkendelse.",
      ok: false,
    };
  }

  if (missingAcceptances.length > 0) {
    try {
      await recordLegalAcceptances(supabase, {
        action: "facilitator_profile_submission",
        documentTypes: organizerAcceptanceTypes,
        profileId: profile.id,
      });
    } catch (error) {
      console.error(
        "[facilitator-profile:submit]",
        imageLogContext({
          ...logContext,
          errorMessage: errorMessage(error),
          message: "Legal acceptance save failed",
        }),
      );
      return {
        message: "Accepten af vilkår kunne ikke gemmes. Prøv igen.",
        ok: false,
      };
    }
  }

  const readiness = getFacilitatorSubmissionReadiness({
    categoryIds:
      facilitatorProfile.facilitator_categories?.map(
        (row: { category_id: string }) => row.category_id,
      ) ?? [],
    city: facilitatorProfile.city,
    companyName: facilitatorProfile.company_name,
    fullName: profile.full_name,
    hasAcceptedRequiredLegalDocuments: true,
    hasMoodImage: Boolean(facilitatorProfile.facilitator_images?.length),
    hasProfileImage: Boolean(facilitatorProfile.profile_image_path),
    postalCode: facilitatorProfile.postal_code,
    requireLocation: true,
    shortDescription:
      facilitatorProfile.long_description ||
      facilitatorProfile.short_description,
  });
  const missingFields = readiness.missing.map((item) => facilitatorSubmissionMissingLabels[item]);

  if (missingFields.length > 0) {
    const storyIsMissing = readiness.missing.includes("short_description");
    const otherMissingFields = readiness.missing
      .filter((item) => item !== "short_description")
      .map((item) => facilitatorSubmissionMissingLabels[item]);
    const message = storyIsMissing
      ? [
          "Skriv gerne lidt mere om dig selv, før profilen sendes til SoulEvents.",
          otherMissingFields.length > 0
            ? `Der mangler også: ${otherMissingFields.join(", ")}.`
            : null,
        ]
          .filter(Boolean)
          .join(" ")
      : `Der mangler stadig: ${missingFields.join(", ")}.`;

    return {
      message,
      ok: false,
    };
  }

  const wasAlreadySubmittedForReview = facilitatorProfile.status === "pending_review";

  if (facilitatorProfile.status !== "pending_review") {
    const { error: statusError } = await supabase
      .from("facilitator_profiles")
      .update({ status: "pending_review" })
      .eq("id", facilitatorProfile.id);

    if (statusError) {
      console.error(
        "[facilitator-profile:submit]",
        imageLogContext({
          ...logContext,
          errorCode: statusError.code,
          errorMessage: statusError.message,
          message: "Facilitator profile status update failed",
        }),
      );
      return {
        message: "Profilen kunne ikke sendes til gennemgang. Prøv igen.",
        ok: false,
      };
    }
  }

  await notifyAdminsIfReady({
    facilitatorEmail: profile.email,
    facilitatorId: facilitatorProfile.id,
    facilitatorName:
      facilitatorProfile.company_name || profile.full_name || profile.email,
    wasReady: wasAlreadySubmittedForReview,
  });

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/profile");
  revalidatePath("/admin");
  revalidatePath("/admin/users");

  return {
    message: "Din profil er sendt til SoulEvents’ gennemgang.",
    ok: true,
  };
}

export async function updateFacilitatorProfileAction(formData: FormData) {
  const profile = await requireProfile();
  const supabase = createAdminClient();
  const redirectOrigin = getOptionalString(formData, "current_origin");
  const adminTargetFacilitatorId = getOptionalString(
    formData,
    "admin_target_facilitator_id",
  );
  const adminReturnTo = getOptionalString(formData, "admin_return_to");
  const isAdminEdit = Boolean(adminTargetFacilitatorId);
  const section = normalizeProfileSection(getString(formData, "section"));

  if (!section) {
    const message =
      "Profilen blev ikke gemt, fordi gemmehandlingen manglede. Prøv igen.";
    if (isAdminEdit) {
      adminProfileRedirect(message, adminReturnTo, "contact");
    }
    profileRedirect(message, redirectOrigin, "contact");
  }

  if (isAdminEdit && profile.role !== "admin") {
    adminProfileRedirect(
      "Du har ikke adgang til at redigere denne arrangør.",
      adminReturnTo,
      "contact",
    );
  }

  const fullName = getString(formData, "full_name");
  const firstName = getOptionalString(formData, "first_name");
  const lastName = getOptionalString(formData, "last_name");
  const phoneInput = getOptionalString(formData, "phone") ?? "";
  const normalizedPhone = normalizeDanishPhoneNumber(phoneInput);
  const companyName = getOptionalString(formData, "company_name");
  const shortDescription = getString(formData, "short_description");
  const longDescription = getString(formData, "long_description");
  let profileImagePath = getOptionalString(formData, "profile_image_path");
  const publicEmail = getOptionalString(formData, "public_email");
  const publicPhone = getOptionalString(formData, "public_phone");
  const websiteUrl = getOptionalString(formData, "website_url");
  const facebookUrl = getOptionalString(formData, "facebook_url");
  const instagramUrl = getOptionalString(formData, "instagram_url");
  const youtubeUrl = getOptionalString(formData, "youtube_url");
  const tiktokUrl = getOptionalString(formData, "tiktok_url");
  const addressLine = getOptionalString(formData, "address_line");
  const locationFields = normalizeLocationFields({
    city: getOptionalString(formData, "city"),
    country: getOptionalString(formData, "country"),
    countryName: getOptionalString(formData, "country_name"),
    postalCode: getOptionalString(formData, "postal_code"),
    regionText: getOptionalString(formData, "region_text"),
  });
  const postalCode = locationFields.postalCode;
  const city = locationFields.city;
  const country = locationFields.country;
  const isOnlineFacilitator = formData.get("is_online_facilitator") === "on";
  let regionId: string | null = null;
  const categoryIds = getAllStrings(formData, "category_ids");
  const uniqueCategoryIds = [...new Set(categoryIds)];
  const offersServices = formData.get("offers_services") === "on";
  const serviceDescription = getOptionalString(formData, "service_description");
  const specialties = normalizeSpecialtyText(
    getOptionalString(formData, "specialties"),
  );
  const showInLocalServiceResults =
    formData.get("show_in_local_service_results") === "on";
  const galleryPaths = formData
    .getAll("gallery_image_paths")
    .slice(0, 3)
    .map((item) => (typeof item === "string" ? item.trim() : ""));

  let existingProfileQuery = supabase
    .from("facilitator_profiles")
    .select(
      "id, profile_id, slug, address_line, city, company_name, country, facebook_url, instagram_url, individual_service_other_title, individual_service_types, is_online_facilitator, long_description, offers_services, postal_code, profile_image_path, public_email, public_phone, region_id, service_description, short_description, show_in_local_service_results, show_public_location, status, tiktok_url, website_url, youtube_url, facilitator_categories(category_id), facilitator_images(id, image_path, sort_order), facilitator_tags(tag_id), profiles!facilitator_profiles_profile_id_fkey(id, full_name, email, phone)",
    );

  existingProfileQuery = isAdminEdit
    ? existingProfileQuery.eq("id", adminTargetFacilitatorId as string)
    : existingProfileQuery.eq("profile_id", profile.id);

  const { data: existingProfile, error: existingProfileError } =
    await existingProfileQuery.single();

  if (existingProfileError || !existingProfile) {
    const message = "Arrangørprofilen kunne ikke hentes.";
    if (isAdminEdit) {
      adminProfileRedirect(
        message,
        adminReturnTo,
        fallbackErrorSection(section, "contact"),
      );
    }
    profileRedirect(
      message,
      redirectOrigin,
      fallbackErrorSection(section, "contact"),
    );
  }

  const facilitatorId = existingProfile.id as string;
  const targetProfileRelation = Array.isArray(existingProfile.profiles)
    ? existingProfile.profiles[0]
    : existingProfile.profiles;
  const targetProfile = isAdminEdit
    ? {
        email: targetProfileRelation?.email ?? "",
        full_name: targetProfileRelation?.full_name ?? "",
        id: targetProfileRelation?.id ?? existingProfile.profile_id,
        phone: targetProfileRelation?.phone ?? null,
        role: "facilitator",
      }
    : profile;
  const existingCategoryIds =
    existingProfile.facilitator_categories?.map(
      (row: { category_id: string }) => row.category_id,
    ) ?? [];
  const existingGalleryRows =
    existingProfile.facilitator_images?.map(
      (row: { id: string; image_path: string; sort_order: number }) => row,
    ) ?? [];
  const existingGallerySlots =
    normalizeFacilitatorMoodImageSlots(existingGalleryRows);
  const existingGalleryBySortOrder = new Map(
    existingGallerySlots
      .filter(
        (row): row is { id: string; image_path: string; sort_order: number } =>
          Boolean(row),
      )
      .map((row) => [row.sort_order, row]),
  );
  const existingGalleryPaths = existingGallerySlots.map(
    (row) => row?.image_path ?? "",
  );
  const wasReady = isProfileReady({
    categoryIds: existingCategoryIds,
    city: existingProfile.city ?? null,
    companyName: existingProfile.company_name ?? null,
    fullName: targetProfile.full_name ?? null,
    postalCode: existingProfile.postal_code ?? null,
  });

  if (savesSection(section, "contact") && !fullName) {
    if (isAdminEdit) {
      adminProfileRedirect(
        "Det rigtige navn skal udfyldes.",
        adminReturnTo,
        "contact",
      );
    }
    profileRedirect(
      "Dit rigtige navn skal udfyldes.",
      redirectOrigin,
      "contact",
    );
  }

  const lengthChecks: Array<
    [boolean, string | null, number, string, EditableProfileSection]
  > = [
    [savesSection(section, "contact"), fullName, 80, "Navn", "contact"],
    [savesSection(section, "contact"), firstName, 80, "Fornavn", "contact"],
    [savesSection(section, "contact"), lastName, 80, "Efternavn", "contact"],
    [
      savesSection(section, "contact"),
      companyName,
      100,
      "Profilnavn",
      "contact",
    ],
    [
      savesSection(section, "contact"),
      shortDescription,
      300,
      "Kort præsentation",
      "contact",
    ],
    [
      savesSection(section, "contact"),
      longDescription,
      2000,
      "Uddybende beskrivelse",
      "contact",
    ],
    [
      savesSection(section, "location"),
      addressLine,
      120,
      "Adresse",
      "location",
    ],
    [
      savesSection(section, "location"),
      postalCode,
      16,
      "Postnummer",
      "location",
    ],
    [savesSection(section, "location"), city, 80, "By", "location"],
    [savesSection(section, "location"), country, 5, "Land", "location"],
    [
      savesSection(section, "location"),
      locationFields.countryName,
      80,
      "Landets navn",
      "location",
    ],
    [
      savesSection(section, "location"),
      locationFields.regionText,
      80,
      "Region / område",
      "location",
    ],
    [
      savesSection(section, "social"),
      publicEmail,
      180,
      "Offentlig e-mail",
      "social",
    ],
    [
      savesSection(section, "social"),
      publicPhone,
      40,
      "Offentlig telefon",
      "social",
    ],
    [savesSection(section, "social"), websiteUrl, 300, "Website", "social"],
    [
      savesSection(section, "social"),
      facebookUrl,
      300,
      "Facebook-link",
      "social",
    ],
    [
      savesSection(section, "social"),
      instagramUrl,
      300,
      "Instagram-link",
      "social",
    ],
    [
      savesSection(section, "social"),
      youtubeUrl,
      300,
      "YouTube-link",
      "social",
    ],
    [savesSection(section, "social"), tiktokUrl, 300, "TikTok-link", "social"],
    [
      savesSection(section, "categories"),
      specialties,
      specialtyMaxLength,
      "Speciale",
      "categories",
    ],
    [
      savesSection(section, "services"),
      serviceDescription,
      500,
      "Kort beskrivelse af ydelser",
      "services",
    ],
  ];

  for (const [
    shouldValidate,
    value,
    maxLength,
    label,
    errorSection,
  ] of lengthChecks) {
    if (shouldValidate && value && value.length > maxLength) {
      if (isAdminEdit) {
        adminProfileRedirect(
          label + " må højst være " + maxLength + " tegn.",
          adminReturnTo,
          errorSection,
        );
      }
      profileRedirect(
        label + " må højst være " + maxLength + " tegn.",
        redirectOrigin,
        errorSection,
      );
    }
  }

  if (
    savesSection(section, "images") &&
    galleryPaths.some((galleryPath) => galleryPath.length > 300)
  ) {
    if (isAdminEdit) {
      adminProfileRedirect(
        "Billedstier må højst være 300 tegn.",
        adminReturnTo,
        "images",
      );
    }
    profileRedirect(
      "Billedstier må højst være 300 tegn.",
      redirectOrigin,
      "images",
    );
  }

  if (savesSection(section, "contact") && !companyName) {
    if (isAdminEdit) {
      adminProfileRedirect(
        "Det viste navn skal udfyldes.",
        adminReturnTo,
        "contact",
      );
    }
    profileRedirect(
      "Det navn du ønsker at blive vist under skal udfyldes.",
      redirectOrigin,
      "contact",
    );
  }

  if (
    savesSection(section, "contact") &&
    phoneInput &&
    normalizedPhone === null
  ) {
    if (isAdminEdit) {
      adminProfileRedirect(
        danishPhoneValidationMessage,
        adminReturnTo,
        "contact",
      );
    }
    profileRedirect(
      danishPhoneValidationMessage,
      redirectOrigin,
      "contact",
    );
  }

  if (savesSection(section, "social")) {
    const facebookValidation = validateSocialProfileLink(
      facebookUrl,
      "facebook",
    );
    if (!facebookValidation.ok) {
      if (isAdminEdit) {
        adminProfileRedirect(
          facebookValidation.message,
          adminReturnTo,
          "social",
        );
      }
      profileRedirect(facebookValidation.message, redirectOrigin, "social");
    }

    const instagramValidation = validateSocialProfileLink(
      instagramUrl,
      "instagram",
    );
    if (!instagramValidation.ok) {
      if (isAdminEdit) {
        adminProfileRedirect(
          instagramValidation.message,
          adminReturnTo,
          "social",
        );
      }
      profileRedirect(instagramValidation.message, redirectOrigin, "social");
    }
  }

  if (savesSection(section, "location") && (!postalCode || !city)) {
    if (isAdminEdit) {
      adminProfileRedirect(
        "Postnummer og by skal udfyldes.",
        adminReturnTo,
        "location",
      );
    }
    profileRedirect(
      "Postnummer og by skal udfyldes.",
      redirectOrigin,
      "location",
    );
  }

  if (savesSection(section, "location")) {
    const locationValidationMessage = validateLocationFields(locationFields);
    if (locationValidationMessage) {
      if (isAdminEdit) {
        adminProfileRedirect(
          locationValidationMessage,
          adminReturnTo,
          "location",
        );
      }
      profileRedirect(locationValidationMessage, redirectOrigin, "location");
    }
  }

  if (savesSection(section, "categories") && !uniqueCategoryIds.length) {
    if (isAdminEdit) {
      adminProfileRedirect(
        "Vælg mindst ét arbejdsområde.",
        adminReturnTo,
        "categories",
      );
    }
    profileRedirect(
      "Vælg mindst ét arbejdsområde, så vi kan placere din profil korrekt.",
      redirectOrigin,
      "categories",
    );
  }

  let updateCategoryDebug: ReturnType<typeof categoryDebugContext> | null =
    null;

  if (savesSection(section, "categories")) {
    const allowedCategoryResult = await getAllowedCategoryIds(supabase);
    if (allowedCategoryResult.error) {
      logCategorySaveError({
        action: "updateFacilitatorProfileAction",
        categoryIds: uniqueCategoryIds,
        error: allowedCategoryResult.error,
        facilitatorId,
        profileId: targetProfile.id,
        stage: "load_allowed_categories",
      });
      const message = "Arbejdsområderne kunne ikke kontrolleres.";
      if (isAdminEdit) {
        adminProfileRedirect(message, adminReturnTo, "categories");
      }
      profileRedirect(message, redirectOrigin, "categories");
    }

    const invalidCategoryIds = uniqueCategoryIds.filter(
      (categoryId) => !allowedCategoryResult.ids.has(categoryId),
    );
    updateCategoryDebug = categoryDebugContext(
      allowedCategoryResult,
      invalidCategoryIds,
    );
    if (invalidCategoryIds.length > 0) {
      logCategorySaveError({
        action: "updateFacilitatorProfileAction",
        categoryIds: uniqueCategoryIds,
        error: {
          message: "Invalid facilitator work area ids",
          details: invalidCategoryIds.join(","),
        },
        facilitatorId,
        ...updateCategoryDebug,
        profileId: targetProfile.id,
        stage: "validate_allowed_categories",
      });
      const message = "Vælg et gyldigt arbejdsområde fra listen.";
      if (isAdminEdit) {
        adminProfileRedirect(message, adminReturnTo, "categories");
      }
      profileRedirect(message, redirectOrigin, "categories");
    }
  }

  if (savesSection(section, "contact")) {
    const contactResult = await updateProfileContactFields({
      firstName: firstName ?? "",
      fullName,
      lastName: lastName ?? "",
      phone: normalizedPhone || null,
      profileId: targetProfile.id,
    });

    if (!contactResult.ok) {
      if (isAdminEdit) {
        adminProfileRedirect(
          "Profilen kunne ikke gemmes.",
          adminReturnTo,
          "contact",
        );
      }
      profileRedirect("Profilen kunne ikke gemmes.", redirectOrigin, "contact");
    }
  }

  const facilitatorUpdates: Record<
    string,
    string | number | boolean | string[] | null
  > = {};

  if (savesSection(section, "contact")) {
    facilitatorUpdates.company_name = companyName;
    facilitatorUpdates.long_description = longDescription;
    facilitatorUpdates.short_description = shortDescription;
  }

  if (savesSection(section, "social")) {
    const facebookValidation = validateSocialProfileLink(
      facebookUrl,
      "facebook",
    );
    const instagramValidation = validateSocialProfileLink(
      instagramUrl,
      "instagram",
    );

    facilitatorUpdates.facebook_url = facebookValidation.ok
      ? facebookValidation.value
      : null;
    facilitatorUpdates.instagram_url = instagramValidation.ok
      ? instagramValidation.value
      : null;
    facilitatorUpdates.public_email = publicEmail;
    facilitatorUpdates.public_phone = publicPhone;
    facilitatorUpdates.tiktok_url = tiktokUrl;
    facilitatorUpdates.website_url = websiteUrl;
    facilitatorUpdates.youtube_url = youtubeUrl;
  }

  if (savesSection(section, "location")) {
    const inferredSlug = locationFields.isDanishLocation
      ? inferRegionSlug({ city, postalCode })
      : null;

    if (inferredSlug) {
      const { data: inferredRegion } = await supabase
        .from("regions")
        .select("id")
        .eq("slug", inferredSlug)
        .maybeSingle();
      regionId = inferredRegion?.id ?? null;
    }

    const coordinates =
      locationFields.isDanishLocation && postalCode && city
        ? await geocodeDanishAddress({ addressLine, postalCode, city })
        : null;

    facilitatorUpdates.address_line = addressLine;
    facilitatorUpdates.city = city;
    facilitatorUpdates.country = country;
    facilitatorUpdates.country_name = locationFields.countryName || null;
    facilitatorUpdates.is_online_facilitator = isOnlineFacilitator;
    facilitatorUpdates.latitude = coordinates?.latitude ?? null;
    facilitatorUpdates.longitude = coordinates?.longitude ?? null;
    facilitatorUpdates.postal_code = postalCode;
    facilitatorUpdates.region_id = regionId;
    facilitatorUpdates.region_text = locationFields.regionText || null;
    facilitatorUpdates.show_public_location = formData.has("show_public_location")
      ? formData.get("show_public_location") === "on"
      : existingProfile.show_public_location !== false;
  }

  if (savesSection(section, "images")) {
    const uploadedProfileImage = await uploadImage(
      supabase,
      formData.get("profile_image_file"),
      `hosts/${targetProfile.id}/profile`,
      redirectOrigin,
      "images",
      isAdminEdit ? adminReturnTo : null,
    );

    if (uploadedProfileImage) {
      profileImagePath = uploadedProfileImage;
    }

    facilitatorUpdates.profile_image_path = profileImagePath || null;

  }

  if (savesSection(section, "services")) {
    facilitatorUpdates.offers_services = offersServices;
    facilitatorUpdates.individual_service_other_title = null;
    facilitatorUpdates.individual_service_types = [];
    facilitatorUpdates.service_description = offersServices
      ? serviceDescription
      : null;
    facilitatorUpdates.show_in_local_service_results =
      offersServices && showInLocalServiceResults;
  }

  if (savesSection(section, "categories")) {
    facilitatorUpdates.specialties = specialties || null;
  }

  if (Object.keys(facilitatorUpdates).length > 0) {
    const {
      error: facilitatorError,
      omittedOptionalLocationColumns,
      originalError,
    } = await updateFacilitatorProfileRecord({
      match: { column: "id", value: facilitatorId },
      supabase,
      updates: facilitatorUpdates,
    });

    if (omittedOptionalLocationColumns) {
      console.warn(
        "[facilitator-profile] Optional international location columns are missing",
        {
          code: originalError?.code,
          message: originalError?.message,
          missingColumns: [
            "country_name",
            "region_text",
            "show_public_location",
          ],
          section,
        },
      );
    }

    if (facilitatorError) {
      if (savesSection(section, "categories")) {
        logCategorySaveError({
          action: "updateFacilitatorProfileAction",
          categoryIds: uniqueCategoryIds,
          error: facilitatorError,
          facilitatorId,
          ...(updateCategoryDebug ?? {}),
          profileId: targetProfile.id,
          stage: "update_facilitator_profile",
        });
      } else {
        console.error(
          "[facilitator-profile] Profile update could not be saved",
          {
            authenticatedProfileRef: logProfileReference(profile.id),
            code: facilitatorError.code,
            details: facilitatorError.details,
            facilitatorId,
            hint: facilitatorError.hint,
            locationPayload:
              section === "location"
                ? sanitizedLocationPayload(facilitatorUpdates)
                : undefined,
            message: facilitatorError.message,
            operation: "update",
            payloadColumns: Object.keys(facilitatorUpdates),
            profileRef: logProfileReference(targetProfile.id),
            section,
            table: "facilitator_profiles",
          },
        );
      }
      const message = profileSaveMessage(facilitatorError, section);
      if (isAdminEdit) {
        adminProfileRedirect(
          message,
          adminReturnTo,
          fallbackErrorSection(section, "contact"),
        );
      }
      profileRedirect(
        message,
        redirectOrigin,
        fallbackErrorSection(section, "contact"),
      );
    }
  }

  if (savesSection(section, "categories")) {
    const { error: categoryError } = await supabase
      .from("facilitator_categories")
      .upsert(
        uniqueCategoryIds.map((categoryId) => ({
          facilitator_id: facilitatorId,
          category_id: categoryId,
        })),
        { onConflict: "facilitator_id,category_id" },
      );

    if (categoryError) {
      logCategorySaveError({
        action: "updateFacilitatorProfileAction",
        categoryIds: uniqueCategoryIds,
        error: categoryError,
        facilitatorId,
        ...(updateCategoryDebug ?? {}),
        profileId: targetProfile.id,
        stage: "upsert_facilitator_categories",
      });
      if (isAdminEdit) {
        adminProfileRedirect(
          "Arbejdsområderne kunne ikke gemmes.",
          adminReturnTo,
          "categories",
        );
      }
      profileRedirect(
        "Arbejdsområderne kunne ikke gemmes.",
        redirectOrigin,
        "categories",
      );
    }

    const { error: deleteCategoryError } = await supabase
      .from("facilitator_categories")
      .delete()
      .eq("facilitator_id", facilitatorId)
      .not("category_id", "in", `(${uniqueCategoryIds.join(",")})`);

    if (deleteCategoryError) {
      logCategorySaveError({
        action: "updateFacilitatorProfileAction",
        categoryIds: uniqueCategoryIds,
        error: deleteCategoryError,
        facilitatorId,
        ...(updateCategoryDebug ?? {}),
        profileId: targetProfile.id,
        stage: "delete_removed_facilitator_categories",
      });
      if (isAdminEdit) {
        adminProfileRedirect(
          "Arbejdsområderne kunne ikke gemmes.",
          adminReturnTo,
          "categories",
        );
      }
      profileRedirect(
        "Arbejdsområderne kunne ikke gemmes.",
        redirectOrigin,
        "categories",
      );
    }
  }

  if (savesSection(section, "images")) {
    const galleryUploads = await Promise.all(
      [0, 1, 2].map((index) =>
        uploadImage(
          supabase,
          formData.get(`gallery_image_file_${index}`),
          `hosts/${targetProfile.id}/gallery/${index + 1}`,
          redirectOrigin,
          "images",
          isAdminEdit ? adminReturnTo : null,
          moodImageActionMaxFileSize,
        ),
      ),
    );

    const finalGalleryPaths = Array.from({ length: 3 }, (_, index) => {
      if (galleryUploads[index]) return galleryUploads[index] as string;
      if (index < galleryPaths.length) return galleryPaths[index] || "";
      return existingGalleryPaths[index] || "";
    });

    for (const [index, imagePath] of finalGalleryPaths.entries()) {
      const sortOrder = index + 1;
      const existingImage = existingGalleryBySortOrder.get(sortOrder);
      const { error: imageError } = imagePath
        ? existingImage
          ? await supabase
              .from("facilitator_images")
              .update({
                alt_text: null,
                image_path: imagePath,
                sort_order: sortOrder,
              })
              .eq("id", existingImage.id)
          : await supabase.from("facilitator_images").insert({
              alt_text: null,
              facilitator_id: facilitatorId,
              image_path: imagePath,
              sort_order: sortOrder,
            })
        : existingImage
          ? await supabase
              .from("facilitator_images")
              .delete()
              .eq("id", existingImage.id)
          : { error: null };

      if (imageError) {
        const uploadedPathForSlot = galleryUploads[index];
        if (uploadedPathForSlot) {
          await supabase.storage.from("media").remove([uploadedPathForSlot]);
        }
        if (isAdminEdit) {
          adminProfileRedirect(
            "Billedgalleriet kunne ikke gemmes.",
            adminReturnTo,
            "images",
          );
        }
        profileRedirect(
          "Billedgalleriet kunne ikke gemmes.",
          redirectOrigin,
          "images",
        );
      }
    }

    const obsoleteGalleryPaths = existingGalleryPaths.filter(
      (imagePath) => imagePath && !finalGalleryPaths.includes(imagePath),
    );
    if (obsoleteGalleryPaths.length > 0) {
      const { error: cleanupError } = await supabase.storage
        .from("media")
        .remove(obsoleteGalleryPaths);
      if (cleanupError) {
        console.warn(
          "[facilitator-profile:gallery-images] Old gallery image cleanup failed",
          {
            errorMessage: cleanupError.message,
            facilitatorId: safeIdSuffix(facilitatorId),
          },
        );
      }
    }
  }

  const finalReady = isProfileReady({
    categoryIds: savesSection(section, "categories")
      ? uniqueCategoryIds
      : existingCategoryIds,
    city: savesSection(section, "location")
      ? city
      : (existingProfile.city ?? null),
    companyName: savesSection(section, "contact")
      ? companyName
      : (existingProfile.company_name ?? null),
    fullName: savesSection(section, "contact")
      ? fullName
      : (targetProfile.full_name ?? null),
    postalCode: savesSection(section, "location")
      ? postalCode
      : (existingProfile.postal_code ?? null),
  });

  const shouldRequestApproval =
    !isAdminEdit && finalReady && existingProfile.status === "pending_review";
  const acceptedOrganizerTerms =
    formData.get("accepted_organizer_terms") === "yes";

  if (shouldRequestApproval) {
    const missingAcceptances = await getMissingRequiredLegalAcceptances(
      supabase,
      targetProfile.id,
      organizerAcceptanceTypes,
    );

    if (missingAcceptances.length > 0 && !acceptedOrganizerTerms) {
      profileRedirect(
        "Du skal acceptere arrangørvilkår og retningslinjer, før profilen kan sendes til godkendelse.",
        redirectOrigin,
        "contact",
      );
    }

    if (missingAcceptances.length > 0) {
      try {
        await recordLegalAcceptances(supabase, {
          action: "facilitator_profile_submission",
          documentTypes: organizerAcceptanceTypes,
          profileId: targetProfile.id,
        });
      } catch {
        profileRedirect(
          "Accepten af vilkår kunne ikke gemmes. Prøv igen.",
          redirectOrigin,
          "contact",
        );
      }
    }
  }

  const shouldNotifyAdmins = shouldRequestApproval && !wasReady;

  if (shouldNotifyAdmins) {
    await notifyAdminsIfReady({
      facilitatorEmail: profile.email,
      facilitatorId,
      facilitatorName:
        companyName ||
        existingProfile.company_name ||
        fullName ||
        targetProfile.full_name ||
        targetProfile.email,
      wasReady,
    });
  }

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/profile");
  revalidatePath("/admin/users");
  revalidatePath("/admin/facilitators/" + facilitatorId + "/edit");
  await revalidatePublicFacilitatorProfilePaths(supabase, facilitatorId, existingProfile.slug);
  if (isAdminEdit) {
    adminProfileSuccessRedirect(
      "Ændringer gemt. Arrangørprofilen er opdateret.",
      adminReturnTo,
      section,
    );
  }
  profileSuccessRedirect(
    shouldRequestApproval
      ? "Ændringer gemt. Din profil afventer godkendelse."
      : "Ændringer gemt. Din profil er opdateret.",
    shouldRequestApproval,
    redirectOrigin,
    section,
  );
}
