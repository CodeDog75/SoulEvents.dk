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

function homepagePlacementValue(formData: FormData) {
  const value = getOptionalString(formData, "homepage_placement");
  return value === "middle" ? "middle" : "bottom";
}

function isMissingHomepagePlacementError(error: { message?: string; details?: string; code?: string } | null | undefined) {
  const text = [error?.message, error?.details, error?.code].filter(Boolean).join(" ").toLowerCase();
  return text.includes("homepage_placement") || text.includes("schema cache");
}

function extensionFromFile(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp", "mp4"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "video/mp4") return "mp4";
  return "jpg";
}

function isAllowedAdMedia(file: File) {
  return file.type.startsWith("image/") || file.type === "video/mp4";
}

async function uploadAdMedia(formData: FormData, currentImagePath: string | null) {
  const removeImage = formData.get("remove_image") === "on";
  if (removeImage) return null;

  const file = formData.get("image_file");
  if (!(file instanceof File) || file.size === 0) return currentImagePath;

  if (!isAllowedAdMedia(file)) {
    go("Filen skal være et billede eller en MP4-video.");
  }

  const maxSize = file.type === "video/mp4" ? 30 * 1024 * 1024 : 8 * 1024 * 1024;
  if (file.size > maxSize) {
    go(file.type === "video/mp4" ? "Videoen er for stor. Vælg en MP4 under 30 MB." : "Billedet er for stort. Vælg et billede under 8 MB.");
  }

  const safeName = file.name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);

  const imagePath = "ads/" + Date.now() + "-" + (safeName || "partner") + "." + extensionFromFile(file);
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from("media").upload(imagePath, file, {
    cacheControl: "31536000",
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    go("Filen kunne ikke uploades. Tjek at media-bucket findes i Supabase.");
  }

  return imagePath;
}

export async function upsertAdAction(formData: FormData) {
  await requireRole("admin");

  const id = getOptionalString(formData, "id");
  const title = getString(formData, "title");
  const currentImagePath = getOptionalString(formData, "image_path");
  const showOnHomepage = formData.get("show_on_homepage") === "on";
  const showOnCategoryPages = formData.get("show_on_category_pages") === "on";
  const categoryIds = formData.getAll("main_category_ids").map(String).filter(Boolean);

  if (!title) go("Titel er påkrævet.");
  if (!showOnHomepage && !showOnCategoryPages) {
    go("Vælg mindst én placering: forsiden eller hovedkategorisider.");
  }
  if (showOnCategoryPages && categoryIds.length === 0) {
    go("Vælg mindst én hovedkategori - kun fordi du har valgt, at reklamen også skal vises på hovedkategorisider.");
  }

  const imagePath = await uploadAdMedia(formData, currentImagePath || null);
  const supabase = createAdminClient();
  const payload = {
    title,
    image_path: imagePath,
    alt_text: getOptionalString(formData, "alt_text") || title,
    sponsor_name: getOptionalString(formData, "sponsor_name"),
    target_url: getOptionalString(formData, "target_url"),
    priority: numberFrom(formData, "priority", 100),
    display_seconds: 10,
    starts_at: dateValue(formData, "starts_at"),
    ends_at: dateValue(formData, "ends_at"),
    is_active: formData.get("is_active") === "on",
    show_on_category_pages: showOnCategoryPages,
    show_on_homepage: showOnHomepage,
    homepage_placement: homepagePlacementValue(formData),
    show_in_newsletter: formData.get("show_in_newsletter") === "on",
    show_title_on_banner: formData.get("show_title_on_banner") === "on",
    show_sponsor_on_banner: formData.get("show_sponsor_on_banner") === "on",
    admin_note: getOptionalString(formData, "admin_note"),
  };

  let result = id
    ? await supabase.from("ads").update(payload).eq("id", id).select("id").single()
    : await supabase.from("ads").insert(payload).select("id").single();

  if (result.error && isMissingHomepagePlacementError(result.error)) {
    const legacyPayload: Partial<typeof payload> = { ...payload };
    delete legacyPayload.homepage_placement;
    result = id
      ? await supabase.from("ads").update(legacyPayload).eq("id", id).select("id").single()
      : await supabase.from("ads").insert(legacyPayload).select("id").single();
  }

  if (result.error || !result.data) {
    go("Reklamen kunne ikke gemmes. Tjek at database-migrationen er kørt.");
  }

  const adId = result.data.id;
  await supabase.from("ad_main_categories").delete().eq("ad_id", adId);
  if (showOnCategoryPages && categoryIds.length > 0) {
    const rows = categoryIds.map((mainCategoryId) => ({ ad_id: adId, main_category_id: mainCategoryId }));
    const { error } = await supabase.from("ad_main_categories").insert(rows);
    if (error) go("Reklamen blev gemt, men kategorierne kunne ikke tilknyttes.");
  }

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
