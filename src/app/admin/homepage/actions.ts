"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { brandLogoSettingKey, mediaBucketName } from "@/lib/brand-logo";
import { requireRole } from "@/lib/auth/roles";
import { getOptionalString, getString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";

function go(message: string): never {
  redirect("/admin/homepage?message=" + encodeURIComponent(message));
}

function logoGo(message: string): never {
  redirect("/admin/homepage?logo_message=" + encodeURIComponent(message) + "#logo");
}

function heroGo(message: string): never {
  redirect("/admin/homepage?message=" + encodeURIComponent(message) + "#hero-images");
}

function reflectionGo(message: string): never {
  redirect("/admin/homepage?reflection_message=" + encodeURIComponent(message) + "#weekly-reflection");
}

const weeklyReflectionGradientValues = new Set([
  "gradient:lavender-cream",
  "gradient:sage-sand",
  "gradient:dusty-purple-beige",
  "gradient:warm-grey-cream",
]);

type SupabaseErrorDetails = {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message?: string | null;
};

function copenhagenDateInputValue(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Copenhagen",
    year: "numeric",
  }).format(date);
}

function logSupabaseError(context: string, error: SupabaseErrorDetails, extra: Record<string, unknown> = {}) {
  console.error(context, {
    code: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
    message: error.message ?? null,
    ...extra,
  });
}

function isMissingWeeklyReflectionImageColumns(error: SupabaseErrorDetails | null) {
  if (!error) return false;
  const message = error.message ?? "";
  return error.code === "42703" || message.includes("weekly_reflections.image_path") || message.includes("image_path") || message.includes("image_alt_text");
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

function logoExtensionFromFile(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp", "svg"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }

  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/svg+xml") return "svg";
  if (file.type === "image/jpeg") return "jpg";
  return null;
}

function imageContentType(extension: string, fallback: string) {
  if (fallback && fallback !== "application/octet-stream") {
    return fallback;
  }

  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

function logoContentType(extension: string, fallback: string) {
  if (extension === "svg") return "image/svg+xml";
  return imageContentType(extension, fallback);
}

function safeFileName(file: File, fallback: string) {
  return (
    file.name
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || fallback
  );
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

  const extension = logoExtensionFromFile(file);
  const isAllowedType = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"].includes(file.type);
  const isAllowedExtension = extension !== null;

  if (!isAllowedType && !isAllowedExtension) {
    logoGo("Logoet skal være SVG, PNG, JPG eller WEBP.");
  }

  if (!extension) {
    logoGo("Logoet skal have en gyldig filtype.");
  }

  if (file.size > 4 * 1024 * 1024) {
    logoGo("Logoet er for stort. Vælg en fil under 4 MB.");
  }

  const supabase = createAdminClient();
  const logoPath = "brand/" + Date.now() + "-" + safeFileName(file, "logo") + "." + extension;

  const { error } = await supabase.storage.from(mediaBucketName).upload(logoPath, file, {
    cacheControl: "31536000",
    contentType: logoContentType(extension, file.type),
    upsert: false,
  });

  if (error) {
    logSupabaseError("Site logo upload failed", error, { logoPath });
    logoGo("Logoet kunne ikke uploades. Tjek at media-bucket findes og tillader SVG, PNG, JPG og WEBP.");
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

async function uploadHeroImage(formData: FormData, currentImagePath: string | null, scope: string) {
  const file = formData.get("hero_image");
  if (!(file instanceof File) || file.size === 0) {
    return currentImagePath;
  }

  const extension = extensionFromFile(file);
  const isAllowedType = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  const isAllowedExtension = ["jpg", "jpeg", "png", "webp"].includes(extension);

  if (!isAllowedType && !isAllowedExtension) {
    heroGo("Hero-billedet skal være JPG, PNG eller WEBP.");
  }

  if (file.size > 10 * 1024 * 1024) {
    heroGo("Hero-billedet er for stort. Vælg et billede under 10 MB.");
  }

  const supabase = createAdminClient();
  const safeName = file.name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  const imagePath = "hero/" + scope + "/" + Date.now() + "-" + (safeName || "hero") + "." + extension;

  const { error } = await supabase.storage.from("media").upload(imagePath, file, {
    cacheControl: "31536000",
    contentType: imageContentType(extension, file.type),
    upsert: false,
  });

  if (error) {
    console.error("Hero image upload failed", { error, imagePath, scope });
    heroGo("Hero-billedet kunne ikke uploades. Tjek at media-bucket findes i Supabase.");
  }

  return imagePath;
}

async function uploadWeeklyReflectionImage(formData: FormData, currentImagePath: string | null) {
  const removeImage = formData.get("remove_reflection_image") === "on";
  if (removeImage) {
    return null;
  }

  const file = formData.get("reflection_image_file");
  if (!(file instanceof File) || file.size === 0) {
    return currentImagePath;
  }

  const extension = extensionFromFile(file);
  const isAllowedType = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  const isAllowedExtension = ["jpg", "jpeg", "png", "webp"].includes(extension);

  if (!isAllowedType && !isAllowedExtension) {
    reflectionGo("Refleksionsbilledet skal være JPG, PNG eller WEBP. HEIC konverteres i browseren før gem.");
  }

  if (file.size > 10 * 1024 * 1024) {
    reflectionGo("Refleksionsbilledet er for stort. Vælg et billede under 10 MB.");
  }

  const supabase = createAdminClient();
  const imagePath = "weekly-reflections/" + Date.now() + "-" + safeFileName(file, "refleksion") + "." + extension;

  const { error } = await supabase.storage.from("media").upload(imagePath, file, {
    cacheControl: "31536000",
    contentType: imageContentType(extension, file.type),
    upsert: false,
  });

  if (error) {
    logSupabaseError("Weekly reflection image upload failed", error, { imagePath });
    reflectionGo("Refleksionsbilledet kunne ikke uploades. Tjek at media-bucket findes i Supabase.");
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
    .upsert({ key: brandLogoSettingKey, value: logoPath }, { onConflict: "key" });

  if (error) {
    logoGo("Logoet kunne ikke gemmes. Kør database-migrationen til site_settings først.");
  }

  revalidatePath("/");
  revalidatePath("/admin/homepage");
  logoGo("Logoet er gemt.");
}

export async function upsertHeroImageAction(formData: FormData) {
  await requireRole("admin");

  const id = getOptionalString(formData, "id");
  const scope = getString(formData, "scope") === "main_category" ? "main_category" : "homepage";
  const mainCategoryId = scope === "main_category" ? getString(formData, "main_category_id") : null;
  const currentImagePath = getOptionalString(formData, "image_path");
  const imagePath = await uploadHeroImage(formData, currentImagePath || null, scope);

  if (scope === "main_category" && !mainCategoryId) {
    heroGo("Vælg en hovedkategori til hero-billedet.");
  }

  if (!imagePath) {
    heroGo("Upload et hero-billede først.");
  }

  const supabase = createAdminClient();

  if (!id && scope === "homepage") {
    const { count, error: countError } = await supabase
      .from("hero_images")
      .select("id", { count: "exact", head: true })
      .eq("scope", "homepage");

    if (countError) {
      console.error("Hero image count failed", { error: countError });
      heroGo("Hero-billeder mangler databaseopsætning. Kør migrationen til hero_images i Supabase først.");
    }

    if ((count ?? 0) >= 5) {
      heroGo("Du kan have op til 5 hero-billeder på forsiden. Slet et eksisterende billede, før du uploader et nyt.");
    }
  }

  const payload = {
    scope,
    main_category_id: mainCategoryId,
    image_path: imagePath,
    alt_text: getOptionalString(formData, "alt_text"),
    is_active: formData.get("is_active") === "on",
    sort_order: sortOrder(formData),
  };

  const result = id
    ? await supabase.from("hero_images").update(payload).eq("id", id)
    : await supabase.from("hero_images").insert(payload);

  if (result.error) {
    console.error("Hero image database save failed", {
      error: result.error,
      id,
      imagePath,
      mainCategoryId,
      scope,
    });
    heroGo("Hero-billedet kunne ikke gemmes. Tjek at database-migrationen er kørt.");
  }

  revalidatePath("/");
  revalidatePath("/admin/homepage");
  revalidatePath("/categories/[slug]", "page");
  heroGo("Hero-billedet er gemt.");
}

export async function deleteHeroImageAction(formData: FormData) {
  await requireRole("admin");

  const id = getString(formData, "id");
  if (!id) {
    heroGo("Hero-billedet mangler ID.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("hero_images").delete().eq("id", id);

  if (error) {
    heroGo("Hero-billedet kunne ikke slettes.");
  }

  revalidatePath("/");
  revalidatePath("/admin/homepage");
  revalidatePath("/categories/[slug]", "page");
  heroGo("Hero-billedet er slettet.");
}

export async function useHomepageHeroImageAction(formData: FormData) {
  await requireRole("admin");

  const id = getString(formData, "id");
  if (!id) {
    heroGo("Hero-billedet mangler ID.");
  }

  const supabase = createAdminClient();
  const { error: deactivateError } = await supabase
    .from("hero_images")
    .update({ is_active: false })
    .eq("scope", "homepage");

  if (deactivateError) {
    console.error("Hero image homepage deactivate failed", { error: deactivateError, id });
    heroGo("Forsidebillederne kunne ikke opdateres.");
  }

  const { error: activateError } = await supabase
    .from("hero_images")
    .update({ is_active: true })
    .eq("id", id)
    .eq("scope", "homepage");

  if (activateError) {
    console.error("Hero image homepage activate failed", { error: activateError, id });
    heroGo("Hero-billedet kunne ikke vælges som forsidebillede.");
  }

  revalidatePath("/");
  revalidatePath("/admin/homepage");
  heroGo("Hero-billedet vises nu på forsiden.");
}

export async function upsertWeeklyReflectionAction(formData: FormData) {
  await requireRole("admin");

  const id = getOptionalString(formData, "id");
  const title = getString(formData, "title") || "Ugens refleksion";
  const reflectionText = getString(formData, "reflection_text");
  const author = getOptionalString(formData, "author");
  const backgroundMode = getString(formData, "background_mode");
  const solidBackgroundColor = getString(formData, "background_color") || "#FAF6EF";
  const gradientBackgroundColor = getString(formData, "background_gradient");
  const backgroundColor = backgroundMode === "gradient" ? gradientBackgroundColor : solidBackgroundColor;
  const isActive = formData.get("is_active") === "on";
  const startDate = getOptionalString(formData, "start_date") ?? copenhagenDateInputValue();
  const endDate = getOptionalString(formData, "end_date");
  const imageAltText = getOptionalString(formData, "reflection_image_alt_text");

  if (!reflectionText) {
    reflectionGo("Skriv en refleksionstekst først.");
  }

  if (backgroundMode === "gradient" && !weeklyReflectionGradientValues.has(backgroundColor)) {
    reflectionGo("Vælg en gyldig gradient.");
  }

  if (backgroundMode !== "gradient" && !/^#[0-9A-Fa-f]{6}$/.test(backgroundColor)) {
    reflectionGo("Vælg en gyldig baggrundsfarve.");
  }

  if (startDate && endDate && endDate < startDate) {
    reflectionGo("Slutdato skal ligge efter startdato.");
  }

  const supabase = createAdminClient();
  let currentImagePath = getOptionalString(formData, "reflection_image_path");

  if (id) {
    const { data: currentReflection, error: currentReflectionError } = await supabase
      .from("weekly_reflections")
      .select("image_path")
      .eq("id", id)
      .maybeSingle();

    if (currentReflectionError) {
      logSupabaseError("Weekly reflection current image lookup failed", currentReflectionError, { id });
      if (isMissingWeeklyReflectionImageColumns(currentReflectionError)) {
        reflectionGo("Billedfelterne mangler i databasen. Kør migration 053_weekly_reflection_image.sql og prøv igen.");
      }
      reflectionGo("Refleksionen kunne ikke hentes før gem.");
    }

    currentImagePath = currentReflection?.image_path ?? currentImagePath;
  }

  const nextImagePath = await uploadWeeklyReflectionImage(formData, currentImagePath);

  if (isActive) {
    const { error: deactivateError } = await supabase
      .from("weekly_reflections")
      .update({ is_active: false })
      .neq("id", id ?? "00000000-0000-0000-0000-000000000000");

    if (deactivateError) {
      logSupabaseError("Weekly reflection deactivate failed", deactivateError, { id });
      reflectionGo("Refleksionen kunne ikke aktiveres. Tjek at migrationen er kørt.");
    }
  }

  const payload = {
    title,
    reflection_text: reflectionText,
    author,
    background_color: backgroundColor,
    image_alt_text: imageAltText,
    image_path: nextImagePath,
    is_active: isActive,
    start_date: startDate,
    end_date: endDate,
  };

  const result = id
    ? await supabase.from("weekly_reflections").update(payload).eq("id", id)
    : await supabase.from("weekly_reflections").insert(payload);

  if (result.error) {
    logSupabaseError("Weekly reflection save failed", result.error, { id });
    if (nextImagePath && nextImagePath !== currentImagePath) {
      await supabase.storage.from("media").remove([nextImagePath]);
    }
    if (isMissingWeeklyReflectionImageColumns(result.error)) {
      reflectionGo("Billedfelterne mangler i databasen. Kør migration 053_weekly_reflection_image.sql og prøv igen.");
    }
    reflectionGo("Refleksionen kunne ikke gemmes. Kør migrationen til weekly_reflections i Supabase først.");
  }

  if (currentImagePath && currentImagePath !== nextImagePath) {
    const { error: removeError } = await supabase.storage.from("media").remove([currentImagePath]);
    if (removeError) {
      logSupabaseError("Old weekly reflection image cleanup failed", removeError, { currentImagePath });
    }
  }

  revalidatePath("/");
  revalidatePath("/admin/homepage");
  reflectionGo("Ugens refleksion er gemt.");
}
