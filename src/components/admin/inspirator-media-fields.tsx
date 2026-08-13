"use client";

import { ArrowLeft, ArrowRight, ImagePlus, MonitorSmartphone, Play, Trash2 } from "lucide-react";
import type { ChangeEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { createSignedInspiratorMediaUploadAction } from "@/app/admin/inspirators/actions";
import {
  eventGalleryUploadAccept,
  isEventGalleryVideoFile,
  isEventGalleryVideoPath,
  maxEventGalleryImageFileSize,
  normalizeEventGalleryVideoFile,
  supportedEventGalleryUploadText,
  validateEventGalleryFile,
} from "@/lib/events/gallery-media";
import { imageUploadAccept, prepareImageFileForUpload, replaceInputFile } from "@/lib/images/client-image-upload";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/browser";

type ExtraMediaSlot = {
  caption: string;
  id: string;
  imageId?: string;
  isUploading?: boolean;
  previewUrl: string;
  type: "image" | "video";
  uploadedPath: string;
};

export type InspiratorInitialMedia = {
  altText: string | null;
  id: string;
  imagePath: string;
  previewUrl: string;
  type: "image" | "video";
};

type ImageUploadFieldProps = {
  currentPath?: string | null;
  currentUrl?: string | null;
  label: string;
  name: string;
};

type InspiratorExtraMediaFieldsProps = {
  group: "mood" | "gallery";
  initialMedia?: InspiratorInitialMedia[];
  title: string;
};

function createInitialSlots(initialMedia: InspiratorInitialMedia[] = []) {
  const slots = Array.from({ length: 4 }, () => null) as Array<ExtraMediaSlot | null>;

  initialMedia.slice(0, 4).forEach((media, index) => {
    slots[index] = {
      caption: media.altText ?? "",
      id: media.id,
      imageId: media.id,
      previewUrl: media.previewUrl,
      type: media.type,
      uploadedPath: media.imagePath,
    };
  });

  return slots;
}

function mediaToolbarClass() {
  return "absolute bottom-2 left-1/2 flex -translate-x-1/2 flex-wrap justify-center gap-0.5 rounded-full border border-[#E3E0E6] bg-white p-1 shadow-[0_4px_12px_rgba(47,38,51,0.10)]";
}

function MediaPreview({ alt, previewUrl, type }: { alt: string; previewUrl: string; type: "image" | "video" }) {
  if (type === "video") {
    return (
      <>
        <video aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-xl" muted playsInline preload="metadata" src={previewUrl} tabIndex={-1} />
        <span className="absolute inset-0 bg-midnight/30" />
        <video className="relative h-full w-full object-contain" muted playsInline preload="metadata" src={previewUrl} />
        <span className="absolute inset-0 grid place-items-center bg-midnight/10 text-white">
          <span className="grid size-10 place-items-center rounded-full bg-midnight/45 backdrop-blur">
            <Play className="ml-0.5 size-4 fill-current" aria-hidden="true" />
          </span>
        </span>
      </>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={alt} className="h-full w-full object-cover" src={previewUrl} />;
}

function debugInspiratorMediaUpload(stage: string, details: Record<string, unknown>) {
  console.info("[Inspirator media upload]", stage, details);
}

export function InspiratorImageUploadField({ currentPath, currentUrl, label, name }: ImageUploadFieldProps) {
  const [previewUrl, setPreviewUrl] = useState(currentUrl ?? "");
  const [objectUrl, setObjectUrl] = useState("");
  const [isRemoved, setIsRemoved] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const selectedFile = input.files?.[0];
    if (!selectedFile) return;

    try {
      const file = await prepareImageFileForUpload(selectedFile, { maxFileSizeBytes: maxEventGalleryImageFileSize });
      replaceInputFile(input, file);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      const nextPreviewUrl = URL.createObjectURL(file);
      setObjectUrl(nextPreviewUrl);
      setPreviewUrl(nextPreviewUrl);
      setIsRemoved(false);
      setErrorMessage("");
    } catch (error) {
      input.value = "";
      setErrorMessage(error instanceof Error ? error.message : "Billedet kunne ikke klargøres.");
    }
  }

  function removeImage() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    inputRef.current && (inputRef.current.value = "");
    setObjectUrl("");
    setPreviewUrl("");
    setIsRemoved(Boolean(currentPath));
    setErrorMessage("");
  }

  return (
    <div className="rounded-2xl border border-[#E5DDEA] bg-[#FAF6EF] p-4">
      <p className="mb-2 text-sm font-semibold text-[#2F2633]/75">{label}</p>
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-dashed border-[#D8CBE4] bg-[#F4F0F7]">
        {previewUrl && !isRemoved ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={label} className="h-full w-full object-cover" src={previewUrl} />
            <div className={mediaToolbarClass()}>
              <label className="grid size-8 cursor-pointer place-items-center rounded-full text-[#4F4756] transition hover:bg-[#F4F0F7]">
                <ImagePlus className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Udskift {label.toLowerCase()}</span>
                <input accept={imageUploadAccept} className="sr-only" name={name} onChange={(event) => void handleFileChange(event)} ref={inputRef} type="file" />
              </label>
              <button className="grid size-8 place-items-center rounded-full text-red-700 transition hover:bg-red-50" onClick={removeImage} type="button">
                <Trash2 className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Fjern {label.toLowerCase()}</span>
              </button>
            </div>
          </>
        ) : (
          <label className="grid h-full cursor-pointer place-items-center">
            <span className="grid size-14 place-items-center rounded-[18px] bg-white/90 text-[#7A5D91] shadow-soft">
              <ImagePlus className="size-6" aria-hidden="true" />
            </span>
            <input accept={imageUploadAccept} className="sr-only" name={name} onChange={(event) => void handleFileChange(event)} ref={inputRef} type="file" />
          </label>
        )}
      </div>
      {isRemoved ? <input name={"remove_" + name} type="hidden" value="on" /> : null}
      {errorMessage ? <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-900">{errorMessage}</p> : null}
      <p className="mt-2 text-xs leading-5 text-[#6E6475]">Billeder op til 10 MB.</p>
    </div>
  );
}

export function InspiratorExtraMediaFields({ group, initialMedia = [], title }: InspiratorExtraMediaFieldsProps) {
  const [slots, setSlots] = useState<Array<ExtraMediaSlot | null>>(() => createInitialSlots(initialMedia));
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadStatusMessage, setUploadStatusMessage] = useState("");
  const inputIdPrefix = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const slotsRef = useRef(slots);

  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  useEffect(() => {
    return () => {
      slotsRef.current.forEach((slot) => {
        if (slot?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(slot.previewUrl);
      });
    };
  }, []);

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return undefined;

    function handleSubmit(event: SubmitEvent) {
      if (slotsRef.current.some((slot) => slot?.isUploading)) {
        event.preventDefault();
        setErrorMessage("Vent til upload er færdig, før du gemmer inspiratoren.");
      }
    }

    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  }, []);

  async function prepareMediaFile(input: HTMLInputElement) {
    let file = input.files?.[0];
    if (!file) return null;

    debugInspiratorMediaUpload("file selected", {
      fileName: file.name,
      group,
      inputId: input.id || "inline-replace-input",
      size: file.size,
      type: file.type || "unknown",
    });
    setUploadStatusMessage(`Valgt: ${file.name} (${file.type || "ukendt type"})`);
    const validationError = validateEventGalleryFile(file);
    if (validationError) {
      input.value = "";
      setErrorMessage(validationError);
      setUploadStatusMessage("");
      debugInspiratorMediaUpload("validation failed", {
        error: validationError,
        fileName: file.name,
        group,
        inputId: input.id || "inline-replace-input",
        size: file.size,
        type: file.type || "unknown",
      });
      return null;
    }

    if (isEventGalleryVideoFile(file)) {
      const videoFile = normalizeEventGalleryVideoFile(file);
      setUploadStatusMessage(`Video valideret: ${videoFile.name} (${videoFile.type || "ukendt type"})`);
      debugInspiratorMediaUpload("video prepared", {
        fileName: videoFile.name,
        group,
        inputId: input.id || "inline-replace-input",
        size: videoFile.size,
        type: videoFile.type || "unknown",
      });
      setErrorMessage("");
      return videoFile;
    }

    try {
      setUploadStatusMessage(`Klargør billede: ${file.name} (${file.type || "ukendt type"})`);
      file = await prepareImageFileForUpload(file, { maxFileSizeBytes: maxEventGalleryImageFileSize });
      setUploadStatusMessage(`Billede valideret: ${file.name} (${file.type || "ukendt type"})`);
      debugInspiratorMediaUpload("image prepared", {
        fileName: file.name,
        group,
        inputId: input.id || "inline-replace-input",
        size: file.size,
        type: file.type || "unknown",
      });
      setErrorMessage("");
      return file;
    } catch (error) {
      input.value = "";
      setErrorMessage(error instanceof Error ? error.message : "Mediet kunne ikke klargøres.");
      setUploadStatusMessage("");
      debugInspiratorMediaUpload("image preparation failed", {
        error: error instanceof Error ? error.message : String(error),
        fileName: file.name,
        group,
        inputId: input.id || "inline-replace-input",
        size: file.size,
        type: file.type || "unknown",
      });
      return null;
    }
  }

  async function uploadMediaFile(file: File) {
    setUploadStatusMessage("Starter upload...");
    debugInspiratorMediaUpload("signed upload requested", {
      fileName: file.name,
      group,
      size: file.size,
      type: file.type || "unknown",
    });
    const signedUpload = await createSignedInspiratorMediaUploadAction({
      contentType: file.type,
      fileName: file.name,
      section: group,
      size: file.size,
    });

    if (signedUpload.error || !signedUpload.path || !signedUpload.token) {
      debugInspiratorMediaUpload("signed upload failed", {
        error: signedUpload.error || "missing path or token",
        fileName: file.name,
        group,
        size: file.size,
        type: file.type || "unknown",
      });
      throw new Error(signedUpload.error || "Signed upload kunne ikke startes.");
    }

    setUploadStatusMessage(`Uploader til medielager: ${signedUpload.path}`);
    debugInspiratorMediaUpload("signed upload ready", {
      contentType: signedUpload.contentType,
      fileName: file.name,
      group,
      path: signedUpload.path,
      size: file.size,
      type: file.type || "unknown",
    });
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.storage.from("media").uploadToSignedUrl(signedUpload.path, signedUpload.token, file, {
      cacheControl: "31536000",
      contentType: signedUpload.contentType ?? file.type,
    });

    if (error) {
      debugInspiratorMediaUpload("storage upload failed", {
        error: error.message,
        fileName: file.name,
        group,
        path: signedUpload.path,
        size: file.size,
        type: file.type || "unknown",
      });
      throw new Error("Upload til medielager fejlede: " + error.message);
    }

    debugInspiratorMediaUpload("storage upload complete", {
      fileName: file.name,
      group,
      path: signedUpload.path,
      size: file.size,
      type: file.type || "unknown",
    });
    return signedUpload.path;
  }

  async function handleFileChange(index: number, event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const selectedFile = input.files?.[0];
    debugInspiratorMediaUpload("input change", {
      fileName: selectedFile?.name ?? null,
      group,
      inputId: input.id || "inline-replace-input",
      slotIndex: index,
      type: selectedFile?.type || null,
    });
    setUploadStatusMessage(selectedFile ? `Valgt i ${group} slot ${index + 1}: ${selectedFile.name} (${input.id || "inline"})` : "");
    setErrorMessage("");
    const file = await prepareMediaFile(input);
    if (!file) return;

    const previousSlot = slots[index];
    if (previousSlot?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(previousSlot.previewUrl);

    const previewUrl = URL.createObjectURL(file);
    const nextSlot: ExtraMediaSlot = {
      caption: previousSlot?.caption ?? "",
      id: previousSlot?.id ?? crypto.randomUUID(),
      imageId: previousSlot?.imageId,
      isUploading: true,
      previewUrl,
      type: isEventGalleryVideoFile(file) || isEventGalleryVideoPath(file.name) ? "video" : "image",
      uploadedPath: previousSlot?.uploadedPath ?? "",
    };

    setSlots((currentSlots) => currentSlots.map((slot, slotIndex) => (slotIndex === index ? nextSlot : slot)));
    input.value = "";

    try {
      const uploadedPath = await uploadMediaFile(file);
      setSlots((currentSlots) =>
        currentSlots.map((slot, slotIndex) =>
          slotIndex === index && slot?.id === nextSlot.id
            ? {
                ...slot,
                isUploading: false,
                uploadedPath,
              }
            : slot,
        ),
      );
      setErrorMessage("");
      setUploadStatusMessage(`${group} slot ${index + 1} opdateret: ${uploadedPath} (${nextSlot.type})`);
      debugInspiratorMediaUpload("slot state updated", {
        fileName: file.name,
        group,
        inputId: input.id || "inline-replace-input",
        path: uploadedPath,
        previewUrl,
        slotIndex: index,
        slotType: nextSlot.type,
      });
    } catch (error) {
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
      setSlots((currentSlots) => currentSlots.map((slot, slotIndex) => (slotIndex === index && slot?.id === nextSlot.id ? previousSlot ?? null : slot)));
      setErrorMessage(error instanceof Error ? error.message : "Mediet kunne ikke uploades.");
      setUploadStatusMessage("");
      debugInspiratorMediaUpload("slot upload failed", {
        error: error instanceof Error ? error.message : String(error),
        fileName: file.name,
        group,
        slotType: nextSlot.type,
      });
    }
  }

  function removeSlot(index: number) {
    setSlots((currentSlots) => {
      const slot = currentSlots[index];
      if (slot?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(slot.previewUrl);
      const nextSlots = [...currentSlots];
      nextSlots[index] = null;
      return nextSlots;
    });
    setErrorMessage("");
    setUploadStatusMessage("");
  }

  function moveSlot(index: number, direction: -1 | 1) {
    setSlots((currentSlots) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= currentSlots.length) return currentSlots;
      const nextSlots = [...currentSlots];
      [nextSlots[index], nextSlots[nextIndex]] = [nextSlots[nextIndex], nextSlots[index]];
      return nextSlots;
    });
  }

  return (
    <div className="rounded-xl bg-white p-4" ref={rootRef}>
      <p className="mb-3 text-sm font-semibold text-[#2F2633]/75">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {slots.map((slot, index) => {
          const inputId = `${inputIdPrefix}-${group}-media-${index}`;
          const captionName = `${group}_alt_${index + 1}`;
          const idName = `${group}_image_id_${index + 1}`;
          const pathName = `${group}_image_path_${index + 1}`;

          return (
            <div className="grid gap-2" key={slot?.id ?? inputId}>
              {slot?.imageId ? <input name={idName} type="hidden" value={slot.imageId} /> : null}
              {slot?.uploadedPath ? <input name={pathName} type="hidden" value={slot.uploadedPath} /> : null}
              <div className="relative aspect-square overflow-hidden rounded-[20px] border border-dashed border-[#D8CBE4] bg-[#FAF8FC] shadow-sm">
                {slot ? (
                  <>
                    <MediaPreview alt={`${title} ${index + 1}`} previewUrl={slot.previewUrl} type={slot.type} />
                    {slot.isUploading ? (
                      <span className="absolute inset-x-3 top-3 rounded-full bg-white px-3 py-1 text-center text-xs font-semibold text-[#7A5D91] shadow-soft">Uploader...</span>
                    ) : null}
                    <div className={mediaToolbarClass()}>
                      <label className="grid size-8 cursor-pointer place-items-center rounded-full text-[#4F4756] transition hover:bg-[#F4F0F7]">
                        <ImagePlus className="size-3.5" aria-hidden="true" />
                        <span className="sr-only">Udskift billede eller video</span>
                        <input
                          accept={eventGalleryUploadAccept}
                          className="sr-only"
                          onChange={(event) => void handleFileChange(index, event)}
                          type="file"
                        />
                      </label>
                      <button className="grid size-8 place-items-center rounded-full text-[#4F4756] transition hover:bg-[#F4F0F7] disabled:text-[#B8B2BE]" disabled={index === 0} onClick={() => moveSlot(index, -1)} type="button">
                        <ArrowLeft className="size-3.5" aria-hidden="true" />
                        <span className="sr-only">Flyt til venstre</span>
                      </button>
                      <button className="grid size-8 place-items-center rounded-full text-[#4F4756] transition hover:bg-[#F4F0F7] disabled:text-[#B8B2BE]" disabled={index === slots.length - 1} onClick={() => moveSlot(index, 1)} type="button">
                        <ArrowRight className="size-3.5" aria-hidden="true" />
                        <span className="sr-only">Flyt til højre</span>
                      </button>
                      <button className="grid size-8 place-items-center rounded-full text-red-700 transition hover:bg-red-50" onClick={() => removeSlot(index)} type="button">
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        <span className="sr-only">Fjern billede eller video</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <label className="grid h-full cursor-pointer place-items-center" htmlFor={inputId}>
                    <span className="relative grid size-14 place-items-center rounded-[18px] bg-white/90 text-[#7A5D91] shadow-soft">
                      <ImagePlus className="size-6" aria-hidden="true" />
                      <MonitorSmartphone className="absolute -left-2 -bottom-1 size-4 rounded-full bg-white text-[#B56F8A]" aria-hidden="true" />
                    </span>
                    <input accept={eventGalleryUploadAccept} className="sr-only" id={inputId} onChange={(event) => void handleFileChange(index, event)} type="file" />
                  </label>
                )}
              </div>
              <input
                className="h-10 rounded-xl border border-[#D8CBE4] bg-white px-3 text-sm outline-none transition focus:border-[#7A5D91]"
                maxLength={160}
                name={captionName}
                onChange={(event) => {
                  const caption = event.target.value;
                  setSlots((currentSlots) => currentSlots.map((currentSlot, slotIndex) => (slotIndex === index && currentSlot ? { ...currentSlot, caption } : currentSlot)));
                }}
                placeholder="Billedtekst"
                value={slot?.caption ?? ""}
              />
            </div>
          );
        })}
      </div>
      <div aria-live="polite">
        {uploadStatusMessage ? <p className="mt-3 rounded-xl border border-[#D8CBE4] bg-[#FAF8FC] px-3 py-2 text-sm font-semibold text-[#4F4756]">{uploadStatusMessage}</p> : null}
        {errorMessage ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900">{errorMessage}</p> : null}
      </div>
      <p className="mt-3 text-xs leading-5 text-[#6E6475]">{supportedEventGalleryUploadText}</p>
    </div>
  );
}
