"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { eventGalleryContentTypeFromPath, eventGalleryFileExtension, eventGalleryFileExtensionFromMetadata, validateEventGalleryFile, validateEventGalleryFileMetadata } from "@/lib/events/gallery-media";
import { getOptionalString, getString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureMediaStorageBucket } from "@/lib/supabase/storage-buckets";

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
  return eventGalleryFileExtension(file) ?? "jpg";
}

function safeName(value: string) {
  return value
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function inspiratorMediaPath(section: "mood" | "gallery", input: { fileName: string; type?: string | null }) {
  const extension = eventGalleryFileExtensionFromMetadata(input) ?? "jpg";
  return "inspirators/" + section + "/" + Date.now() + "-" + crypto.randomUUID() + "-" + (safeName(input.fileName) || "inspirator") + "." + extension;
}

function validInspiratorMediaPath(path: string | null, section: "mood" | "gallery") {
  if (!path || /^https?:\/\//i.test(path)) return "";
  if (!path.startsWith("inspirators/" + section + "/")) return "";
  if (!eventGalleryFileExtensionFromMetadata({ fileName: path })) return "";
  return path;
}

async function uploadImage(file: File, folder: string) {
  const extension = extensionFromFile(file);
  if (!["jpg", "png", "webp", "heic", "heif"].includes(extension)) {
    go("Filen skal være et billede.");
  }
  const validationError = validateEventGalleryFile(file);
  if (validationError) {
    go(validationError);
  }
  return uploadMedia(file, folder);
}

async function uploadMedia(file: File, folder: string) {
  const validationError = validateEventGalleryFile(file);
  if (validationError) {
    go(validationError);
  }
  const imagePath = folder + "/" + Date.now() + "-" + (safeName(file.name) || "inspirator") + "." + extensionFromFile(file);
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from("media").upload(imagePath, file, {
    cacheControl: "31536000",
    contentType: eventGalleryContentTypeFromPath(imagePath),
    upsert: false,
  });

  if (error) {
    go("Mediet kunne ikke uploades. Tjek at media-bucket findes i Supabase.");
  }

  return imagePath;
}

export async function createSignedInspiratorMediaUploadAction(input: {
  contentType: string;
  fileName: string;
  section: "mood" | "gallery";
  size: number;
}) {
  await requireRole("admin");

  const section = input.section === "gallery" ? "gallery" : "mood";
  const metadata = {
    fileName: input.fileName,
    size: Number(input.size),
    type: input.contentType,
  };
  const validationError = validateEventGalleryFileMetadata(metadata);

  if (validationError) {
    return { contentType: null, error: validationError, path: null, token: null };
  }

  const imagePath = inspiratorMediaPath(section, metadata);
  const contentType = eventGalleryContentTypeFromPath(imagePath);
  const supabase = createAdminClient();
  const bucketError = await ensureMediaStorageBucket(supabase);

  if (bucketError) {
    console.error("Inspirator media bucket setup error", {
      message: bucketError.message,
      path: imagePath,
      size: metadata.size,
      type: metadata.type,
    });
    return { contentType: null, error: "Media-bucketten kunne ikke klargøres. Kør storage-migrationen og prøv igen.", path: null, token: null };
  }

  const { data, error } = await supabase.storage.from("media").createSignedUploadUrl(imagePath, {
    upsert: false,
  });

  if (error) {
    console.error("Signed inspirator media upload URL could not be created", {
      message: error.message,
      path: imagePath,
      size: metadata.size,
      type: metadata.type,
    });
    return { contentType: null, error: "Upload kunne ikke startes: " + error.message, path: null, token: null };
  }

  return {
    contentType,
    error: null,
    path: data.path,
    token: data.token,
  };
}

async function imageFromForm(formData: FormData, name: string, currentPath: string | null, folder: string) {
  const remove = formData.get("remove_" + name) === "on";
  if (remove) return null;

  const file = formData.get(name);
  if (!(file instanceof File) || file.size === 0) return currentPath;
  return uploadImage(file, folder);
}

async function syncExtraMediaSlots(formData: FormData, inspiratorId: string, section: "mood" | "gallery") {
  const supabase = createAdminClient();
  const submittedIds = new Set<string>();
  const count = 4;

  for (let index = 1; index <= count; index += 1) {
    const imageId = getOptionalString(formData, section + "_image_id_" + index);
    const uploadedPathValue = getOptionalString(formData, section + "_image_path_" + index);
    const uploadedPath = uploadedPathValue ? validInspiratorMediaPath(uploadedPathValue, section) : "";
    if (uploadedPathValue && !uploadedPath) {
      go("Mediets storage-sti er ugyldig.");
    }
    const file = formData.get(section + "_image_" + index);
    const hasNewFile = file instanceof File && file.size > 0;
    const altText = getOptionalString(formData, section + "_alt_" + index);
    const sortOrder = index * 10;

    if (!imageId && !hasNewFile && !uploadedPath) continue;

    if (imageId) {
      submittedIds.add(imageId);
      const payload: { alt_text: string | null; image_path?: string; sort_order: number } = {
        alt_text: altText,
        sort_order: sortOrder,
      };

      if (hasNewFile) {
        payload.image_path = await uploadMedia(file, "inspirators/" + section);
      } else if (uploadedPath) {
        payload.image_path = uploadedPath;
      }

      const { error } = await supabase
        .from("inspirator_images")
        .update(payload)
        .eq("id", imageId)
        .eq("inspirator_id", inspiratorId)
        .eq("section", section);

      if (error) go("Profilen blev gemt, men medierne kunne ikke opdateres.");
      continue;
    }

    if (hasNewFile || uploadedPath) {
      const imagePath = uploadedPath || (file instanceof File ? await uploadMedia(file, "inspirators/" + section) : "");
      if (!imagePath) continue;

      const { data, error } = await supabase.from("inspirator_images").insert({
        inspirator_id: inspiratorId,
        section,
        image_path: imagePath,
        alt_text: altText,
        sort_order: sortOrder,
      }).select("id").single();

      if (error) go("Profilen blev gemt, men mediet kunne ikke gemmes.");
      if (data?.id) submittedIds.add(data.id);
    }
  }

  const deleteQuery = supabase
    .from("inspirator_images")
    .delete()
    .eq("inspirator_id", inspiratorId)
    .eq("section", section);
  const { error: deleteError } = submittedIds.size > 0
    ? await deleteQuery.not("id", "in", "(" + Array.from(submittedIds).join(",") + ")")
    : await deleteQuery;

  if (deleteError) {
    go("Profilen blev gemt, men fjernede medier kunne ikke slettes.");
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

  await syncExtraMediaSlots(formData, result.data.id, "mood");
  await syncExtraMediaSlots(formData, result.data.id, "gallery");

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
