"use client";

import { useEffect, useState, useTransition } from "react";
import { cleanupAdMediaUploadsAction, createSignedAdUploadAction, upsertAdAction } from "@/app/admin/ads/actions";
import { createClient } from "@/lib/supabase/browser";

type UploadState = {
  desktop: string;
  error: string;
  mobile: string;
};

const maxAdImageBytes = 20 * 1024 * 1024;
const maxAdVideoBytes = 100 * 1024 * 1024;

function adUploadDebug(step: string, details?: Record<string, unknown>) {
  console.info("[ad-upload-debug] " + new Date().toISOString() + " " + step, details ?? {});
}

function formatMb(bytes: number) {
  return (bytes / 1024 / 1024).toLocaleString("da-DK", { maximumFractionDigits: 1 });
}

function fileExtension(file: File) {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

function validateFile(file: File) {
  const extension = fileExtension(file);
  const isVideo = file.type === "video/mp4" && extension === "mp4";
  const isImage = ["image/png", "image/jpeg", "image/webp"].includes(file.type) && ["png", "jpg", "jpeg", "webp"].includes(extension);

  if (!isVideo && !isImage) {
    return "Filen skal være PNG, JPG, WebP eller MP4.";
  }

  const maxSize = isVideo ? maxAdVideoBytes : maxAdImageBytes;
  if (file.size > maxSize) {
    return isVideo
      ? "Videoen er for stor. Den må højst fylde 100 MB. Den valgte fil fylder " + formatMb(file.size) + " MB."
      : "Billedet er for stort. Det må højst fylde 20 MB. Den valgte fil fylder " + formatMb(file.size) + " MB.";
  }

  return null;
}

function inputFor(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name);
  return field instanceof HTMLInputElement ? field : null;
}

function fileInputFor(form: HTMLFormElement, slot: "desktop" | "mobile") {
  return form.querySelector<HTMLInputElement>('input[data-ad-file-input="' + slot + '"]');
}

async function uploadFile(input: {
  file: File;
  setStatus: (message: string) => void;
  slot: "desktop" | "mobile";
}) {
  const validationError = validateFile(input.file);
  if (validationError) {
    throw new Error(validationError);
  }

  adUploadDebug("upload starts", {
    fileSize: input.file.size,
    fileType: input.file.type,
    slot: input.slot,
  });
  input.setStatus("Klargør upload...");
  const signedUpload = await createSignedAdUploadAction({
    contentType: input.file.type,
    fileName: input.file.name,
    size: input.file.size,
    slot: input.slot,
  });

  if (signedUpload.error || !signedUpload.path || !signedUpload.token) {
    throw new Error(signedUpload.error || "Upload kunne ikke startes.");
  }

  input.setStatus("Uploader " + formatMb(input.file.size) + " MB...");
  const supabase = createClient();
  const { error } = await supabase.storage.from("media").uploadToSignedUrl(signedUpload.path, signedUpload.token, input.file, {
    cacheControl: "31536000",
    contentType: signedUpload.contentType ?? input.file.type,
  });

  if (error) {
    throw new Error("Upload fejlede: " + error.message);
  }

  adUploadDebug("upload ends", {
    path: signedUpload.path,
    slot: input.slot,
  });
  input.setStatus("Upload færdig.");
  return signedUpload.path;
}

export function AdDirectUploadController({ formId }: { formId: string }) {
  const [state, setState] = useState<UploadState>({ desktop: "", error: "", mobile: "" });
  const [, startTransition] = useTransition();

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return undefined;
    const submitButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('button[type="submit"][form="' + formId + '"]'));

    const onSubmitButtonClick = () => {
      adUploadDebug("submit button clicked", { formId });
    };

    const saveAfterValidation = async () => {
      const desktopFileInput = fileInputFor(form, "desktop");
      const mobileFileInput = fileInputFor(form, "mobile");
      const desktopPathInput = inputFor(form, "image_path");
      const mobilePathInput = inputFor(form, "mobile_image_path");
      const uploadedDesktopInput = inputFor(form, "uploaded_image_path");
      const uploadedMobileInput = inputFor(form, "uploaded_mobile_image_path");
      const removeDesktopInput = inputFor(form, "remove_image");
      const removeMobileInput = inputFor(form, "remove_mobile_image");
      const desktopFile = desktopFileInput?.files?.[0] ?? null;
      const mobileFile = mobileFileInput?.files?.[0] ?? null;

      adUploadDebug("direct upload controller starts", { formId });
      adUploadDebug("direct upload decision", {
        hasDesktopFile: Boolean(desktopFile),
        hasMobileFile: Boolean(mobileFile),
      });

      setState({ desktop: "", error: "", mobile: "" });

      const uploadedPaths: string[] = [];

      try {
        if (!desktopFile && !mobileFile) {
          adUploadDebug("no new files selected - calling upsertAdAction directly", { formId });
        }

        if (desktopFile) {
          const path = await uploadFile({
            file: desktopFile,
            setStatus: (desktop) => setState((current) => ({ ...current, desktop })),
            slot: "desktop",
          });
          uploadedPaths.push(path);
          if (desktopPathInput) desktopPathInput.value = path;
          if (uploadedDesktopInput) uploadedDesktopInput.value = path;
          if (removeDesktopInput) removeDesktopInput.checked = false;
        }

        if (mobileFile) {
          const path = await uploadFile({
            file: mobileFile,
            setStatus: (mobile) => setState((current) => ({ ...current, mobile })),
            slot: "mobile",
          });
          uploadedPaths.push(path);
          if (mobilePathInput) mobilePathInput.value = path;
          if (uploadedMobileInput) uploadedMobileInput.value = path;
          if (removeMobileInput) removeMobileInput.checked = false;
        }

        if (desktopFileInput) desktopFileInput.value = "";
        if (mobileFileInput) mobileFileInput.value = "";

        setState((current) => ({
          ...current,
          desktop: desktopFile ? "Upload færdig. Gemmer reklame..." : current.desktop,
          mobile: mobileFile ? "Upload færdig. Gemmer reklame..." : current.mobile,
        }));

        const finalFormData = new FormData(form);
        finalFormData.delete("image_file");
        finalFormData.delete("mobile_image_file");

        adUploadDebug("upsertAdAction called from direct upload controller", {
          hasDesktopPath: Boolean(finalFormData.get("image_path")),
          hasMobilePath: Boolean(finalFormData.get("mobile_image_path")),
        });
        startTransition(() => {
          void upsertAdAction(finalFormData);
        });
      } catch (error) {
        if (uploadedPaths.length > 0) {
          await cleanupAdMediaUploadsAction(uploadedPaths);
        }
        form.dispatchEvent(new CustomEvent("ad-direct-upload-error"));
        setState((current) => ({
          ...current,
          error: error instanceof Error ? error.message : "Upload fejlede. Prøv igen.",
        }));
      }
    };

    const onSubmit = (event: SubmitEvent) => {
      adUploadDebug("direct upload controller saw submit event", {
        defaultPrevented: event.defaultPrevented,
        formId,
      });
    };

    const onValidationApproved = (event: Event) => {
      event.preventDefault();
      void saveAfterValidation();
    };

    submitButtons.forEach((button) => button.addEventListener("click", onSubmitButtonClick));
    form.addEventListener("submit", onSubmit);
    form.addEventListener("ad-category-guard-approved", onValidationApproved);
    return () => {
      submitButtons.forEach((button) => button.removeEventListener("click", onSubmitButtonClick));
      form.removeEventListener("submit", onSubmit);
      form.removeEventListener("ad-category-guard-approved", onValidationApproved);
    };
  }, [formId, startTransition]);

  if (!state.desktop && !state.mobile && !state.error) return null;

  return (
    <div className="mt-4 grid gap-2 rounded-md border border-midnight/10 bg-white px-4 py-3 text-sm">
      {state.desktop && <p className="font-semibold text-sage-700">Desktop: {state.desktop}</p>}
      {state.mobile && <p className="font-semibold text-sage-700">Mobil: {state.mobile}</p>}
      {state.error && <p className="font-semibold text-terracotta">{state.error}</p>}
    </div>
  );
}
