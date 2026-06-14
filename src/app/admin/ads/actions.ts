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

function extensionFromFile(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

async function uploadAdImage(formData: FormData, currentImagePath: string | null) {
  const removeImage = formData.get("remove_image") === "on";
  if (removeImage) return null;

  const file = formData.get("image_file");
  if (!(file instanceof File) || file.size === 0) return currentImagePath;

  if (!file.type.startsWith("image/")) {
    go("Billedet skal være en billedfil.");
  }

  if (file.size > 8 * 1024 * 1024) {
    go("Billedet er for stort. Vælg et billede under 8 MB.");
  }

  const safeName = file.name
    .replace(/.[^.]+$/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);

  const imagePath = "ads/" + Date.now() + "-" + (safeName || "partner") + "." + extensionFromFile(file);
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from("media").upload(imagePath, file, {
    cacheControl: "31536000",
    contentType: file.type || "image/jpeg",
    upsert: false,
  });

  if (error) {
    go("Billedet kunne ikke uploades. Tjek at media-bucket findes i Supabase.");
  }

  return imagePath;
}

export async function upsertAdAction(formData: FormData) {
  await requireRole("admin");

  const id = getOptionalString(formData, "id");
  const title = getString(formData, "title");
  const currentImagePath = getOptionalString(formData, "image_path");
  const categoryIds = formData.getAll("main_category_ids").map(String).filter(Boolean);

  if (!title) go("Titel er påkrævet.");
  if (formData.get("show_on_category_pages") === "on" && categoryIds.length === 0) {
    go("Vælg mindst én hovedkategori, hvis reklamen skal vises på hovedkategorisider.");
  }

  const imagePath = await uploadAdImage(formData, currentImagePath || null);
  const supabase = createAdminClient();
  const payload = {
    title,
    image_path: imagePath,
    alt_text: getOptionalString(formData, "alt_text") || title,
    sponsor_name: getOptionalString(formData, "sponsor_name"),
    target_url: getOptionalString(formData, "target_url"),
    priority: numberFrom(formData, "priority", 100),
    display_seconds: Math.min(Math.max(numberFrom(formData, "display_seconds", 10), 6), 30),
    starts_at: dateValue(formData, "starts_at"),
    ends_at: dateValue(formData, "ends_at"),
    is_active: formData.get("is_active") === "on",
    show_on_category_pages: formData.get("show_on_category_pages") === "on",
    show_in_newsletter: formData.get("show_in_newsletter") === "on",
    admin_note: getOptionalString(formData, "admin_note"),
  };

  const result = id
    ? await supabase.from("ads").update(payload).eq("id", id).select("id").single()
    : await supabase.from("ads").insert(payload).select("id").single();

  if (result.error || !result.data) {
    go("Reklamen kunne ikke gemmes. Tjek at database-migrationen er kørt.");
  }

  const adId = result.data.id;
  await supabase.from("ad_main_categories").delete().eq("ad_id", adId);
  if (categoryIds.length > 0) {
    const rows = categoryIds.map((mainCategoryId) => ({ ad_id: adId, main_category_id: mainCategoryId }));
    const { error } = await supabase.from("ad_main_categories").insert(rows);
    if (error) go("Reklamen blev gemt, men kategorierne kunne ikke tilknyttes.");
  }

  revalidatePath("/admin/ads");
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
  revalidatePath("/categories/[slug]", "page");
  go("Reklamen er slettet.");
}
