"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { getOptionalString, getString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";

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

function detectedExtensionFromFile(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp", "mp4"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "video/mp4") return "mp4";
  return null;
}

function extensionFromFile(file: File) {
  return detectedExtensionFromFile(file) ?? "jpg";
}

function isAllowedAdMedia(file: File) {
  const extension = detectedExtensionFromFile(file);
  return file.type.startsWith("image/") || file.type === "video/mp4" || extension === "mp4";
}

function adMediaContentType(file: File) {
  const extension = extensionFromFile(file);

  if (extension === "mp4") return "video/mp4";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return file.type && file.type.startsWith("image/") ? file.type : "image/jpeg";
}

async function uploadAdMedia(
  formData: FormData,
  currentImagePath: string | null,
  {
    fileField,
    removeField,
    pathPrefix,
  }: {
    fileField: string;
    removeField: string;
    pathPrefix: string;
  },
) {
  const removeImage = formData.get(removeField) === "on";
  if (removeImage) return { path: null, uploadedPath: null, error: null };

  const file = formData.get(fileField);
  if (!(file instanceof File) || file.size === 0) return { path: currentImagePath, uploadedPath: null, error: null };

  if (!isAllowedAdMedia(file)) {
    return { path: currentImagePath, uploadedPath: null, error: "Filen skal være et billede eller en MP4-video." };
  }

  const isVideo = extensionFromFile(file) === "mp4";
  const maxSize = isVideo ? 30 * 1024 * 1024 : 8 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      path: currentImagePath,
      uploadedPath: null,
      error: isVideo ? "Videoen er for stor. Vælg en MP4 under 30 MB." : "Billedet er for stort. Vælg et billede under 8 MB.",
    };
  }

  const safeName = file.name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);

  const imagePath = "ads/" + pathPrefix + "-" + Date.now() + "-" + (safeName || "partner") + "." + extensionFromFile(file);
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from("media").upload(imagePath, file, {
    cacheControl: "31536000",
    contentType: adMediaContentType(file),
    upsert: false,
  });

  if (error) {
    console.error("Ad media upload failed", {
      message: error.message,
      path: imagePath,
      type: file.type || "unknown",
      size: file.size,
    });
    return { path: currentImagePath, uploadedPath: null, error: "Filen kunne ikke uploades. Tjek at media-bucket findes i Supabase." };
  }

  return { path: imagePath, uploadedPath: imagePath, error: null };
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

export async function upsertAdAction(formData: FormData) {
  await requireRole("admin");

  const id = getOptionalString(formData, "id");
  const title = getString(formData, "title");
  const currentImagePath = getOptionalString(formData, "image_path");
  const currentMobileImagePath = getOptionalString(formData, "mobile_image_path");
  const showOnHomepage = formData.get("show_on_homepage") === "on";
  const showOnCategoryPages = formData.get("show_on_category_pages") === "on";
  const categoryIds = formData.getAll("main_category_ids").map(String).filter(Boolean);
  const targetUrl = getOptionalString(formData, "target_url");
  const startsAt = dateValue(formData, "starts_at");
  const endsAt = dateValue(formData, "ends_at");

  if (!title) go("Titel er påkrævet.");
  if (!isValidAdUrl(targetUrl)) {
    go("Link skal starte med https:// eller være et internt link som /kontakt.");
  }
  if (isInvalidDateRange(startsAt, endsAt)) {
    go("Slutdato skal være efter startdato.");
  }
  if (!showOnHomepage && !showOnCategoryPages) {
    go("Vælg mindst én placering: forsiden eller hovedkategorisider.");
  }
  if (showOnCategoryPages && categoryIds.length === 0) {
    go("Vælg mindst én hovedkategori - kun fordi du har valgt, at reklamen også skal vises på hovedkategorisider.");
  }

  const desktopUpload = await uploadAdMedia(formData, currentImagePath || null, {
    fileField: "image_file",
    removeField: "remove_image",
    pathPrefix: "desktop",
  });
  if (desktopUpload.error) {
    go(desktopUpload.error);
  }
  const imagePath = desktopUpload.path;
  if (!imagePath) {
    go("Desktopbanner er påkrævet. Upload et banner i 1600 x 600-format.");
  }
  const mobileUpload = await uploadAdMedia(formData, currentMobileImagePath || null, {
    fileField: "mobile_image_file",
    removeField: "remove_mobile_image",
    pathPrefix: "mobile",
  });
  if (mobileUpload.error) {
    await removeUploadedAdMedia(desktopUpload.uploadedPath);
    go(mobileUpload.error);
  }
  const mobileImagePath = mobileUpload.path;
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
    await Promise.all([removeUploadedAdMedia(desktopUpload.uploadedPath), removeUploadedAdMedia(mobileUpload.uploadedPath)]);
    go("Reklamen kunne ikke gemmes. Tjek at database-migrationen er kørt.");
  }

  const adId = result.data.id;
  await supabase.from("ad_main_categories").delete().eq("ad_id", adId);
  if (showOnCategoryPages && categoryIds.length > 0) {
    const rows = categoryIds.map((mainCategoryId) => ({ ad_id: adId, main_category_id: mainCategoryId }));
    const { error } = await supabase.from("ad_main_categories").insert(rows);
    if (error) {
      go("Reklamen blev gemt, men kategorierne kunne ikke tilknyttes.");
    }
  }

  if (!savedMobileImagePath) {
    await removeUploadedAdMedia(mobileUpload.uploadedPath);
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
