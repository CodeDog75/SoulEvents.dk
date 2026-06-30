"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { getAllStrings, getOptionalString, getString } from "@/lib/forms/form-data";
import { profileApprovalUrl, sendFacilitatorProfileReadyEmail } from "@/lib/email/facilitator-profile-ready";
import { geocodeDanishAddress } from "@/lib/mapbox/geocode";
import { inferRegionSlug } from "@/lib/regions/infer-region";
import { createAdminClient } from "@/lib/supabase/admin";

function profileRedirect(message: string): never {
  redirect(`/facilitator/profile?message=${encodeURIComponent(message)}`);
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
  shortDescription: string;
}) {
  return (
    Boolean(input.companyName) &&
    Boolean(input.fullName) &&
    input.shortDescription.trim().length >= 20 &&
    Boolean(input.postalCode) &&
    Boolean(input.city) &&
    input.categoryIds.length > 0
  );
}

function profileSuccessRedirect(message: string, ready: boolean): never {
  const params = new URLSearchParams({ message });

  if (ready) {
    params.set("ready", "1");
  }

  redirect(`/facilitator/profile?${params.toString()}`);
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
  const { data: admins } = await supabase.from("profiles").select("email").eq("role", "admin");
  const submittedAt = new Date().toISOString();

  await Promise.all(
    (admins ?? []).map((admin) =>
      sendFacilitatorProfileReadyEmail({
        adminEmail: admin.email,
        facilitatorEmail: input.facilitatorEmail,
        facilitatorName: input.facilitatorName,
        profileUrl: profileApprovalUrl(),
        submittedAt,
      }),
    ),
  );
}

async function ensureMediaBucket(supabase: ReturnType<typeof createAdminClient>) {
  const { data: bucket } = await supabase.storage.getBucket("media");

  if (bucket) {
    return;
  }

  const { error } = await supabase.storage.createBucket("media", {
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    fileSizeLimit: 10 * 1024 * 1024,
    public: true,
  });

  if (error && !error.message.toLowerCase().includes("already exists")) {
    profileRedirect("Storage-bucket 'media' kunne ikke oprettes automatisk. Kør storage-migrationen i Supabase.");
  }
}

async function uploadImage(supabase: ReturnType<typeof createAdminClient>, file: File, prefix: string) {
  if (!file || file.size === 0) {
    return null;
  }

  if (isHeicImage(file)) {
    profileRedirect("HEIC-billedet kunne ikke konverteres. Prøv et andet billede eller eksportér som JPG.");
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    profileRedirect("Du kan uploade JPG, PNG, WEBP eller HEIC. HEIC konverteres automatisk i browseren.");
  }

  if (file.size > 10 * 1024 * 1024) {
    profileRedirect("Billedet må højst fylde 10 MB.");
  }

  await ensureMediaBucket(supabase);

  const path = `${prefix}/${crypto.randomUUID()}.${extensionForUpload(file)}`;
  const { error } = await supabase.storage.from("media").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    profileRedirect("Billedet kunne ikke uploades. Tjek at media-bucket findes i Supabase, og at filen er JPG, PNG eller WebP under 10 MB.");
  }

  return path;
}

export async function updateFacilitatorProfileAction(formData: FormData) {
  const profile = await requireRole("facilitator");
  const supabase = createAdminClient();
  const section = getString(formData, "section") || "all";

  const fullName = getString(formData, "full_name");
  const phone = getOptionalString(formData, "phone");
  const companyName = getOptionalString(formData, "company_name");
  const shortDescription = getString(formData, "short_description");
  const longDescription = getString(formData, "long_description");
  let profileImagePath = getOptionalString(formData, "profile_image_path");
  const websiteUrl = getOptionalString(formData, "website_url");
  const facebookUrl = getOptionalString(formData, "facebook_url");
  const instagramUrl = getOptionalString(formData, "instagram_url");
  const addressLine = getOptionalString(formData, "address_line");
  const postalCode = getOptionalString(formData, "postal_code");
  const city = getOptionalString(formData, "city");
  let regionId: string | null = null;
  const categoryIds = getAllStrings(formData, "category_ids");
  const tagIds = getAllStrings(formData, "tag_ids");
  const offersServices = formData.get("offers_services") === "on";
  const serviceTitleIds = getAllStrings(formData, "service_title_ids");
  const serviceDescription = getOptionalString(formData, "service_description");
  const serviceOtherTitle = getOptionalString(formData, "service_other_title");
  const showInLocalServiceResults = formData.get("show_in_local_service_results") === "on";
  const galleryPaths = formData
    .getAll("gallery_image_paths")
    .slice(0, 3)
    .map((item) => (typeof item === "string" ? item.trim() : ""));

  if ((section === "all" || section === "contact") && !fullName) {
    profileRedirect("Dit rigtige navn skal udfyldes.");
  }

  const lengthChecks: Array<[string | null, number, string]> = [
    [fullName, 80, "Navn"],
    [companyName, 100, "Profilnavn"],
    [shortDescription, 300, "Kort præsentation"],
    [longDescription, 2000, "Uddybende beskrivelse"],
    [addressLine, 120, "Adresse"],
    [postalCode, 20, "Postnummer"],
    [city, 80, "By"],
    [websiteUrl, 300, "Website"],
    [facebookUrl, 300, "Facebook-link"],
    [instagramUrl, 300, "Instagram-link"],
    [serviceDescription, 500, "Kort beskrivelse af ydelser"],
    [serviceOtherTitle, 120, "Anden titel eller uddybning"],
  ];

  for (const [value, maxLength, label] of lengthChecks) {
    if (value && value.length > maxLength) {
      profileRedirect(label + " må højst være " + maxLength + " tegn.");
    }
  }

  if (galleryPaths.some((galleryPath) => galleryPath.length > 300)) {
    profileRedirect("Billedstier må højst være 300 tegn.");
  }

  if ((section === "all" || section === "contact") && !companyName) {
    profileRedirect("Det navn du ønsker at blive vist under skal udfyldes.");
  }

  if (phone && !isValidPhoneNumber(phone)) {
    profileRedirect("Telefonnummer skal bestå af præcis 8 tal. Kun tal og mellemrum er tilladt.");
  }

  if ((section === "all" || section === "contact") && shortDescription && shortDescription.length < 20) {
    profileRedirect("Kort præsentation skal være mindst 20 tegn.");
  }

  if ((section === "all" || section === "location") && (!postalCode || !city)) {
    profileRedirect("Postnummer og by skal udfyldes.");
  }

  if (section === "all" && !categoryIds.length) {
    profileRedirect("Vælg mindst én kategori, så vi kan placere din profil korrekt.");
  }

  if (
    (section === "all" || section === "services") &&
    offersServices &&
    serviceTitleIds.length === 0 &&
    !serviceOtherTitle &&
    !serviceDescription
  ) {
    profileRedirect("Vælg mindst én titel/ydelse fra listen, eller skriv din egen titel eller uddybning.");
  }

  const { data: existingProfile } = await supabase
    .from("facilitator_profiles")
    .select("id, address_line, city, company_name, postal_code, short_description, facilitator_categories(category_id), facilitator_tags(tag_id)")
    .eq("profile_id", profile.id)
    .single();
  const existingCategoryIds =
    existingProfile?.facilitator_categories?.map((row: { category_id: string }) => row.category_id) ?? [];
  const wasReady = isProfileReady({
    categoryIds: existingCategoryIds,
    city: existingProfile?.city ?? null,
    companyName: existingProfile?.company_name ?? null,
    fullName: profile.full_name ?? null,
    postalCode: existingProfile?.postal_code ?? null,
    shortDescription: existingProfile?.short_description ?? "",
  });

  const inferredSlug = inferRegionSlug({ city, postalCode });

  if (inferredSlug) {
    const { data: inferredRegion } = await supabase.from("regions").select("id").eq("slug", inferredSlug).maybeSingle();
    regionId = inferredRegion?.id ?? null;
  }

  if (section === "all" || section === "contact") {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone,
      })
      .eq("id", profile.id);

    if (profileError) {
      profileRedirect("Profilen kunne ikke gemmes.");
    }
  }

  const uploadedProfileImage =
    section === "all" || section === "images"
      ? await uploadImage(supabase, formData.get("profile_image_file") as File, `hosts/${profile.id}/profile`)
      : null;

  if (uploadedProfileImage) {
    profileImagePath = uploadedProfileImage;
  }

  const coordinates = section === "all" || section === "location" ? await geocodeDanishAddress({ addressLine, postalCode, city }) : null;
  const facilitatorUpdates: Record<string, string | number | boolean | null> = {};

  if (section === "all" || section === "contact") {
    facilitatorUpdates.company_name = companyName;
    facilitatorUpdates.short_description = shortDescription;
    facilitatorUpdates.long_description = longDescription;
  }

  if (section === "all" || section === "location") {
    facilitatorUpdates.address_line = addressLine;
    facilitatorUpdates.postal_code = postalCode;
    facilitatorUpdates.city = city;
    facilitatorUpdates.region_id = regionId;
    facilitatorUpdates.latitude = coordinates?.latitude ?? null;
    facilitatorUpdates.longitude = coordinates?.longitude ?? null;
  }

  if (section === "all" || section === "social") {
    facilitatorUpdates.website_url = websiteUrl;
    facilitatorUpdates.facebook_url = facebookUrl;
    facilitatorUpdates.instagram_url = instagramUrl;
  }

  if (section === "all" || section === "images") {
    facilitatorUpdates.profile_image_path = profileImagePath;
  }

  if (section === "all" || section === "services") {
    facilitatorUpdates.offers_services = offersServices;
    facilitatorUpdates.service_description = offersServices ? serviceDescription : null;
    facilitatorUpdates.service_other_title = offersServices ? serviceOtherTitle : null;
    facilitatorUpdates.show_in_local_service_results = offersServices && showInLocalServiceResults;
  }

  const { data: facilitatorProfile, error: facilitatorError } = Object.keys(facilitatorUpdates).length
    ? await supabase
        .from("facilitator_profiles")
        .update(facilitatorUpdates)
        .eq("profile_id", profile.id)
        .select("id")
        .single()
    : await supabase.from("facilitator_profiles").select("id").eq("profile_id", profile.id).single();

  if (facilitatorError || !facilitatorProfile) {
    profileRedirect("Arrangørprofilen kunne ikke gemmes.");
  }

  const facilitatorId = facilitatorProfile.id as string;

  if (section === "all" || section === "categories") {
    await supabase.from("facilitator_categories").delete().eq("facilitator_id", facilitatorId);
  }

  if ((section === "all" || section === "categories") && categoryIds.length > 0) {
    const { error: categoryError } = await supabase.from("facilitator_categories").insert(
      categoryIds.map((categoryId) => ({
        facilitator_id: facilitatorId,
        category_id: categoryId,
      })),
    );

    if (categoryError) {
      profileRedirect("Kategorierne kunne ikke gemmes.");
    }
  }

  if (section === "all" || section === "services") {
    await supabase.from("facilitator_service_titles").delete().eq("facilitator_id", facilitatorId);

    if (offersServices && serviceTitleIds.length > 0) {
      const { error: serviceTitleError } = await supabase.from("facilitator_service_titles").insert(
        serviceTitleIds.map((serviceTitleId) => ({
          facilitator_id: facilitatorId,
          service_title_id: serviceTitleId,
        })),
      );

      if (serviceTitleError) {
        profileRedirect("Behandlertitlerne kunne ikke gemmes.");
      }
    }
  }

  if (section === "all" || section === "images") {
    await supabase.from("facilitator_images").delete().eq("facilitator_id", facilitatorId);

    const galleryUploads = await Promise.all(
      formData
        .getAll("gallery_image_files")
        .slice(0, 3)
        .map((file, index) => uploadImage(supabase, file as File, `hosts/${profile.id}/gallery/${index + 1}`)),
    );

    const finalGalleryPaths = galleryPaths.map((imagePath, index) => galleryUploads[index] || imagePath).filter(Boolean);
    const galleryRows = normalizeImageRows(finalGalleryPaths, []);

    if (galleryRows.length > 0) {
      const { error: imageError } = await supabase.from("facilitator_images").insert(
        galleryRows.map((row) => ({
          facilitator_id: facilitatorId,
          ...row,
        })),
      );

      if (imageError) {
        profileRedirect("Billedgalleriet kunne ikke gemmes.");
      }
    }
  }

  const finalReady = isProfileReady({
    categoryIds,
    city,
    companyName,
    fullName,
    postalCode,
    shortDescription,
  });

  if (finalReady) {
    await notifyAdminsIfReady({
      facilitatorEmail: profile.email,
      facilitatorId,
      facilitatorName: companyName || fullName || profile.full_name || profile.email,
      wasReady,
    });
  }

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/profile");
  profileSuccessRedirect(finalReady ? "Ændringer gemt. Din profil afventer godkendelse." : "Ændringer gemt.", finalReady);
}
