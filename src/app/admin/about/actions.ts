"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  aboutImageFields,
  aboutPageSettingKey,
  cloneAboutImages,
  defaultAboutPageContent,
  parseAboutPageContent,
  type AboutImageKey,
  type AboutPageContent,
} from "@/lib/about-page-content";
import { requireRole } from "@/lib/auth/roles";
import { getOptionalString, getString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";

function go(message: string): never {
  redirect("/admin/about?message=" + encodeURIComponent(message));
}

function extensionFromFile(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }

  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return null;
}

function imageContentType(extension: string, fallback: string) {
  if (["image/jpeg", "image/png", "image/webp"].includes(fallback)) {
    return fallback;
  }

  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

function safeName(file: File) {
  return file.name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

async function ensureMediaBucket(supabase: ReturnType<typeof createAdminClient>) {
  const { data: bucket } = await supabase.storage.getBucket("media");

  if (bucket) {
    return null;
  }

  const { error } = await supabase.storage.createBucket("media", {
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    fileSizeLimit: 10 * 1024 * 1024,
    public: true,
  });

  if (error && !error.message.toLowerCase().includes("already exists")) {
    console.error("About page media bucket setup failed", { error: error.message });
    return "Media-bucketten kunne ikke klargøres.";
  }

  return null;
}

async function uploadAboutImage(file: FormDataEntryValue | null, key: AboutImageKey, currentPath: string | null) {
  if (!(file instanceof File) || file.size === 0) {
    return { path: currentPath };
  }

  const extension = extensionFromFile(file);

  if (!extension) {
    return { error: "Vælg et billede i JPG, PNG eller WEBP.", path: currentPath };
  }

  if (file.size > 10 * 1024 * 1024) {
    return { error: "Billedet er for stort. Vælg et billede under 10 MB.", path: currentPath };
  }

  const supabase = createAdminClient();
  const bucketError = await ensureMediaBucket(supabase);

  if (bucketError) {
    return { error: bucketError, path: currentPath };
  }

  const imagePath = "about/" + key + "/" + Date.now() + "-" + (safeName(file) || "billede") + "." + extension;

  let uploadError: string | null = null;
  try {
    const { error } = await supabase.storage.from("media").upload(imagePath, file, {
      cacheControl: "31536000",
      contentType: imageContentType(extension, file.type),
      upsert: false,
    });

    uploadError = error?.message ?? null;
  } catch (error) {
    uploadError = error instanceof Error ? error.message : "Ukendt uploadfejl";
  }

  if (uploadError) {
    console.error("About page image upload failed", { error: uploadError, imagePath, key });
    return { error: "Billedet kunne ikke uploades. Tjek at filen er JPG, PNG eller WEBP under 10 MB.", path: currentPath };
  }

  return { path: imagePath };
}

function text(formData: FormData, key: keyof Omit<AboutPageContent, "images">) {
  return getString(formData, key);
}

export async function updateAboutPageContentAction(formData: FormData) {
  await requireRole("admin");

  const supabase = createAdminClient();
  const { data: currentSetting } = await supabase.from("site_settings").select("value").eq("key", aboutPageSettingKey).maybeSingle();
  const currentContent = parseAboutPageContent(currentSetting?.value);

  const content: AboutPageContent = {
    headline: text(formData, "headline") || defaultAboutPageContent.headline,
    introduction: text(formData, "introduction") || defaultAboutPageContent.introduction,
    whyTitle: text(formData, "whyTitle") || defaultAboutPageContent.whyTitle,
    whyText: text(formData, "whyText"),
    visionTitle: text(formData, "visionTitle") || defaultAboutPageContent.visionTitle,
    visionText: text(formData, "visionText"),
    storyTitle: text(formData, "storyTitle") || defaultAboutPageContent.storyTitle,
    storyText: text(formData, "storyText"),
    howTitle: text(formData, "howTitle") || defaultAboutPageContent.howTitle,
    howText: text(formData, "howText"),
    valuesTitle: text(formData, "valuesTitle") || defaultAboutPageContent.valuesTitle,
    valuesText: text(formData, "valuesText"),
    ctaTitle: text(formData, "ctaTitle") || defaultAboutPageContent.ctaTitle,
    ctaText: text(formData, "ctaText"),
    ctaButtonText: text(formData, "ctaButtonText") || defaultAboutPageContent.ctaButtonText,
    ctaButtonLink: getOptionalString(formData, "ctaButtonLink") || defaultAboutPageContent.ctaButtonLink,
    images: cloneAboutImages(currentContent.images),
  };

  const imageErrors: string[] = [];

  for (const imageField of aboutImageFields) {
    const key = imageField.key;
    const currentPath = getOptionalString(formData, `${key}ImagePath`) || currentContent.images[key].path;
    const upload = await uploadAboutImage(formData.get(`${key}ImageFile`), key, currentPath);

    if (upload.error) {
      imageErrors.push(`${imageField.label}: ${upload.error}`);
    }

    content.images[key] = {
      alt: getOptionalString(formData, `${key}ImageAlt`) || currentContent.images[key].alt,
      path: upload.path,
    };
  }

  const { error } = await supabase.from("site_settings").upsert(
    {
      key: aboutPageSettingKey,
      value: JSON.stringify(content),
    },
    { onConflict: "key" },
  );

  if (error) {
    console.error("About page content save failed", { error: error.message });
    go("Om SoulEvents kunne ikke gemmes. Prøv igen.");
  }

  revalidatePath("/about");
  revalidatePath("/admin/about");

  if (imageErrors.length > 0) {
    go("Tekster og gyldige billeder er gemt. " + imageErrors.join(" "));
  }

  go("Om SoulEvents er gemt.");
}
