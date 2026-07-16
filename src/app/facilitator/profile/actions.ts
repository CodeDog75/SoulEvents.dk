"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/roles";
import { getAllStrings, getOptionalString, getString } from "@/lib/forms/form-data";
import { profileApprovalUrl, sendFacilitatorProfileReadyEmail } from "@/lib/email/facilitator-profile-ready";
import { getMissingRequiredLegalAcceptances, organizerAcceptanceTypes, recordLegalAcceptances } from "@/lib/legal/documents";
import { geocodeDanishAddress } from "@/lib/mapbox/geocode";
import { inferRegionSlug } from "@/lib/regions/infer-region";
import { assertRateLimit, isRateLimitExceededError, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ChangePasswordFormState = {
  fieldErrors?: {
    confirmPassword?: string;
    currentPassword?: string;
    newPassword?: string;
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
    const isLocalNetwork = hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("192.168.");
    const isKnownHost =
      hostname === "soul-events-dk.vercel.app" || hostname === "soulevents.dk" || hostname === "www.soulevents.dk";

    if ((url.protocol === "http:" || url.protocol === "https:") && (isLocalNetwork || isKnownHost)) {
      return url.origin;
    }
  } catch {
    return null;
  }

  return null;
}

const editableProfileSections = ["contact", "location", "social", "images", "categories", "services"] as const;
type EditableProfileSection = (typeof editableProfileSections)[number];
type ProfileSection = EditableProfileSection | "all";

type ProfileAutosaveInput = {
  section: EditableProfileSection;
  values: Record<string, boolean | string | string[] | null>;
};

const profileImageMaxFileSize = 10 * 1024 * 1024;
const moodImageActionMaxFileSize = 15 * 1024 * 1024;

function isEditableProfileSection(value: string | null | undefined): value is EditableProfileSection {
  return editableProfileSections.includes(value as EditableProfileSection);
}

function normalizeProfileSection(value: string | null | undefined): ProfileSection | null {
  return value === "all" || isEditableProfileSection(value) ? value : null;
}

function savesSection(section: ProfileSection, target: EditableProfileSection) {
  return section === "all" || section === target;
}

function fallbackErrorSection(section: ProfileSection, fallback: EditableProfileSection): EditableProfileSection {
  return section === "all" ? fallback : section;
}

function profileRedirect(message: string, origin?: string | null, errorSection?: EditableProfileSection): never {
  const params = new URLSearchParams({ message });

  if (errorSection) {
    params.set("errorSection", errorSection);
  }

  const path = `/facilitator/profile?${params.toString()}`;
  const redirectOrigin = safeRedirectOrigin(origin ?? null);

  redirect(redirectOrigin ? `${redirectOrigin}${path}` : path);
}

function safeAdminReturnPath(value: string | null | undefined, fallback = "/admin/users") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;

  try {
    const url = new URL(value, "https://soulevents.local");
    if (!url.pathname.startsWith("/admin")) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

function adminProfileRedirect(message: string, returnTo: string | null | undefined, errorSection?: EditableProfileSection): never {
  const safeReturnTo = safeAdminReturnPath(returnTo);
  const params = new URLSearchParams({ message });

  if (errorSection) {
    params.set("errorSection", errorSection);
  }

  const separator = safeReturnTo.includes("?") ? "&" : "?";
  redirect(`${safeReturnTo}${separator}${params.toString()}`);
}

function normalizeImageRows(paths: string[], alts: string[]) {
  return paths.slice(0, 3).map((imagePath, index) => ({
    image_path: imagePath,
    alt_text: alts[index] || null,
    sort_order: index + 1,
  }));
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
  return file.type === "image/heic" || file.type === "image/heif" || extension === "heic" || extension === "heif";
}

function countDigits(value: string) {
  return value.replace(/\D/g, "").length;
}

function isValidPhoneNumber(value: string) {
  return /^[\d\s]+$/.test(value) && countDigits(value) === 8;
}

function isProfileReady(input: {
  categoryIds: string[];
  city: string | null;
  companyName: string | null;
  fullName: string | null;
  postalCode: string | null;
}) {
  return (
    Boolean(input.companyName) &&
    Boolean(input.fullName) &&
    Boolean(input.postalCode) &&
    Boolean(input.city) &&
    input.categoryIds.length > 0
  );
}

function profileSuccessRedirect(message: string, ready: boolean, origin?: string | null, savedSection?: ProfileSection): never {
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

function adminProfileSuccessRedirect(message: string, returnTo: string | null | undefined, savedSection?: ProfileSection): never {
  const safeReturnTo = safeAdminReturnPath(returnTo);
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
    fieldErrors.newPassword = "Den nye adgangskode skal være forskellig fra den nuværende.";
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

    return { message: "Adgangskoden kunne ikke ændres. Prøv igen.", status: "error" };
  }

  const supabase = await createClient();
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: currentPassword,
  });

  if (signInError || signInData.user?.id !== profile.id) {
    return {
      fieldErrors: { currentPassword: "Den nuværende adgangskode er forkert." },
      status: "error",
    };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

  if (updateError) {
    return { message: "Adgangskoden kunne ikke ændres. Prøv igen.", status: "error" };
  }

  return { message: "Din adgangskode er ændret.", status: "success" };
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
  const { data: admins, error: adminsError } = await supabase.from("profiles").select("email").eq("role", "admin");

  if (adminsError) {
    console.error("[facilitator-profile] Admin-notifikation kunne ikke forberedes", {
      error: adminsError.message,
      facilitatorId: input.facilitatorId,
    });
    return;
  }

  const submittedAt = new Date().toISOString();
  const adminEmails = (admins ?? []).map((admin) => admin.email).filter((email): email is string => Boolean(email));

  if (adminEmails.length === 0) {
    console.error("[facilitator-profile] Ingen admin-modtagere fundet til profilnotifikation", {
      facilitatorId: input.facilitatorId,
    });
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
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => errorMessage(result.reason));

  if (failedMessages.length > 0) {
    console.error("[facilitator-profile] Admin-notifikation fejlede efter profilgemning", {
      errors: failedMessages,
      failed: failedMessages.length,
      facilitatorId: input.facilitatorId,
    });
  }
}

export async function autosaveFacilitatorProfileAction(input: ProfileAutosaveInput) {
  const profile = await requireProfile();
  const supabase = createAdminClient();
  const section = isEditableProfileSection(input.section) ? input.section : null;

  if (!section) {
    return { message: "Profilafsnittet kunne ikke genkendes.", ok: false };
  }

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from("facilitator_profiles")
    .select("id")
    .eq("profile_id", profile.id)
    .single();

  if (existingProfileError || !existingProfile) {
    return { message: "Arrangørprofilen kunne ikke hentes.", ok: false };
  }

  const facilitatorId = existingProfile.id as string;
  const updates: Record<string, boolean | number | string | null> = {};

  if (section === "contact") {
    const fullName = valueForAutosave(input.values.full_name);
    const phone = valueForAutosave(input.values.phone);
    const companyName = valueForAutosave(input.values.company_name);
    const shortDescription = valueForAutosave(input.values.short_description);
    const longDescription = valueForAutosave(input.values.long_description);

    if (fullName.length > 80 || companyName.length > 100 || shortDescription.length > 300 || longDescription.length > 2000) {
      return { message: "Et felt er længere end tilladt.", ok: false };
    }

    if (phone && !isValidPhoneNumber(phone)) {
      return { message: "Telefonnummer skal bestå af præcis 8 tal.", ok: false };
    }

    const { error: profileError } = await supabase.from("profiles").update({ full_name: fullName, phone }).eq("id", profile.id);

    if (profileError) {
      return { message: "Kontaktoplysningerne kunne ikke gemmes.", ok: false };
    }

    updates.company_name = companyName;
    updates.long_description = longDescription;
    updates.short_description = shortDescription;
  }

  if (section === "location") {
    const addressLine = valueForAutosave(input.values.address_line);
    const postalCode = valueForAutosave(input.values.postal_code);
    const city = valueForAutosave(input.values.city);
    const country = valueForAutosave(input.values.country) || "Danmark";
    const isOnlineFacilitator = input.values.is_online_facilitator === true;

    if (addressLine.length > 120 || postalCode.length > 20 || city.length > 80 || country.length > 80) {
      return { message: "Et lokationsfelt er længere end tilladt.", ok: false };
    }

    let regionId: string | null = null;
    const inferredSlug = inferRegionSlug({ city, postalCode });

    if (inferredSlug) {
      const { data: inferredRegion } = await supabase.from("regions").select("id").eq("slug", inferredSlug).maybeSingle();
      regionId = inferredRegion?.id ?? null;
    }

    const coordinates = postalCode && city ? await geocodeDanishAddress({ addressLine, postalCode, city }) : null;

    updates.address_line = addressLine;
    updates.city = city;
    updates.country = country;
    updates.is_online_facilitator = isOnlineFacilitator;
    updates.latitude = coordinates?.latitude ?? null;
    updates.longitude = coordinates?.longitude ?? null;
    updates.postal_code = postalCode;
    updates.region_id = regionId;
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

    updates.facebook_url = facebookUrl;
    updates.instagram_url = instagramUrl;
    updates.public_email = publicEmail;
    updates.public_phone = publicPhone;
    updates.tiktok_url = tiktokUrl;
    updates.website_url = websiteUrl;
    updates.youtube_url = youtubeUrl;
  }

  if (section === "services") {
    const offersServices = input.values.offers_services === true;
    const serviceTitleIds = arrayForAutosave(input.values.service_title_ids);
    const serviceDescription = valueForAutosave(input.values.service_description);
    const serviceOtherTitle = valueForAutosave(input.values.service_other_title);
    const showInLocalServiceResults = input.values.show_in_local_service_results === true;

    if (serviceDescription.length > 500 || serviceOtherTitle.length > 120) {
      return { message: "Et ydelsesfelt er længere end tilladt.", ok: false };
    }

    updates.offers_services = offersServices;
    updates.service_description = offersServices ? serviceDescription : null;
    updates.service_other_title = offersServices ? serviceOtherTitle : null;
    updates.show_in_local_service_results = offersServices && showInLocalServiceResults;

    const { error: deleteServiceTitleError } = await supabase
      .from("facilitator_service_titles")
      .delete()
      .eq("facilitator_id", facilitatorId);

    if (deleteServiceTitleError) {
      return { message: "Behandlertitlerne kunne ikke gemmes.", ok: false };
    }

    if (offersServices && serviceTitleIds.length > 0) {
      const { error: serviceTitleError } = await supabase.from("facilitator_service_titles").insert(
        serviceTitleIds.map((serviceTitleId) => ({
          facilitator_id: facilitatorId,
          service_title_id: serviceTitleId,
        })),
      );

      if (serviceTitleError) {
        return { message: "Behandlertitlerne kunne ikke gemmes.", ok: false };
      }
    }
  }

  if (section === "categories") {
    const categoryIds = [...new Set(arrayForAutosave(input.values.category_ids))];

    if (categoryIds.length > 0) {
      const { error: categoryError } = await supabase.from("facilitator_categories").upsert(
        categoryIds.map((categoryId) => ({
          facilitator_id: facilitatorId,
          category_id: categoryId,
        })),
        { onConflict: "facilitator_id,category_id" },
      );

      if (categoryError) {
        return { message: "Arbejdsområderne kunne ikke gemmes.", ok: false };
      }

      const { error: deleteCategoryError } = await supabase
        .from("facilitator_categories")
        .delete()
        .eq("facilitator_id", facilitatorId)
        .not("category_id", "in", `(${categoryIds.join(",")})`);

      if (deleteCategoryError) {
        return { message: "Arbejdsområderne kunne ikke gemmes.", ok: false };
      }
    } else {
      const { error: deleteCategoryError } = await supabase.from("facilitator_categories").delete().eq("facilitator_id", facilitatorId);

      if (deleteCategoryError) {
        return { message: "Arbejdsområderne kunne ikke gemmes.", ok: false };
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    const { error: facilitatorError } = await supabase.from("facilitator_profiles").update(updates).eq("profile_id", profile.id);

    if (facilitatorError) {
      return { message: "Arrangørprofilen kunne ikke gemmes.", ok: false };
    }
  }

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/profile");

  return { message: "Gemt", ok: true };
}

export async function saveWorkAreaSuggestionAction(input: string) {
  const suggestionText = input.trim().replace(/\s+/g, " ");

  if (!suggestionText) {
    return { message: "", status: "success" as const };
  }

  if (suggestionText.length < 2) {
    return { message: "Forslaget er for kort.", status: "error" as const };
  }

  if (suggestionText.length > 120) {
    return { message: "Forslaget må højst være 120 tegn.", status: "error" as const };
  }

  const profile = await requireProfile();

  if (profile.role !== "facilitator") {
    return { message: "Kun arrangører kan sende forslag til arbejdsområder.", status: "error" as const };
  }

  const supabase = await createClient();
  const { data: facilitatorProfile, error: facilitatorError } = await supabase
    .from("facilitator_profiles")
    .select("id")
    .eq("profile_id", profile.id)
    .single();

  if (facilitatorError || !facilitatorProfile) {
    return { message: "Forslaget kunne ikke gemmes lige nu.", status: "error" as const };
  }

  const { error } = await supabase.from("facilitator_work_area_suggestions").insert({
    facilitator_id: facilitatorProfile.id,
    profile_id: profile.id,
    suggestion_text: suggestionText,
    status: "pending",
  });

  if (error) {
    if (error.code === "23505") {
      return { message: "Forslaget er allerede sendt til SoulEvents.", status: "success" as const };
    }

    console.error("Work area suggestion could not be saved", {
      code: error.code,
      message: error.message,
    });

    return { message: "Forslaget kunne ikke gemmes lige nu.", status: "error" as const };
  }

  return { message: "Dit forslag er sendt til SoulEvents.", status: "success" as const };
}

function valueForAutosave(value: boolean | string | string[] | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function arrayForAutosave(value: boolean | string | string[] | null | undefined) {
  return Array.isArray(value) ? value.filter((item) => item.trim()) : [];
}

async function ensureMediaBucket(
  supabase: ReturnType<typeof createAdminClient>,
  redirectOrigin?: string | null,
  errorSection: EditableProfileSection = "images",
  adminReturnTo?: string | null,
) {
  const { data: bucket } = await supabase.storage.getBucket("media");

  if (bucket) {
    return;
  }

  const { error } = await supabase.storage.createBucket("media", {
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    fileSizeLimit: 100 * 1024 * 1024,
    public: true,
  });

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
      adminProfileRedirect("HEIC-billedet kunne ikke konverteres. Prøv et andet billede eller eksportér som JPG.", adminReturnTo, errorSection);
    }
    profileRedirect("HEIC-billedet kunne ikke konverteres. Prøv et andet billede eller eksportér som JPG.", redirectOrigin, errorSection);
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    if (adminReturnTo) {
      adminProfileRedirect("Du kan uploade JPG, PNG, WEBP eller HEIC. HEIC konverteres automatisk i browseren.", adminReturnTo, errorSection);
    }
    profileRedirect("Du kan uploade JPG, PNG, WEBP eller HEIC. HEIC konverteres automatisk i browseren.", redirectOrigin, errorSection);
  }

  if (file.size > maxFileSizeBytes) {
    const maxMegabytes = Math.round(maxFileSizeBytes / (1024 * 1024));
    if (adminReturnTo) {
      adminProfileRedirect(`Billedet er for stort. Vælg et billede på højst ${maxMegabytes} MB.`, adminReturnTo, errorSection);
    }
    profileRedirect(`Billedet er for stort. Vælg et billede på højst ${maxMegabytes} MB.`, redirectOrigin, errorSection);
  }

  await ensureMediaBucket(supabase, redirectOrigin, errorSection, adminReturnTo);

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

function imageLogContext(context: Record<string, boolean | number | string | null | undefined>) {
  return Object.fromEntries(Object.entries(context).filter(([, value]) => value !== undefined));
}

function safeIdSuffix(value: string | null | undefined) {
  return value ? `...${value.slice(-8)}` : null;
}

function logMoodImageError(
  message: string,
  context: Record<string, boolean | number | string | null | undefined>,
  error?: { code?: string; message?: string } | null,
) {
  console.error("[facilitator-profile:mood-image]", imageLogContext({
    ...context,
    errorCode: error?.code,
    errorMessage: error?.message,
    message,
  }));
}

async function uploadImageForAction(
  supabase: ReturnType<typeof createAdminClient>,
  file: FormDataEntryValue | null,
  prefix: string,
) {
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Vælg et billede, og prøv igen.", path: null };
  }

  if (isHeicImage(file)) {
    return { error: "HEIC-billedet kunne ikke konverteres. Prøv et andet billede eller eksportér som JPG.", path: null };
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return { error: "Du kan uploade JPG, PNG eller WebP.", path: null };
  }

  if (file.size > moodImageActionMaxFileSize) {
    return { error: "Billedet er for stort. Vælg et billede på højst 15 MB.", path: null };
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

export async function saveFacilitatorMoodImageAction(formData: FormData) {
  const profile = await requireProfile();
  const supabase = createAdminClient();
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
    profileId: safeIdSuffix(profile.id),
    shouldRemove,
    slotIndex: Number.isFinite(slotIndex) ? slotIndex : null,
    ...fileContext,
  };

  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 2) {
    logMoodImageError("Invalid mood image slot", baseLogContext);
    return imageActionError("Billedpladsen kunne ikke genkendes. Prøv igen.");
  }

  const { data: facilitatorProfile, error: profileError } = await supabase
    .from("facilitator_profiles")
    .select("id, profile_id")
    .eq("profile_id", profile.id)
    .single();

  if (profileError || !facilitatorProfile) {
    logMoodImageError("Facilitator profile lookup failed", baseLogContext, profileError);
    return imageActionError("Arrangørprofilen kunne ikke hentes.");
  }

  let uploadedPath: string | null = null;
  const sortOrder = slotIndex + 1;
  const logContext = {
    ...baseLogContext,
    facilitatorId: safeIdSuffix(facilitatorProfile.id),
    sortOrder,
  };

  if (shouldRemove) {
    const { error: deleteSlotError } = await supabase
      .from("facilitator_images")
      .delete()
      .eq("facilitator_id", facilitatorProfile.id)
      .eq("sort_order", sortOrder);

    if (deleteSlotError) {
      logMoodImageError("Mood image delete failed", logContext, deleteSlotError);
      return imageActionError("Billedet kunne ikke fjernes.");
    }
  } else {
    const upload = await uploadImageForAction(
      supabase,
      imageFile,
      `hosts/${profile.id}/gallery/${slotIndex + 1}`,
    );

    if (upload.error || !upload.path) {
      logMoodImageError(upload.error ?? "Mood image upload failed", logContext);
      return imageActionError(upload.error ?? "Billedet kunne ikke uploades.");
    }

    uploadedPath = upload.path;

    const { data: existingSlot, error: existingSlotError } = await supabase
      .from("facilitator_images")
      .select("id, image_path")
      .eq("facilitator_id", facilitatorProfile.id)
      .eq("sort_order", sortOrder)
      .maybeSingle();

    if (existingSlotError) {
      await supabase.storage.from("media").remove([uploadedPath]);
      logMoodImageError("Existing mood image slot lookup failed", { ...logContext, uploadedPath }, existingSlotError);
      return imageActionError("Billedgalleriet kunne ikke gemmes.");
    }

    const { error: saveImageError } = existingSlot
      ? await supabase
          .from("facilitator_images")
          .update({
            image_path: upload.path,
            alt_text: null,
            sort_order: sortOrder,
          })
          .eq("id", existingSlot.id)
      : await supabase
          .from("facilitator_images")
          .insert({
            facilitator_id: facilitatorProfile.id,
            image_path: upload.path,
            alt_text: null,
            sort_order: sortOrder,
          });

    if (saveImageError) {
      await supabase.storage.from("media").remove([uploadedPath]);
      logMoodImageError("Mood image database save failed", { ...logContext, uploadedPath, existingImage: Boolean(existingSlot) }, saveImageError);
      return imageActionError("Billedgalleriet kunne ikke gemmes.");
    }

    if (existingSlot?.image_path && existingSlot.image_path !== uploadedPath) {
      const { error: removeOldFileError } = await supabase.storage.from("media").remove([existingSlot.image_path]);

      if (removeOldFileError) {
        logMoodImageError("Old mood image storage cleanup failed", { ...logContext, oldPath: existingSlot.image_path, uploadedPath }, removeOldFileError);
      }
    }
  }

  const { data: updatedRows, error: updatedRowsError } = await supabase
    .from("facilitator_images")
    .select("image_path, sort_order")
    .eq("facilitator_id", facilitatorProfile.id)
    .order("sort_order");

  if (updatedRowsError) {
    logMoodImageError("Mood image rows reload failed", logContext, updatedRowsError);
    return imageActionError("Billedgalleriet blev gemt, men kunne ikke hentes igen. Genindlæs siden.");
  }

  revalidatePath("/facilitator/profile");
  return imageActionSuccess(
    Array.from({ length: 3 }, (_, index) => {
      const row = updatedRows?.find((image: { sort_order: number }) => image.sort_order === index + 1);
      return row?.image_path ?? "";
    }),
  );
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
    logMoodImageError("Facilitator profile lookup failed for profile image", logContext, profileError);
    return { message: "Arrangørprofilen kunne ikke hentes.", status: "error" as const };
  }

  const upload = await uploadImageForAction(supabase, imageFile, `hosts/${profile.id}/profile`);

  if (upload.error || !upload.path) {
    logMoodImageError(upload.error ?? "Profile image upload failed", {
      ...logContext,
      facilitatorId: safeIdSuffix(facilitatorProfile.id),
    });
    return { message: upload.error ?? "Profilbilledet kunne ikke uploades.", status: "error" as const };
  }

  const { error: updateError } = await supabase
    .from("facilitator_profiles")
    .update({ profile_image_path: upload.path })
    .eq("id", facilitatorProfile.id);

  if (updateError) {
    await supabase.storage.from("media").remove([upload.path]);
    logMoodImageError("Profile image database save failed", {
      ...logContext,
      facilitatorId: safeIdSuffix(facilitatorProfile.id),
      uploadedPath: upload.path,
    }, updateError);
    return { message: "Profilbilledet kunne ikke gemmes.", status: "error" as const };
  }

  if (facilitatorProfile.profile_image_path && facilitatorProfile.profile_image_path !== upload.path) {
    const { error: removeOldFileError } = await supabase.storage.from("media").remove([facilitatorProfile.profile_image_path]);

    if (removeOldFileError) {
      logMoodImageError("Old profile image storage cleanup failed", {
        ...logContext,
        oldPath: facilitatorProfile.profile_image_path,
        uploadedPath: upload.path,
      }, removeOldFileError);
    }
  }

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/profile");

  return { path: upload.path, status: "success" as const };
}

export async function submitFacilitatorProfileForReviewAction(input: { acceptedTerms: boolean }) {
  const profile = await requireProfile();
  const supabase = createAdminClient();
  const { data: facilitatorProfile, error: profileError } = await supabase
    .from("facilitator_profiles")
    .select(
      "id, company_name, profile_image_path, short_description, long_description, status, facilitator_categories(category_id), facilitator_images(image_path, sort_order)",
    )
    .eq("profile_id", profile.id)
    .single();

  const logContext = {
    action: "submitFacilitatorProfileForReviewAction",
    profileId: safeIdSuffix(profile.id),
  };

  if (profileError || !facilitatorProfile) {
    console.error("[facilitator-profile:submit]", imageLogContext({
      ...logContext,
      errorCode: profileError?.code,
      errorMessage: profileError?.message,
      message: "Facilitator profile lookup failed",
    }));
    return { message: "Arrangørprofilen kunne ikke hentes.", ok: false };
  }

  const hasDescription = Boolean(
    facilitatorProfile.long_description?.trim() || facilitatorProfile.short_description?.trim(),
  );
  const missingFields = [
    profile.full_name?.trim() ? null : "navn",
    facilitatorProfile.company_name?.trim() ? null : "profilnavn",
    facilitatorProfile.profile_image_path ? null : "profilbillede",
    facilitatorProfile.facilitator_categories?.length ? null : "arbejdsområder",
    hasDescription ? null : "fortælling",
    facilitatorProfile.facilitator_images?.length ? null : "stemningsbillede",
  ].filter((item): item is string => Boolean(item));

  if (missingFields.length > 0) {
    return {
      message: `Der mangler stadig: ${missingFields.join(", ")}.`,
      ok: false,
    };
  }

  const missingAcceptances = await getMissingRequiredLegalAcceptances(supabase, profile.id, organizerAcceptanceTypes);

  if (missingAcceptances.length > 0 && !input.acceptedTerms) {
    return { message: "Du skal acceptere arrangørvilkår og retningslinjer, før profilen kan sendes til godkendelse.", ok: false };
  }

  if (missingAcceptances.length > 0) {
    try {
      await recordLegalAcceptances(supabase, {
        action: "facilitator_profile_submission",
        documentTypes: organizerAcceptanceTypes,
        profileId: profile.id,
      });
    } catch (error) {
      console.error("[facilitator-profile:submit]", imageLogContext({
        ...logContext,
        errorMessage: errorMessage(error),
        message: "Legal acceptance save failed",
      }));
      return { message: "Accepten af vilkår kunne ikke gemmes. Prøv igen.", ok: false };
    }
  }

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/profile");

  return { message: "Din profil er sendt til SoulEvents’ gennemgang.", ok: true };
}

export async function updateFacilitatorProfileAction(formData: FormData) {
  const profile = await requireProfile();
  const supabase = createAdminClient();
  const redirectOrigin = getOptionalString(formData, "current_origin");
  const adminTargetFacilitatorId = getOptionalString(formData, "admin_target_facilitator_id");
  const adminReturnTo = getOptionalString(formData, "admin_return_to");
  const isAdminEdit = Boolean(adminTargetFacilitatorId);
  const section = normalizeProfileSection(getString(formData, "section"));

  if (!section) {
    const message = "Profilen blev ikke gemt, fordi gemmehandlingen manglede. Prøv igen.";
    if (isAdminEdit) {
      adminProfileRedirect(message, adminReturnTo, "contact");
    }
    profileRedirect(message, redirectOrigin, "contact");
  }

  if (isAdminEdit && profile.role !== "admin") {
    adminProfileRedirect("Du har ikke adgang til at redigere denne arrangør.", adminReturnTo, "contact");
  }

  const fullName = getString(formData, "full_name");
  const phone = getOptionalString(formData, "phone");
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
  const postalCode = getOptionalString(formData, "postal_code");
  const city = getOptionalString(formData, "city");
  const country = getOptionalString(formData, "country") || "Danmark";
  const isOnlineFacilitator = formData.get("is_online_facilitator") === "on";
  let regionId: string | null = null;
  const categoryIds = getAllStrings(formData, "category_ids");
  const uniqueCategoryIds = [...new Set(categoryIds)];
  const offersServices = formData.get("offers_services") === "on";
  const serviceTitleIds = getAllStrings(formData, "service_title_ids");
  const serviceDescription = getOptionalString(formData, "service_description");
  const serviceOtherTitle = getOptionalString(formData, "service_other_title");
  const showInLocalServiceResults = formData.get("show_in_local_service_results") === "on";
  const galleryPaths = formData
    .getAll("gallery_image_paths")
    .slice(0, 3)
    .map((item) => (typeof item === "string" ? item.trim() : ""));

  let existingProfileQuery = supabase
    .from("facilitator_profiles")
    .select(
      "id, profile_id, address_line, city, company_name, country, facebook_url, instagram_url, is_online_facilitator, long_description, offers_services, postal_code, profile_image_path, public_email, public_phone, region_id, service_description, service_other_title, short_description, show_in_local_service_results, status, tiktok_url, website_url, youtube_url, facilitator_categories(category_id), facilitator_tags(tag_id), profiles!facilitator_profiles_profile_id_fkey(id, full_name, email, phone)",
    );

  existingProfileQuery = isAdminEdit
    ? existingProfileQuery.eq("id", adminTargetFacilitatorId as string)
    : existingProfileQuery.eq("profile_id", profile.id);

  const { data: existingProfile, error: existingProfileError } = await existingProfileQuery.single();

  if (existingProfileError || !existingProfile) {
    const message = "Arrangørprofilen kunne ikke hentes.";
    if (isAdminEdit) {
      adminProfileRedirect(message, adminReturnTo, fallbackErrorSection(section, "contact"));
    }
    profileRedirect(message, redirectOrigin, fallbackErrorSection(section, "contact"));
  }

  const facilitatorId = existingProfile.id as string;
  const targetProfileRelation = Array.isArray(existingProfile.profiles) ? existingProfile.profiles[0] : existingProfile.profiles;
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
    existingProfile.facilitator_categories?.map((row: { category_id: string }) => row.category_id) ?? [];
  const wasReady = isProfileReady({
    categoryIds: existingCategoryIds,
    city: existingProfile.city ?? null,
    companyName: existingProfile.company_name ?? null,
    fullName: targetProfile.full_name ?? null,
    postalCode: existingProfile.postal_code ?? null,
  });

  if (savesSection(section, "contact") && !fullName) {
    if (isAdminEdit) {
      adminProfileRedirect("Det rigtige navn skal udfyldes.", adminReturnTo, "contact");
    }
    profileRedirect("Dit rigtige navn skal udfyldes.", redirectOrigin, "contact");
  }

  const lengthChecks: Array<[boolean, string | null, number, string, EditableProfileSection]> = [
    [savesSection(section, "contact"), fullName, 80, "Navn", "contact"],
    [savesSection(section, "contact"), companyName, 100, "Profilnavn", "contact"],
    [savesSection(section, "contact"), shortDescription, 300, "Kort præsentation", "contact"],
    [savesSection(section, "contact"), longDescription, 2000, "Uddybende beskrivelse", "contact"],
    [savesSection(section, "location"), addressLine, 120, "Adresse", "location"],
    [savesSection(section, "location"), postalCode, 20, "Postnummer", "location"],
    [savesSection(section, "location"), city, 80, "By", "location"],
    [savesSection(section, "location"), country, 80, "Land", "location"],
    [savesSection(section, "social"), publicEmail, 180, "Offentlig e-mail", "social"],
    [savesSection(section, "social"), publicPhone, 40, "Offentlig telefon", "social"],
    [savesSection(section, "social"), websiteUrl, 300, "Website", "social"],
    [savesSection(section, "social"), facebookUrl, 300, "Facebook-link", "social"],
    [savesSection(section, "social"), instagramUrl, 300, "Instagram-link", "social"],
    [savesSection(section, "social"), youtubeUrl, 300, "YouTube-link", "social"],
    [savesSection(section, "social"), tiktokUrl, 300, "TikTok-link", "social"],
    [savesSection(section, "services"), serviceDescription, 500, "Kort beskrivelse af ydelser", "services"],
    [savesSection(section, "services"), serviceOtherTitle, 120, "Anden titel eller uddybning", "services"],
  ];

  for (const [shouldValidate, value, maxLength, label, errorSection] of lengthChecks) {
    if (shouldValidate && value && value.length > maxLength) {
      if (isAdminEdit) {
        adminProfileRedirect(label + " må højst være " + maxLength + " tegn.", adminReturnTo, errorSection);
      }
      profileRedirect(label + " må højst være " + maxLength + " tegn.", redirectOrigin, errorSection);
    }
  }

  if (savesSection(section, "images") && galleryPaths.some((galleryPath) => galleryPath.length > 300)) {
    if (isAdminEdit) {
      adminProfileRedirect("Billedstier må højst være 300 tegn.", adminReturnTo, "images");
    }
    profileRedirect("Billedstier må højst være 300 tegn.", redirectOrigin, "images");
  }

  if (savesSection(section, "contact") && !companyName) {
    if (isAdminEdit) {
      adminProfileRedirect("Det viste navn skal udfyldes.", adminReturnTo, "contact");
    }
    profileRedirect("Det navn du ønsker at blive vist under skal udfyldes.", redirectOrigin, "contact");
  }

  if (savesSection(section, "contact") && phone && !isValidPhoneNumber(phone)) {
    if (isAdminEdit) {
      adminProfileRedirect("Telefonnummer skal bestå af præcis 8 tal. Kun tal og mellemrum er tilladt.", adminReturnTo, "contact");
    }
    profileRedirect("Telefonnummer skal bestå af præcis 8 tal. Kun tal og mellemrum er tilladt.", redirectOrigin, "contact");
  }

  if (savesSection(section, "location") && (!postalCode || !city)) {
    if (isAdminEdit) {
      adminProfileRedirect("Postnummer og by skal udfyldes.", adminReturnTo, "location");
    }
    profileRedirect("Postnummer og by skal udfyldes.", redirectOrigin, "location");
  }

  if (savesSection(section, "categories") && !uniqueCategoryIds.length) {
    if (isAdminEdit) {
      adminProfileRedirect("Vælg mindst ét arbejdsområde.", adminReturnTo, "categories");
    }
    profileRedirect("Vælg mindst ét arbejdsområde, så vi kan placere din profil korrekt.", redirectOrigin, "categories");
  }

  if (
    savesSection(section, "services") &&
    offersServices &&
    serviceTitleIds.length === 0 &&
    !serviceOtherTitle &&
    !serviceDescription
  ) {
    if (isAdminEdit) {
      adminProfileRedirect("Vælg mindst én titel/ydelse fra listen, eller skriv en egen titel eller uddybning.", adminReturnTo, "services");
    }
    profileRedirect("Vælg mindst én titel/ydelse fra listen, eller skriv din egen titel eller uddybning.", redirectOrigin, "services");
  }

  if (savesSection(section, "contact")) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName || targetProfile.full_name || "",
        phone,
      })
      .eq("id", targetProfile.id);

    if (profileError) {
      if (isAdminEdit) {
        adminProfileRedirect("Profilen kunne ikke gemmes.", adminReturnTo, "contact");
      }
      profileRedirect("Profilen kunne ikke gemmes.", redirectOrigin, "contact");
    }
  }

  const facilitatorUpdates: Record<string, string | number | boolean | null> = {};

  if (savesSection(section, "contact")) {
    facilitatorUpdates.company_name = companyName;
    facilitatorUpdates.long_description = longDescription;
    facilitatorUpdates.short_description = shortDescription;
  }

  if (savesSection(section, "social")) {
    facilitatorUpdates.facebook_url = facebookUrl;
    facilitatorUpdates.instagram_url = instagramUrl;
    facilitatorUpdates.public_email = publicEmail;
    facilitatorUpdates.public_phone = publicPhone;
    facilitatorUpdates.tiktok_url = tiktokUrl;
    facilitatorUpdates.website_url = websiteUrl;
    facilitatorUpdates.youtube_url = youtubeUrl;
  }

  if (savesSection(section, "location")) {
    const inferredSlug = inferRegionSlug({ city, postalCode });

    if (inferredSlug) {
      const { data: inferredRegion } = await supabase.from("regions").select("id").eq("slug", inferredSlug).maybeSingle();
      regionId = inferredRegion?.id ?? null;
    }

    const coordinates = postalCode && city ? await geocodeDanishAddress({ addressLine, postalCode, city }) : null;

    facilitatorUpdates.address_line = addressLine;
    facilitatorUpdates.city = city;
    facilitatorUpdates.country = country;
    facilitatorUpdates.is_online_facilitator = isOnlineFacilitator;
    facilitatorUpdates.latitude = coordinates?.latitude ?? null;
    facilitatorUpdates.longitude = coordinates?.longitude ?? null;
    facilitatorUpdates.postal_code = postalCode;
    facilitatorUpdates.region_id = regionId;
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
    facilitatorUpdates.service_description = offersServices ? serviceDescription : null;
    facilitatorUpdates.service_other_title = offersServices ? serviceOtherTitle : null;
    facilitatorUpdates.show_in_local_service_results = offersServices && showInLocalServiceResults;
  }

  if (Object.keys(facilitatorUpdates).length > 0) {
    const { error: facilitatorError } = await supabase
      .from("facilitator_profiles")
      .update(facilitatorUpdates)
      .eq("id", facilitatorId);

    if (facilitatorError) {
      const message = "Arrangørprofilen kunne ikke gemmes.";
      if (isAdminEdit) {
        adminProfileRedirect(message, adminReturnTo, fallbackErrorSection(section, "contact"));
      }
      profileRedirect(message, redirectOrigin, fallbackErrorSection(section, "contact"));
    }
  }

  if (savesSection(section, "categories")) {
    const { error: categoryError } = await supabase.from("facilitator_categories").upsert(
      uniqueCategoryIds.map((categoryId) => ({
        facilitator_id: facilitatorId,
        category_id: categoryId,
      })),
      { onConflict: "facilitator_id,category_id" },
    );

    if (categoryError) {
      if (isAdminEdit) {
        adminProfileRedirect("Arbejdsområderne kunne ikke gemmes.", adminReturnTo, "categories");
      }
      profileRedirect("Arbejdsområderne kunne ikke gemmes.", redirectOrigin, "categories");
    }

    const { error: deleteCategoryError } = await supabase
      .from("facilitator_categories")
      .delete()
      .eq("facilitator_id", facilitatorId)
      .not("category_id", "in", `(${uniqueCategoryIds.join(",")})`);

    if (deleteCategoryError) {
      if (isAdminEdit) {
        adminProfileRedirect("Arbejdsområderne kunne ikke gemmes.", adminReturnTo, "categories");
      }
      profileRedirect("Arbejdsområderne kunne ikke gemmes.", redirectOrigin, "categories");
    }
  }

  if (savesSection(section, "services")) {
    const { error: deleteServiceTitleError } = await supabase
      .from("facilitator_service_titles")
      .delete()
      .eq("facilitator_id", facilitatorId);

    if (deleteServiceTitleError) {
      if (isAdminEdit) {
        adminProfileRedirect("Behandlertitlerne kunne ikke gemmes.", adminReturnTo, "services");
      }
      profileRedirect("Behandlertitlerne kunne ikke gemmes.", redirectOrigin, "services");
    }

    if (offersServices && serviceTitleIds.length > 0) {
      const { error: serviceTitleError } = await supabase.from("facilitator_service_titles").insert(
        serviceTitleIds.map((serviceTitleId) => ({
          facilitator_id: facilitatorId,
          service_title_id: serviceTitleId,
        })),
      );

      if (serviceTitleError) {
        if (isAdminEdit) {
          adminProfileRedirect("Behandlertitlerne kunne ikke gemmes.", adminReturnTo, "services");
        }
        profileRedirect("Behandlertitlerne kunne ikke gemmes.", redirectOrigin, "services");
      }
    }
  }

  if (savesSection(section, "images")) {
    const { error: deleteImageError } = await supabase.from("facilitator_images").delete().eq("facilitator_id", facilitatorId);

    if (deleteImageError) {
      if (isAdminEdit) {
        adminProfileRedirect("Billedgalleriet kunne ikke gemmes.", adminReturnTo, "images");
      }
      profileRedirect("Billedgalleriet kunne ikke gemmes.", redirectOrigin, "images");
    }

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

    const finalGalleryPaths = [0, 1, 2]
      .map((index) => galleryUploads[index] || galleryPaths[index] || "")
      .filter((imagePath): imagePath is string => Boolean(imagePath));
    const galleryRows = normalizeImageRows(finalGalleryPaths, []);

    if (galleryRows.length > 0) {
      const { error: imageError } = await supabase.from("facilitator_images").insert(
        galleryRows.map((row) => ({
          facilitator_id: facilitatorId,
          ...row,
        })),
      );

      if (imageError) {
        if (isAdminEdit) {
          adminProfileRedirect("Billedgalleriet kunne ikke gemmes.", adminReturnTo, "images");
        }
        profileRedirect("Billedgalleriet kunne ikke gemmes.", redirectOrigin, "images");
      }
    }
  }

  const finalReady = isProfileReady({
    categoryIds: savesSection(section, "categories") ? uniqueCategoryIds : existingCategoryIds,
    city: savesSection(section, "location") ? city : existingProfile.city ?? null,
    companyName: savesSection(section, "contact") ? companyName : existingProfile.company_name ?? null,
    fullName: savesSection(section, "contact") ? fullName : targetProfile.full_name ?? null,
    postalCode: savesSection(section, "location") ? postalCode : existingProfile.postal_code ?? null,
  });

  const shouldRequestApproval = !isAdminEdit && finalReady && existingProfile.status === "pending";
  const acceptedOrganizerTerms = formData.get("accepted_organizer_terms") === "yes";

  if (shouldRequestApproval) {
    const missingAcceptances = await getMissingRequiredLegalAcceptances(supabase, targetProfile.id, organizerAcceptanceTypes);

    if (missingAcceptances.length > 0 && !acceptedOrganizerTerms) {
      profileRedirect("Du skal acceptere arrangørvilkår og retningslinjer, før profilen kan sendes til godkendelse.", redirectOrigin, "contact");
    }

    if (missingAcceptances.length > 0) {
      try {
        await recordLegalAcceptances(supabase, {
          action: "facilitator_profile_submission",
          documentTypes: organizerAcceptanceTypes,
          profileId: targetProfile.id,
        });
      } catch {
        profileRedirect("Accepten af vilkår kunne ikke gemmes. Prøv igen.", redirectOrigin, "contact");
      }
    }
  }

  const shouldNotifyAdmins = shouldRequestApproval && !wasReady;

  if (shouldNotifyAdmins) {
    await notifyAdminsIfReady({
      facilitatorEmail: profile.email,
      facilitatorId,
      facilitatorName: companyName || existingProfile.company_name || fullName || targetProfile.full_name || targetProfile.email,
      wasReady,
    });
  }

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/profile");
  revalidatePath("/admin/users");
  revalidatePath("/admin/facilitators/" + facilitatorId + "/edit");
  revalidatePath("/facilitators/" + facilitatorId);
  if (isAdminEdit) {
    adminProfileSuccessRedirect("Ændringer gemt. Arrangørprofilen er opdateret.", adminReturnTo, section);
  }
  profileSuccessRedirect(
    shouldRequestApproval ? "Ændringer gemt. Din profil afventer godkendelse." : "Ændringer gemt. Din profil er opdateret.",
    shouldRequestApproval,
    redirectOrigin,
    section,
  );
}
