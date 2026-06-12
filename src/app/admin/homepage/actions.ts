"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { getOptionalString, getString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";

function go(message: string): never {
  redirect("/admin/homepage?message=" + encodeURIComponent(message));
}

function logoGo(message: string): never {
  redirect("/admin/homepage?logo_message=" + encodeURIComponent(message) + "#logo");
}

function sortOrder(formData: FormData) {
  const value = Number(getString(formData, "sort_order"));
  return Number.isFinite(value) ? value : 0;
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

async function uploadSiteLogo(formData: FormData, currentLogoPath: string | null) {
  const removeLogo = formData.get("remove_logo") === "on";
  if (removeLogo) {
    return null;
  }

  const file = formData.get("logo_file");
  if (!(file instanceof File) || file.size === 0) {
    return currentLogoPath;
  }

  if (!file.type.startsWith("image/") && file.type !== "image/svg+xml") {
    logoGo("Logoet skal være en billedfil.");
  }

  if (file.size > 4 * 1024 * 1024) {
    logoGo("Logoet er for stort. Vælg en fil under 4 MB.");
  }

  const supabase = createAdminClient();
  const extension = extensionFromFile(file);
  const logoPath = "brand/" + Date.now() + "-logo." + extension;

  const { error } = await supabase.storage.from("media").upload(logoPath, file, {
    cacheControl: "31536000",
    contentType: file.type || "image/png",
    upsert: false,
  });

  if (error) {
    logoGo("Logoet kunne ikke uploades. Tjek at media-bucket findes i Supabase.");
  }

  return logoPath;
}

async function uploadHomepageImage(formData: FormData, currentImagePath: string | null) {
  const removeImage = formData.get("remove_image") === "on";
  if (removeImage) {
    return null;
  }

  const file = formData.get("image_file");
  if (!(file instanceof File) || file.size === 0) {
    return currentImagePath;
  }

  if (!file.type.startsWith("image/")) {
    go("Billedet skal være en billedfil.");
  }

  if (file.size > 8 * 1024 * 1024) {
    go("Billedet er for stort. Vælg et billede under 8 MB.");
  }

  const supabase = createAdminClient();
  const extension = extensionFromFile(file);
  const safeName = file.name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  const imagePath = "homepage/" + Date.now() + "-" + (safeName || "forsideboks") + "." + extension;

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

export async function upsertHomepageTileAction(formData: FormData) {
  await requireRole("admin");

  const id = getOptionalString(formData, "id");
  const title = getString(formData, "title");
  const description = getOptionalString(formData, "description");
  const currentImagePath = getOptionalString(formData, "image_path");
  const href = getString(formData, "href") || "/#events";
  const tileType = getString(formData, "tile_type") || "navigation";
  const isActive = formData.get("is_active") === "on";

  if (!title) {
    go("Titel er påkrævet.");
  }

  const imagePath = await uploadHomepageImage(formData, currentImagePath || null);
  const supabase = createAdminClient();
  const payload = {
    title,
    description,
    image_path: imagePath,
    href,
    tile_type: tileType,
    is_active: isActive,
    sort_order: sortOrder(formData),
  };

  const result = id
    ? await supabase.from("homepage_tiles").update(payload).eq("id", id)
    : await supabase.from("homepage_tiles").insert(payload);

  if (result.error) {
    go("Boksen kunne ikke gemmes. Tjek at database-migrationen er kørt.");
  }

  revalidatePath("/");
  revalidatePath("/admin/homepage");
  go("Boksen er gemt.");
}

export async function deleteHomepageTileAction(formData: FormData) {
  await requireRole("admin");

  const id = getString(formData, "id");
  if (!id) {
    go("Boksen mangler ID.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("homepage_tiles").delete().eq("id", id);

  if (error) {
    go("Boksen kunne ikke slettes.");
  }

  revalidatePath("/");
  revalidatePath("/admin/homepage");
  go("Boksen er slettet.");
}


export async function updateSiteLogoAction(formData: FormData) {
  await requireRole("admin");

  const currentLogoPath = getOptionalString(formData, "current_logo_path");
  const logoPath = await uploadSiteLogo(formData, currentLogoPath || null);
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "brand_logo_path", value: logoPath }, { onConflict: "key" });

  if (error) {
    logoGo("Logoet kunne ikke gemmes. Kør database-migrationen til site_settings først.");
  }

  revalidatePath("/");
  revalidatePath("/admin/homepage");
  logoGo("Logoet er gemt.");
}
