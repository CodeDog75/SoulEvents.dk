"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  becomeOrganizerImageFields,
  becomeOrganizerPageSettingKey,
  defaultBecomeOrganizerPageContent,
  getBecomeOrganizerSection,
  parseBecomeOrganizerPageContent,
  siteContentBucketName,
  type BecomeOrganizerCta,
  type BecomeOrganizerImageKey,
  type BecomeOrganizerPageContent,
  type BecomeOrganizerSection,
} from "@/lib/become-organizer-page-content";
import { requireRole } from "@/lib/auth/roles";
import { getOptionalString, getString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";

function go(message: string): never {
  redirect("/admin/content/bliv-arrangoer?message=" + encodeURIComponent(message));
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

async function ensureSiteContentBucket(supabase: ReturnType<typeof createAdminClient>) {
  const { data: bucket } = await supabase.storage.getBucket(siteContentBucketName);

  if (bucket) return null;

  const { error } = await supabase.storage.createBucket(siteContentBucketName, {
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    fileSizeLimit: 10 * 1024 * 1024,
    public: true,
  });

  if (error && !error.message.toLowerCase().includes("already exists")) {
    console.error("Become organizer site-content bucket setup failed", { error: error.message });
    return "Site-content-bucketten kunne ikke klargøres. Kør storage-migrationen og prøv igen.";
  }

  return null;
}

async function uploadBecomeOrganizerImage(file: FormDataEntryValue | null, key: BecomeOrganizerImageKey, currentPath: string | null) {
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
  const bucketError = await ensureSiteContentBucket(supabase);

  if (bucketError) {
    return { error: bucketError, path: currentPath };
  }

  const imagePath = "become-organizer/" + key + "/" + Date.now() + "-" + (safeName(file) || "billede") + "." + extension;

  let uploadError: string | null = null;
  try {
    const { error } = await supabase.storage.from(siteContentBucketName).upload(imagePath, file, {
      cacheControl: "31536000",
      contentType: imageContentType(extension, file.type),
      upsert: false,
    });

    uploadError = error?.message ?? null;
  } catch (error) {
    uploadError = error instanceof Error ? error.message : "Ukendt uploadfejl";
  }

  if (uploadError) {
    console.error("Become organizer image upload failed", { error: uploadError, imagePath, key });
    return { error: "Billedet kunne ikke uploades. Tjek at filen er JPG, PNG eller WEBP under 10 MB.", path: currentPath };
  }

  return { path: imagePath };
}

function checked(formData: FormData, key: string, fallback: boolean) {
  const values = formData.getAll(key);
  return values.length > 0 ? values.some((value) => value === "1") : fallback;
}

function cta(formData: FormData, prefix: string, fallback: BecomeOrganizerCta) {
  return {
    label: getString(formData, `${prefix}Label`) || fallback.label,
    href: getOptionalString(formData, `${prefix}Href`) || fallback.href,
  };
}

function benefits(formData: FormData, fallback: Extract<BecomeOrganizerSection, { type: "benefits" }>["items"]) {
  const items = Array.from({ length: 8 }, (_, index) => ({
    title: getString(formData, `benefit${index}Title`),
    text: getString(formData, `benefit${index}Text`),
  })).filter((item) => item.title || item.text);

  return items.length > 0 ? items : fallback;
}

function faqItems(formData: FormData, fallback: Extract<BecomeOrganizerSection, { type: "faq" }>["items"]) {
  const items = Array.from({ length: 8 }, (_, index) => ({
    question: getString(formData, `faq${index}Question`),
    answer: getString(formData, `faq${index}Answer`),
  })).filter((item) => item.question || item.answer);

  return items.length > 0 ? items : fallback;
}

function fallbackSection<T extends BecomeOrganizerSection["type"]>(id: string, type: T) {
  return getBecomeOrganizerSection(defaultBecomeOrganizerPageContent, id, type);
}

function currentSection<T extends BecomeOrganizerSection["type"]>(content: BecomeOrganizerPageContent, id: string, type: T) {
  return getBecomeOrganizerSection(content, id, type) ?? fallbackSection(id, type);
}

export async function updateBecomeOrganizerPageContentAction(formData: FormData) {
  await requireRole("admin");

  const supabase = createAdminClient();
  const { data: currentSetting } = await supabase.from("site_settings").select("value").eq("key", becomeOrganizerPageSettingKey).maybeSingle();
  const currentContent = parseBecomeOrganizerPageContent(currentSetting?.value);

  const currentHero = currentSection(currentContent, "hero", "hero");
  const currentIntroText = currentSection(currentContent, "intro-text", "text");
  const currentIntroImage = currentSection(currentContent, "intro-image", "image");
  const currentBenefits = currentSection(currentContent, "benefits", "benefits");
  const currentVideo = currentSection(currentContent, "video", "video");
  const currentFaq = currentSection(currentContent, "faq", "faq");
  const currentCta = currentSection(currentContent, "final-cta", "cta");

  if (!currentHero || !currentIntroText || !currentIntroImage || !currentBenefits || !currentVideo || !currentFaq || !currentCta) {
    go("Landingssiden kunne ikke indlæses korrekt. Prøv igen.");
  }

  const heroImagePath = getOptionalString(formData, "heroImagePath") || currentHero.image.path;
  const introImagePath = getOptionalString(formData, "introImagePath") || currentIntroImage.image.path;
  const ctaImagePath = getOptionalString(formData, "ctaImagePath") || currentCta.image.path;
  const imageErrors: string[] = [];

  const uploadedImages = {
    hero: await uploadBecomeOrganizerImage(
      formData.get("heroImageFile"),
      "hero",
      getString(formData, "heroImageDelete") === "1" ? null : heroImagePath,
    ),
    intro: await uploadBecomeOrganizerImage(
      formData.get("introImageFile"),
      "intro",
      getString(formData, "introImageDelete") === "1" ? null : introImagePath,
    ),
    cta: await uploadBecomeOrganizerImage(
      formData.get("ctaImageFile"),
      "cta",
      getString(formData, "ctaImageDelete") === "1" ? null : ctaImagePath,
    ),
  };

  for (const imageField of becomeOrganizerImageFields) {
    const upload = uploadedImages[imageField.key];
    if (upload.error) {
      imageErrors.push(`${imageField.label}: ${upload.error}`);
    }
  }

  const content: BecomeOrganizerPageContent = {
    seoTitle: getString(formData, "seoTitle") || defaultBecomeOrganizerPageContent.seoTitle,
    seoDescription: getString(formData, "seoDescription") || defaultBecomeOrganizerPageContent.seoDescription,
    sections: [
      {
        id: "hero",
        type: "hero",
        isEnabled: checked(formData, "heroIsEnabled", currentHero.isEnabled),
        eyebrow: getString(formData, "heroEyebrow") || currentHero.eyebrow,
        title: getString(formData, "heroTitle") || currentHero.title,
        text: getString(formData, "heroText"),
        primaryCta: cta(formData, "heroPrimaryCta", currentHero.primaryCta),
        secondaryCta: cta(formData, "heroSecondaryCta", currentHero.secondaryCta),
        image: {
          alt: getString(formData, "heroImageAlt") || currentHero.image.alt,
          path: uploadedImages.hero.path,
        },
      },
      {
        id: "intro-text",
        type: "text",
        isEnabled: checked(formData, "introTextIsEnabled", currentIntroText.isEnabled),
        eyebrow: getString(formData, "introTextEyebrow") || currentIntroText.eyebrow,
        title: getString(formData, "introTextTitle") || currentIntroText.title,
        text: getString(formData, "introTextText"),
      },
      {
        id: "intro-image",
        type: "image",
        isEnabled: checked(formData, "introImageIsEnabled", currentIntroImage.isEnabled),
        eyebrow: getString(formData, "introImageEyebrow") || currentIntroImage.eyebrow,
        title: getString(formData, "introImageTitle") || currentIntroImage.title,
        text: getString(formData, "introImageText"),
        image: {
          alt: getString(formData, "introImageAlt") || currentIntroImage.image.alt,
          path: uploadedImages.intro.path,
        },
        imagePosition: getString(formData, "introImagePosition") === "left" ? "left" : "right",
      },
      {
        id: "benefits",
        type: "benefits",
        isEnabled: checked(formData, "benefitsIsEnabled", currentBenefits.isEnabled),
        eyebrow: getString(formData, "benefitsEyebrow") || currentBenefits.eyebrow,
        title: getString(formData, "benefitsTitle") || currentBenefits.title,
        text: getString(formData, "benefitsText"),
        items: benefits(formData, currentBenefits.items),
      },
      {
        id: "video",
        type: "video",
        isEnabled: checked(formData, "videoIsEnabled", currentVideo.isEnabled),
        eyebrow: getString(formData, "videoEyebrow") || currentVideo.eyebrow,
        title: getString(formData, "videoTitle") || currentVideo.title,
        text: getString(formData, "videoText"),
        videoUrl: getOptionalString(formData, "videoUrl") || "",
      },
      {
        id: "faq",
        type: "faq",
        isEnabled: checked(formData, "faqIsEnabled", currentFaq.isEnabled),
        eyebrow: getString(formData, "faqEyebrow") || currentFaq.eyebrow,
        title: getString(formData, "faqTitle") || currentFaq.title,
        items: faqItems(formData, currentFaq.items),
      },
      {
        id: "final-cta",
        type: "cta",
        isEnabled: checked(formData, "ctaIsEnabled", currentCta.isEnabled),
        eyebrow: getString(formData, "ctaEyebrow") || currentCta.eyebrow,
        title: getString(formData, "ctaTitle") || currentCta.title,
        text: getString(formData, "ctaText"),
        primaryCta: cta(formData, "ctaPrimaryCta", currentCta.primaryCta),
        secondaryCta: cta(formData, "ctaSecondaryCta", currentCta.secondaryCta),
        image: {
          alt: getString(formData, "ctaImageAlt") || currentCta.image.alt,
          path: uploadedImages.cta.path,
        },
      },
    ],
  };

  const { error } = await supabase.from("site_settings").upsert(
    {
      key: becomeOrganizerPageSettingKey,
      value: JSON.stringify(content),
    },
    { onConflict: "key" },
  );

  if (error) {
    console.error("Become organizer page content save failed", { error: error.message });
    go("Landingssiden kunne ikke gemmes. Prøv igen.");
  }

  revalidatePath("/bliv-arrangoer");
  revalidatePath("/admin/content/bliv-arrangoer");

  if (imageErrors.length > 0) {
    go("Tekster og gyldige billeder er gemt. " + imageErrors.join(" "));
  }

  go("Bliv arrangør-siden er gemt.");
}
