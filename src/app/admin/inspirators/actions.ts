"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { getOptionalString, getString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";

function go(message: string): never {
  redirect("/admin/inspirators?message=" + encodeURIComponent(message));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function numberFrom(formData: FormData, name: string, fallback: number) {
  const value = Number(formData.get(name));
  return Number.isFinite(value) ? value : fallback;
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

async function uploadImage(file: File, folder: string) {
  if (!file.type.startsWith("image/")) {
    go("Filen skal være et billede.");
  }
  if (file.size > 8 * 1024 * 1024) {
    go("Billedet er for stort. Vælg et billede under 8 MB.");
  }

  const safeName = file.name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);

  const imagePath = folder + "/" + Date.now() + "-" + (safeName || "inspirator") + "." + extensionFromFile(file);
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

async function imageFromForm(formData: FormData, name: string, currentPath: string | null, folder: string) {
  const remove = formData.get("remove_" + name) === "on";
  if (remove) return null;

  const file = formData.get(name);
  if (!(file instanceof File) || file.size === 0) return currentPath;
  return uploadImage(file, folder);
}

async function insertExtraImages(formData: FormData, inspiratorId: string, section: "mood" | "gallery") {
  const supabase = createAdminClient();
  const rows = [];
  const count = section === "mood" ? 8 : 8;

  for (let index = 1; index <= count; index += 1) {
    const file = formData.get(section + "_image_" + index);
    if (!(file instanceof File) || file.size === 0) continue;
    rows.push({
      inspirator_id: inspiratorId,
      section,
      image_path: await uploadImage(file, "inspirators/" + section),
      alt_text: getOptionalString(formData, section + "_alt_" + index),
      sort_order: index * 10,
    });
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("inspirator_images").insert(rows);
    if (error) go("Profilen blev gemt, men ekstra billeder kunne ikke gemmes.");
  }
}

export async function upsertInspiratorAction(formData: FormData) {
  await requireRole("admin");

  const id = getOptionalString(formData, "id");
  const name = getString(formData, "name");
  const currentProfileImagePath = getOptionalString(formData, "profile_image_path");
  const currentHeroImagePath = getOptionalString(formData, "hero_image_path");

  if (!name) go("Navn er påkrævet.");

  const slug = slugify(getOptionalString(formData, "slug") || name);
  if (!slug) go("Webadresse kunne ikke dannes. Prøv et andet navn.");

  const profileImagePath = await imageFromForm(formData, "profile_image", currentProfileImagePath, "inspirators/profile");
  const heroImagePath = await imageFromForm(formData, "hero_image", currentHeroImagePath, "inspirators/hero");

  const payload = {
    slug,
    name,
    title: getOptionalString(formData, "title"),
    short_intro: getOptionalString(formData, "short_intro"),
    profile_image_path: profileImagePath,
    hero_image_path: heroImagePath,
    about_body: getOptionalString(formData, "about_body"),
    category: getOptionalString(formData, "category"),
    contact_email: getOptionalString(formData, "contact_email"),
    website_url: getOptionalString(formData, "website_url"),
    instagram_url: getOptionalString(formData, "instagram_url"),
    facebook_url: getOptionalString(formData, "facebook_url"),
    youtube_url: getOptionalString(formData, "youtube_url"),
    spotify_url: getOptionalString(formData, "spotify_url"),
    webshop_url: getOptionalString(formData, "webshop_url"),
    is_active: formData.get("is_active") === "on",
    sort_order: numberFrom(formData, "sort_order", 100),
    updated_at: new Date().toISOString(),
  };

  const supabase = createAdminClient();
  const result = id
    ? await supabase.from("inspirator_profiles").update(payload).eq("id", id).select("id").single()
    : await supabase.from("inspirator_profiles").insert(payload).select("id").single();

  if (result.error || !result.data) {
    go("Inspiratorprofilen kunne ikke gemmes. Tjek om webadressen allerede findes, og om migrationen er kørt.");
  }

  await insertExtraImages(formData, result.data.id, "mood");
  await insertExtraImages(formData, result.data.id, "gallery");

  revalidatePath("/admin/inspirators");
  revalidatePath("/inspiration");
  revalidatePath("/inspiration/[slug]", "page");
  go("Inspiratorprofilen er gemt.");
}

export async function deleteInspiratorImageAction(formData: FormData) {
  await requireRole("admin");
  const id = getString(formData, "id");
  if (!id) go("Billedet mangler ID.");

  const supabase = createAdminClient();
  const { error } = await supabase.from("inspirator_images").delete().eq("id", id);
  if (error) go("Billedet kunne ikke slettes.");

  revalidatePath("/admin/inspirators");
  revalidatePath("/inspiration");
  revalidatePath("/inspiration/[slug]", "page");
  go("Billedet er slettet.");
}

export async function archiveInspiratorAction(formData: FormData) {
  await requireRole("admin");
  const id = getString(formData, "id");
  if (!id) go("Profilen mangler ID.");

  const supabase = createAdminClient();
  const { error } = await supabase.from("inspirator_profiles").update({ is_active: false }).eq("id", id);
  if (error) go("Profilen kunne ikke skjules.");

  revalidatePath("/admin/inspirators");
  revalidatePath("/inspiration");
  revalidatePath("/inspiration/[slug]", "page");
  go("Inspiratorprofilen er skjult.");
}
