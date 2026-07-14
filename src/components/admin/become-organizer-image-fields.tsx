"use client";

import { type ChangeEvent, useEffect, useState } from "react";
import {
  becomeOrganizerImageFields,
  getBecomeOrganizerSection,
  siteContentBucketName,
  type BecomeOrganizerImageKey,
  type BecomeOrganizerPageContent,
} from "@/lib/become-organizer-page-content";
import { imageUploadAccept, prepareImageFileForUpload, replaceInputFile } from "@/lib/images/client-image-upload";

type BecomeOrganizerImageFieldsProps = {
  content: BecomeOrganizerPageContent;
};

const maxImageWidth = 1800;
const maxImageHeight = 1200;
const targetFileSize = 1.4 * 1024 * 1024;

function publicMediaUrl(path: string | null) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return supabaseUrl && path
    ? supabaseUrl.replace(/\/$/, "") + "/storage/v1/object/public/" + siteContentBucketName + "/" + path.split("/").map(encodeURIComponent).join("/")
    : null;
}

function loadImage(sourceUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Billedet kunne ikke åbnes."));
    image.src = sourceUrl;
  });
}

function toBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

async function prepareBecomeOrganizerImage(file: File) {
  const preparedFile = await prepareImageFileForUpload(file);
  const objectUrl = URL.createObjectURL(preparedFile);

  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(maxImageWidth / image.naturalWidth, maxImageHeight / image.naturalHeight, 1);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Billedet kunne ikke klargøres.");
    }

    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);

    for (const quality of [0.86, 0.78, 0.7]) {
      const blob = await toBlob(canvas, quality);

      if (blob && (blob.size <= targetFileSize || quality === 0.7)) {
        return new File([blob], preparedFile.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      }
    }

    return preparedFile;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function imageForField(content: BecomeOrganizerPageContent, key: BecomeOrganizerImageKey) {
  if (key === "hero") return getBecomeOrganizerSection(content, "hero", "hero")?.image;
  if (key === "intro") return getBecomeOrganizerSection(content, "intro-image", "image")?.image;
  return getBecomeOrganizerSection(content, "final-cta", "cta")?.image;
}

export function BecomeOrganizerImageFields({ content }: BecomeOrganizerImageFieldsProps) {
  const [messages, setMessages] = useState<Partial<Record<BecomeOrganizerImageKey, string>>>({});
  const [previews, setPreviews] = useState<Partial<Record<BecomeOrganizerImageKey, string>>>({});

  useEffect(() => {
    return () => {
      for (const preview of Object.values(previews)) {
        if (preview) URL.revokeObjectURL(preview);
      }
    };
  }, [previews]);

  async function handleImageChange(key: BecomeOrganizerImageKey, event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const selectedFile = input.files?.[0];

    if (!selectedFile) {
      setMessages((current) => ({ ...current, [key]: "" }));
      return;
    }

    setMessages((current) => ({ ...current, [key]: "Klargør billede..." }));

    try {
      const preparedFile = await prepareBecomeOrganizerImage(selectedFile);
      replaceInputFile(input, preparedFile);

      setPreviews((current) => {
        const currentPreview = current[key];
        if (currentPreview) URL.revokeObjectURL(currentPreview);
        return { ...current, [key]: URL.createObjectURL(preparedFile) };
      });
      setMessages((current) => ({ ...current, [key]: "Billedet er klar til at blive gemt." }));
    } catch (error) {
      input.value = "";
      setMessages((current) => ({
        ...current,
        [key]: error instanceof Error ? error.message : "Billedet kunne ikke klargøres.",
      }));
    }
  }

  return (
    <section className="grid gap-4 rounded-card border border-midnight/10 bg-white p-5 shadow-soft">
      <h2 className="font-semibold text-midnight">Billeder</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {becomeOrganizerImageFields.map((field) => {
          const image = imageForField(content, field.key) ?? { alt: "", path: null };
          const previewUrl = previews[field.key] ?? publicMediaUrl(image.path);

          return (
            <div className="grid gap-3 rounded-md border border-midnight/10 bg-[#fbfaf7] p-4" key={field.key}>
              <h3 className="font-semibold text-midnight">{field.label}</h3>
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={image.alt} className="aspect-[16/10] w-full rounded-md object-cover shadow-soft" src={previewUrl} />
              ) : (
                <div className="grid aspect-[16/10] place-items-center rounded-md bg-sage-50 text-sm font-semibold text-sage-700">
                  Intet billede valgt
                </div>
              )}
              <input name={`${field.key}ImagePath`} type="hidden" value={image.path ?? ""} />
              <label className="grid gap-2 text-sm font-medium text-ink/72">
                Upload/udskift billede
                <input
                  accept={imageUploadAccept}
                  className="rounded-md border border-midnight/15 bg-white px-3 py-2 text-sm"
                  name={`${field.key}ImageFile`}
                  onChange={(event) => void handleImageChange(field.key, event)}
                  type="file"
                />
              </label>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-ink/72">
                <input className="size-4 rounded border-midnight/20" name={`${field.key}ImageDelete`} type="checkbox" value="1" />
                Fjern billede
              </label>
              {messages[field.key] ? <p className="rounded-md bg-sage-50 px-3 py-2 text-xs font-semibold text-sage-700">{messages[field.key]}</p> : null}
              <label className="grid gap-2 text-sm font-medium text-ink/72">
                Alternativ tekst
                <input
                  className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
                  defaultValue={image.alt}
                  name={`${field.key}ImageAlt`}
                />
              </label>
            </div>
          );
        })}
      </div>
    </section>
  );
}
