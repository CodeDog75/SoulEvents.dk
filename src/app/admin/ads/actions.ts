"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { getOptionalString, getString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureMediaStorageBucket } from "@/lib/supabase/storage-buckets";

const maxAdImageBytes = 20 * 1024 * 1024;
const maxAdVideoBytes = 100 * 1024 * 1024;

function go(message: string): never {
  redirect("/admin/ads?message=" + encodeURIComponent(message));
}

function numberFrom(formData: FormData, name: string, fallback: number) {
  const value = Number(formData.get(name));
  return Number.isFinite(value) ? value : fallback;
}

function dateValue(formData: FormData, name: string) {
  const value = getOptionalString(formData, name);
  if (!value) return null;
  return new Date(value + "T00:00:00").toISOString();
}

function isInvalidDateRange(startsAt: string | null, endsAt: string | null) {
  if (!startsAt || !endsAt) return false;
  return new Date(endsAt).getTime() < new Date(startsAt).getTime();
}

function isValidAdUrl(value: string | null) {
  if (!value) return true;
  return /^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value);
}

function homepagePlacementValue(formData: FormData) {
  const value = getOptionalString(formData, "homepage_placement");
  return value === "middle" ? "middle" : "bottom";
}

const optionalAdColumns = [
  "mobile_image_path",
  "show_on_homepage",
  "homepage_placement",
  "show_in_newsletter",
  "show_title_on_banner",
  "show_sponsor_on_banner",
  "admin_note",
] as const;

function adErrorText(error: { message?: string; details?: string; code?: string } | null | undefined) {
  const text = [error?.message, error?.details, error?.code].filter(Boolean).join(" ").toLowerCase();
  return text;
}

function adUploadErrorMessage(error: { message?: string; statusCode?: string | number } | null | undefined) {
  const message = (error?.message ?? "").toLowerCase();
  const statusCode = String(error?.statusCode ?? "");

  if (message.includes("row-level security") || message.includes("violates row-level security")) {
    return "Storage afviser uploaden på grund af manglende admin-policy. Kør migration 065 og prøv igen.";
  }

  if (message.includes("exceeded") || message.includes("too large") || statusCode === "413") {
    return "Filen er større end den aktuelle Storage-grænse. Kør migration 065 og prøv igen.";
  }

  if (message.includes("mime") || message.includes("type")) {
    return "Storage afviser filtypen. Tjek at video/mp4 er tilladt i media-bucketten.";
  }

  return "Filen kunne ikke uploades: " + (error?.message ?? "Ukendt Storage-fejl");
}

function isMissingOptionalAdColumnError(error: { message?: string; details?: string; code?: string } | null | undefined) {
  const text = adErrorText(error);
  return text.includes("schema cache") || optionalAdColumns.some((column) => text.includes(column));
}

function legacyAdPayload(payload: Record<string, unknown>) {
  const nextPayload = { ...payload };
  optionalAdColumns.forEach((column) => {
    delete nextPayload[column];
  });
  return nextPayload;
}

type AdUploadSlot = "desktop" | "mobile";

function detectedExtensionFromMetadata(fileName: string, contentType: string) {
  const fromName = fileName.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp", "mp4"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (contentType === "image/png") return "png";
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/webp") return "webp";
  if (contentType === "video/mp4") return "mp4";
  return null;
}

function extensionFromMetadata(fileName: string, contentType: string) {
  return detectedExtensionFromMetadata(fileName, contentType) ?? "jpg";
}

function isAllowedAdMedia(fileName: string, contentType: string) {
  const extension = detectedExtensionFromMetadata(fileName, contentType);
  return ["image/png", "image/jpeg", "image/webp", "video/mp4"].includes(contentType) && Boolean(extension);
}

function adMediaContentType(fileName: string, contentType: string) {
  const extension = extensionFromMetadata(fileName, contentType);

  if (extension === "mp4") return "video/mp4";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

function validateAdMediaMetadata(input: { contentType: string; fileName: string; size: number }) {
  if (!isAllowedAdMedia(input.fileName, input.contentType)) {
    return "Filen skal være PNG, JPG, WebP eller MP4.";
  }

  const isVideo = extensionFromMetadata(input.fileName, input.contentType) === "mp4";
  const maxSize = isVideo ? maxAdVideoBytes : maxAdImageBytes;
  if (input.size > maxSize) {
    return isVideo ? "Videoen er for stor. Vælg en MP4 under 100 MB." : "Billedet er for stort. Vælg et billede under 20 MB.";
  }

  return null;
}

function adMediaPath(slot: AdUploadSlot, input: { contentType: string; fileName: string }) {
  const safeName = input.fileName
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);

  return "ads/" + slot + "-" + Date.now() + "-" + crypto.randomUUID().slice(0, 8) + "-" + (safeName || "partner") + "." + extensionFromMetadata(input.fileName, input.contentType);
}

function formContainsBinaryUpload(formData: FormData) {
  return ["image_file", "mobile_image_file"].some((field) => {
    const value = formData.get(field);
    return value instanceof File && value.size > 0;
  });
}

export async function createSignedAdUploadAction(input: {
  contentType: string;
  fileName: string;
  size: number;
  slot: AdUploadSlot;
}) {
  await requireRole("admin");

  const slot = input.slot === "mobile" ? "mobile" : "desktop";
  const metadata = {
    contentType: input.contentType,
    fileName: input.fileName,
    size: Number(input.size),
  };
  const validationError = validateAdMediaMetadata(metadata);

  if (validationError) {
    return { error: validationError, path: null, token: null };
  }

  const imagePath = adMediaPath(slot, metadata);
  const supabase = createAdminClient();
  const bucketError = await ensureMediaStorageBucket(supabase);

  if (bucketError) {
    console.error("Ad media bucket setup error", {
      message: bucketError.message,
      path: imagePath,
      size: metadata.size,
      type: metadata.contentType,
    });
    return { error: "Media-bucketten kunne ikke klargøres. Kør storage-migrationen og prøv igen.", path: null, token: null };
  }

  const { data, error } = await supabase.storage.from("media").createSignedUploadUrl(imagePath, {
    upsert: false,
  });

  if (error) {
    console.error("Signed ad media upload URL could not be created", {
      message: error.message,
      path: imagePath,
      size: metadata.size,
      type: metadata.contentType,
    });
    return { error: adUploadErrorMessage(error), path: null, token: null };
  }

  return {
    contentType: adMediaContentType(metadata.fileName, metadata.contentType),
    error: null,
    path: data.path,
    token: data.token,
  };
}

export async function cleanupAdMediaUploadsAction(paths: string[]) {
  await requireRole("admin");

  const safePaths = paths.filter((path) => path && path.startsWith("ads/") && !/^https?:\/\//i.test(path));
  if (safePaths.length === 0) {
    return { error: null };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.storage.from("media").remove(safePaths);
  if (error) {
    console.warn("Uploaded ad media could not be cleaned up", {
      message: error.message,
      paths: safePaths,
    });
    return { error: "Uploadede filer kunne ikke ryddes op automatisk." };
  }

  return { error: null };
}

async function removeReplacedAdMedia(currentPath: string | null, nextPath: string | null) {
  if (!currentPath || currentPath === nextPath) return;
  if (/^https?:\/\//i.test(currentPath)) return;

  const supabase = createAdminClient();
  const { error } = await supabase.storage.from("media").remove([currentPath]);
  if (error) {
    console.warn("Old ad media could not be removed", {
      message: error.message,
      path: currentPath,
    });
  }
}

async function removeUploadedAdMedia(path: string | null) {
  if (!path || /^https?:\/\//i.test(path)) return;

  const supabase = createAdminClient();
  const { error } = await supabase.storage.from("media").remove([path]);
  if (error) {
    console.warn("Uploaded ad media could not be cleaned up", {
      message: error.message,
      path,
    });
  }
}

async function failAdSave(message: string, uploadedImagePath: string | null, uploadedMobileImagePath: string | null): Promise<never> {
  await Promise.all([removeUploadedAdMedia(uploadedImagePath), removeUploadedAdMedia(uploadedMobileImagePath)]);
  go(message);
}

export async function upsertAdAction(formData: FormData) {
  await requireRole("admin");

  const id = getOptionalString(formData, "id");
  const title = getString(formData, "title");
  const currentImagePath = getOptionalString(formData, "current_image_path") || getOptionalString(formData, "image_path");
  const currentMobileImagePath = getOptionalString(formData, "current_mobile_image_path") || getOptionalString(formData, "mobile_image_path");
  const uploadedImagePath = getOptionalString(formData, "uploaded_image_path");
  const uploadedMobileImagePath = getOptionalString(formData, "uploaded_mobile_image_path");
  const containsBinaryUpload = formContainsBinaryUpload(formData);
  const showOnHomepage = formData.get("show_on_homepage") === "on";
  const showOnCategoryPages = formData.get("show_on_category_pages") === "on";
  const categoryIds = formData.getAll("main_category_ids").map(String).filter(Boolean);
  const targetUrl = getOptionalString(formData, "target_url");
  const startsAt = dateValue(formData, "starts_at");
  const endsAt = dateValue(formData, "ends_at");

  if (!title) await failAdSave("Titel er påkrævet.", uploadedImagePath, uploadedMobileImagePath);
  if (containsBinaryUpload) {
    await failAdSave("Upload fejlede: filerne må ikke sendes direkte med formularen. Vælg filerne igen og prøv at gemme.", uploadedImagePath, uploadedMobileImagePath);
  }
  if (!isValidAdUrl(targetUrl)) {
    await failAdSave("Link skal starte med https:// eller være et internt link som /kontakt.", uploadedImagePath, uploadedMobileImagePath);
  }
  if (isInvalidDateRange(startsAt, endsAt)) {
    await failAdSave("Slutdato skal være efter startdato.", uploadedImagePath, uploadedMobileImagePath);
  }
  if (!showOnHomepage && !showOnCategoryPages) {
    await failAdSave("Vælg mindst én placering: forsiden eller hovedkategorisider.", uploadedImagePath, uploadedMobileImagePath);
  }
  if (showOnCategoryPages && categoryIds.length === 0) {
    await failAdSave("Vælg mindst én hovedkategori - kun fordi du har valgt, at reklamen også skal vises på hovedkategorisider.", uploadedImagePath, uploadedMobileImagePath);
  }

  const imagePath = formData.get("remove_image") === "on" ? null : getOptionalString(formData, "image_path");
  if (!imagePath) {
    await failAdSave("Desktopbanner er påkrævet. Upload et banner i 1600 x 600-format.", uploadedImagePath, uploadedMobileImagePath);
  }
  const mobileImagePath = formData.get("remove_mobile_image") === "on" ? null : getOptionalString(formData, "mobile_image_path");
  const supabase = createAdminClient();
  const payload = {
    title,
    image_path: imagePath,
    mobile_image_path: mobileImagePath,
    alt_text: getOptionalString(formData, "alt_text") || title,
    sponsor_name: getOptionalString(formData, "sponsor_name"),
    target_url: targetUrl,
    priority: numberFrom(formData, "priority", 100),
    display_seconds: 10,
    starts_at: startsAt,
    ends_at: endsAt,
    is_active: formData.get("is_active") === "on",
    show_on_category_pages: showOnCategoryPages,
    show_on_homepage: showOnHomepage,
    homepage_placement: homepagePlacementValue(formData),
    show_in_newsletter: formData.get("show_in_newsletter") === "on",
    show_title_on_banner: formData.get("show_title_on_banner") === "on",
    show_sponsor_on_banner: formData.get("show_sponsor_on_banner") === "on",
    admin_note: getOptionalString(formData, "admin_note"),
  };

  let savedMobileImagePath = true;
  let result = id
    ? await supabase.from("ads").update(payload).eq("id", id).select("id").single()
    : await supabase.from("ads").insert(payload).select("id").single();

  if (result.error) {
    console.error("Ad save failed", {
      code: result.error.code,
      details: result.error.details,
      hint: result.error.hint,
      message: result.error.message,
      payloadColumns: Object.keys(payload),
    });
  }

  if (result.error && isMissingOptionalAdColumnError(result.error)) {
    savedMobileImagePath = false;
    const retryPayload = legacyAdPayload(payload);
    result = id
      ? await supabase.from("ads").update(retryPayload).eq("id", id).select("id").single()
      : await supabase.from("ads").insert(retryPayload).select("id").single();

    if (result.error) {
      console.error("Ad legacy save failed", {
        code: result.error.code,
        details: result.error.details,
        hint: result.error.hint,
        message: result.error.message,
        payloadColumns: Object.keys(retryPayload),
      });
    }
  }

  if (result.error || !result.data) {
    await failAdSave("Reklamen kunne ikke gemmes. Tjek at database-migrationen er kørt.", uploadedImagePath, uploadedMobileImagePath);
  }

  const adId = result.data!.id;
  await supabase.from("ad_main_categories").delete().eq("ad_id", adId);
  if (showOnCategoryPages && categoryIds.length > 0) {
    const rows = categoryIds.map((mainCategoryId) => ({ ad_id: adId, main_category_id: mainCategoryId }));
    const { error } = await supabase.from("ad_main_categories").insert(rows);
    if (error) {
      go("Reklamen blev gemt, men kategorierne kunne ikke tilknyttes.");
    }
  }

  if (!savedMobileImagePath) {
    await removeUploadedAdMedia(uploadedMobileImagePath);
  }

  await Promise.all([
    removeReplacedAdMedia(currentImagePath || null, imagePath),
    savedMobileImagePath ? removeReplacedAdMedia(currentMobileImagePath || null, mobileImagePath) : Promise.resolve(),
  ]);

  revalidatePath("/admin/ads");
  revalidatePath("/");
  revalidatePath("/categories/[slug]", "page");
  go("Reklamen er gemt.");
}

export async function deleteAdAction(formData: FormData) {
  await requireRole("admin");

  const id = getString(formData, "id");
  if (!id) go("Reklamen mangler ID.");

  const supabase = createAdminClient();
  const { error } = await supabase.from("ads").delete().eq("id", id);
  if (error) go("Reklamen kunne ikke slettes.");

  revalidatePath("/admin/ads");
  revalidatePath("/");
  revalidatePath("/categories/[slug]", "page");
  go("Reklamen er slettet.");
}
