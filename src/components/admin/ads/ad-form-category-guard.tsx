"use client";

import { useEffect, useState } from "react";

type AdFormCategoryGuardProps = {
  formId: string;
};

const maxAdImageBytes = 20 * 1024 * 1024;
const maxAdVideoBytes = 100 * 1024 * 1024;
const minDesktopImageWidth = 2400;
const minDesktopImageHeight = 900;
const minMobileImageWidth = 1200;
const minMobileImageHeight = 1200;

function formatMegabytes(bytes: number) {
  return (bytes / (1024 * 1024)).toLocaleString("da-DK", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
}

function extensionFromFile(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp", "mp4"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "video/mp4") return "mp4";
  return null;
}

async function hasExpectedSignature(file: File, extension: string) {
  const header = new Uint8Array(await file.slice(0, 32).arrayBuffer());

  if (extension === "jpg") {
    return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  }

  if (extension === "png") {
    return header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
  }

  if (extension === "webp") {
    const text = new TextDecoder().decode(header);
    return text.startsWith("RIFF") && text.slice(8, 12) === "WEBP";
  }

  if (extension === "mp4") {
    const text = new TextDecoder().decode(header);
    return text.slice(4, 8) === "ftyp";
  }

  return false;
}

function imageDimensions(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Billedet kunne ikke åbnes."));
    };
    image.src = objectUrl;
  });
}

async function validateAdFile(file: File, prefix: "desktop" | "mobile") {
  const extension = extensionFromFile(file);

  if (!extension) {
    return "Filen skal være JPG, PNG, WEBP eller MP4.";
  }

  const isVideo = extension === "mp4";
  const maxSize = isVideo ? maxAdVideoBytes : maxAdImageBytes;

  if (file.size > maxSize) {
    return isVideo
      ? `Videoen er for stor. Den må højst fylde 100 MB. Den valgte fil fylder ${formatMegabytes(file.size)} MB.`
      : `Billedet er for stort. Det må højst fylde 20 MB. Den valgte fil fylder ${formatMegabytes(file.size)} MB.`;
  }

  if (!(await hasExpectedSignature(file, extension))) {
    return isVideo ? "Filen hedder MP4, men ligner ikke en gyldig MP4-video." : "Filen matcher ikke det valgte billedformat.";
  }

  if (!isVideo) {
    try {
      const dimensions = await imageDimensions(file);
      const minWidth = prefix === "desktop" ? minDesktopImageWidth : minMobileImageWidth;
      const minHeight = prefix === "desktop" ? minDesktopImageHeight : minMobileImageHeight;

      if (dimensions.width < minWidth || dimensions.height < minHeight) {
        return prefix === "desktop"
          ? `Desktopbanneret er for lille. Upload mindst ${minWidth} × ${minHeight} px. Den valgte fil er ${dimensions.width} × ${dimensions.height} px.`
          : `Mobilbanneret er for lille. Upload mindst ${minWidth} × ${minHeight} px. Den valgte fil er ${dimensions.width} × ${dimensions.height} px.`;
      }
    } catch {
      return "Billedet kunne ikke åbnes. Vælg en ny JPG, PNG eller WEBP-fil.";
    }
  }

  return null;
}

export function AdFormCategoryGuard({ formId }: AdFormCategoryGuardProps) {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    let isResubmitting = false;
    const showOnCategoryPages = form.querySelector<HTMLInputElement>('input[name="show_on_category_pages"]');
    const categoriesSection = form.querySelector<HTMLElement>("[data-ad-categories-section]");

    function syncCategoryVisibility() {
      const shouldShow = Boolean(showOnCategoryPages?.checked);
      if (categoriesSection) {
        categoriesSection.hidden = !shouldShow;
      }
    }

    syncCategoryVisibility();
    showOnCategoryPages?.addEventListener("change", syncCategoryVisibility);

    async function validate(event: SubmitEvent) {
      if (isResubmitting) {
        isResubmitting = false;
        return;
      }

      const showOnHomepage = form?.querySelector<HTMLInputElement>('input[name="show_on_homepage"]');
      const checkedCategories = form?.querySelectorAll<HTMLInputElement>('input[name="main_category_ids"]:checked');
      const currentDesktopPath = form?.querySelector<HTMLInputElement>('input[name="image_path"]')?.value.trim();
      const desktopFileInput = form?.querySelector<HTMLInputElement>('input[data-ad-file-input="desktop"]');
      const mobileFileInput = form?.querySelector<HTMLInputElement>('input[data-ad-file-input="mobile"]');
      const desktopFile = desktopFileInput?.files?.[0];
      const mobileFile = mobileFileInput?.files?.[0];
      const removeDesktop = form?.querySelector<HTMLInputElement>('input[name="remove_image"]')?.checked;
      const targetUrl = form?.querySelector<HTMLInputElement>('input[name="target_url"]')?.value.trim();
      const startsAt = form?.querySelector<HTMLInputElement>('input[name="starts_at"]')?.value;
      const endsAt = form?.querySelector<HTMLInputElement>('input[name="ends_at"]')?.value;
      const title = form?.querySelector<HTMLInputElement>('input[name="title"]')?.value.trim();

      if (!title) {
        event.preventDefault();
        setMessage("Titel er påkrævet.");
        form?.closest("details")?.setAttribute("open", "");
        form?.querySelector<HTMLInputElement>('input[name="title"]')?.focus();
        return;
      }

      if ((!currentDesktopPath || removeDesktop) && !desktopFile) {
        event.preventDefault();
        setMessage("Desktopbanner er påkrævet. Upload et banner i 1600 x 600-format.");
        form?.closest("details")?.setAttribute("open", "");
        form?.querySelector('[data-ad-media-section="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      if (targetUrl && !/^https?:\/\//i.test(targetUrl) && !/^\/(?!\/)/.test(targetUrl)) {
        event.preventDefault();
        setMessage("Link skal starte med https:// eller være et internt link som /kontakt.");
        form?.closest("details")?.setAttribute("open", "");
        form?.querySelector<HTMLInputElement>('input[name="target_url"]')?.focus();
        return;
      }

      if (startsAt && endsAt && endsAt < startsAt) {
        event.preventDefault();
        setMessage("Slutdato skal være efter startdato.");
        form?.closest("details")?.setAttribute("open", "");
        form?.querySelector<HTMLInputElement>('input[name="ends_at"]')?.focus();
        return;
      }

      if (!showOnHomepage?.checked && !showOnCategoryPages?.checked) {
        event.preventDefault();
        setMessage("Vælg mindst én placering: forsiden eller hovedkategorisider.");
        form?.closest("details")?.setAttribute("open", "");
        form?.querySelector('[data-ad-category-error="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      if (showOnCategoryPages?.checked && (!checkedCategories || checkedCategories.length === 0)) {
        event.preventDefault();
        setMessage("Vælg mindst én hovedkategori - kun fordi du har valgt, at reklamen også skal vises på hovedkategorisider.");
        form?.closest("details")?.setAttribute("open", "");
        form?.querySelector('[data-ad-category-error="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      event.preventDefault();

      if (desktopFile) {
        const validationError = await validateAdFile(desktopFile, "desktop");
        if (validationError) {
          setMessage(validationError);
          form?.closest("details")?.setAttribute("open", "");
          form?.querySelector('[data-ad-media-section="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
      }

      if (mobileFile) {
        const validationError = await validateAdFile(mobileFile, "mobile");
        if (validationError) {
          setMessage(validationError);
          form?.closest("details")?.setAttribute("open", "");
          form?.querySelector('[data-ad-media-section="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
      }

      setIsSubmitting(true);
      setMessage("Gemmer reklame...");
      isResubmitting = true;
      form?.requestSubmit();
    }

    const handleSubmit = (event: SubmitEvent) => void validate(event);
    form.addEventListener("submit", handleSubmit);
    return () => {
      form.removeEventListener("submit", handleSubmit);
      showOnCategoryPages?.removeEventListener("change", syncCategoryVisibility);
    };
  }, [formId]);

  if (!message && !isSubmitting) return null;

  return (
    <div
      className="mb-5 rounded-md border border-[#E5D4F7] bg-[#F7F2FB] px-4 py-3 text-sm font-semibold text-[#7A4EAB]"
      data-ad-category-error="true"
      role="alert"
    >
      {isSubmitting ? "Gemmer reklame..." : message}
    </div>
  );
}
