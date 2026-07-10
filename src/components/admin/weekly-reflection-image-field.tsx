"use client";

import { type ChangeEvent, type PointerEvent, type TouchEvent, useEffect, useRef, useState } from "react";
import { Crop, ImagePlus, Pencil, RefreshCw, Trash2, X } from "lucide-react";
import { imageUploadAccept, prepareImageFileForUpload, replaceInputFile, supportedImageUploadText } from "@/lib/images/client-image-upload";

type CropState = {
  cropX: number;
  cropY: number;
  fileName: string;
  naturalHeight: number;
  naturalWidth: number;
  sourceUrl: string;
  zoom: number;
};

type WeeklyReflectionImageFieldProps = {
  altText?: string | null;
  imagePath?: string | null;
  imageUrl?: string | null;
};

const cropAspect = 4 / 3;
const outputWidth = 1200;
const outputHeight = 900;

function loadImage(sourceUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Billedet kunne ikke åbnes til beskæring."));
    image.src = sourceUrl;
  });
}

function getCropArea(crop: CropState) {
  let sourceWidth = crop.naturalWidth;
  let sourceHeight = sourceWidth / cropAspect;

  if (sourceHeight > crop.naturalHeight) {
    sourceHeight = crop.naturalHeight;
    sourceWidth = sourceHeight * cropAspect;
  }

  sourceWidth /= crop.zoom;
  sourceHeight /= crop.zoom;

  const maxX = Math.max(crop.naturalWidth - sourceWidth, 0);
  const maxY = Math.max(crop.naturalHeight - sourceHeight, 0);

  return {
    sourceHeight,
    sourceWidth,
    sourceX: maxX * (crop.cropX / 100),
    sourceY: maxY * (crop.cropY / 100),
  };
}

function getPreviewImage(crop: CropState) {
  const area = getCropArea(crop);
  const scale = outputWidth / area.sourceWidth;

  return {
    height: crop.naturalHeight * scale,
    width: crop.naturalWidth * scale,
    x: -area.sourceX * scale,
    y: -area.sourceY * scale,
  };
}

function getTouchDistance(touches: TouchEvent<HTMLDivElement>["touches"]) {
  const first = touches.item(0);
  const second = touches.item(1);
  if (!first || !second) return 0;
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}

export function WeeklyReflectionImageField({ altText, imagePath, imageUrl }: WeeklyReflectionImageFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragRef = useRef<{ cropX: number; cropY: number; height: number; pointerId: number; width: number; x: number; y: number } | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const [cropState, setCropState] = useState<CropState | null>(null);
  const [message, setMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [isCropEditorOpen, setIsCropEditorOpen] = useState(false);

  const visibleImageUrl = removeImage ? null : previewUrl ?? imageUrl ?? null;

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("weekly-reflection-image-preview-change", { detail: { imageUrl: visibleImageUrl } }));
  }, [visibleImageUrl]);

  async function cropToInput(nextCrop: CropState) {
    const image = await loadImage(nextCrop.sourceUrl);
    const area = getCropArea(nextCrop);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Billedet kunne ikke beskæres.");
    }

    canvas.width = outputWidth;
    canvas.height = outputHeight;
    context.drawImage(image, area.sourceX, area.sourceY, area.sourceWidth, area.sourceHeight, 0, 0, outputWidth, outputHeight);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    if (!blob) {
      throw new Error("Billedet kunne ikke beskæres.");
    }

    const croppedFile = new File([blob], nextCrop.fileName.replace(/\.[^.]+$/, "") + "-refleksion.jpg", { type: "image/jpeg" });
    const input = inputRef.current;
    if (input) {
      replaceInputFile(input, croppedFile);
    }

    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      const objectUrl = URL.createObjectURL(croppedFile);
      previewUrlRef.current = objectUrl;
      return objectUrl;
    });
    setRemoveImage(false);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const selectedFile = input.files?.[0];

    if (!selectedFile) {
      setMessage("");
      return;
    }

    setMessage("Klargør billede...");

    try {
      const preparedFile = await prepareImageFileForUpload(selectedFile);
      const sourceUrl = URL.createObjectURL(preparedFile);
      const image = await loadImage(sourceUrl);
      const nextCrop: CropState = {
        cropX: 50,
        cropY: 50,
        fileName: preparedFile.name,
        naturalHeight: image.naturalHeight,
        naturalWidth: image.naturalWidth,
        sourceUrl,
        zoom: 1,
      };

      setCropState((current) => {
        if (current?.sourceUrl) URL.revokeObjectURL(current.sourceUrl);
        sourceUrlRef.current = nextCrop.sourceUrl;
        return nextCrop;
      });
      await cropToInput(nextCrop);
      setIsCropEditorOpen(true);
      setMessage("Billedet er beskåret til 4:3 og klar til at blive gemt.");
    } catch (error) {
      input.value = "";
      setMessage(error instanceof Error ? error.message : "Billedet kunne ikke klargøres.");
    }
  }

  async function saveCrop() {
    if (!cropState) return;
    setMessage("Opdaterer beskæring...");

    try {
      await cropToInput(cropState);
      setIsCropEditorOpen(false);
      setMessage("Beskæringen er klar til at blive gemt.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Billedet kunne ikke beskæres.");
    }
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (!cropState) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      cropX: cropState.cropX,
      cropY: cropState.cropY,
      height: rect.height,
      pointerId: event.pointerId,
      width: rect.width,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;

    setCropState((current) =>
      current
        ? {
            ...current,
            cropX: Math.min(Math.max(drag.cropX - (deltaX / drag.width) * 100, 0), 100),
            cropY: Math.min(Math.max(drag.cropY - (deltaY / drag.height) * 100, 0), 100),
          }
        : current,
    );
  }

  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  }

  function startPinch(event: TouchEvent<HTMLDivElement>) {
    if (!cropState || event.touches.length !== 2) {
      pinchRef.current = null;
      return;
    }

    pinchRef.current = { distance: getTouchDistance(event.touches), zoom: cropState.zoom };
  }

  function movePinch(event: TouchEvent<HTMLDivElement>) {
    const pinch = pinchRef.current;
    if (!pinch || event.touches.length !== 2) return;
    const distance = getTouchDistance(event.touches);
    const zoom = Math.min(Math.max(pinch.zoom * (distance / Math.max(pinch.distance, 1)), 1), 2.6);
    setCropState((current) => (current ? { ...current, zoom } : current));
  }

  return (
    <section className="grid gap-4">
      <div>
        <h3 className="text-sm font-semibold text-midnight">Billede til refleksionen</h3>
        <p className="mt-1 text-xs leading-5 text-ink/55">Tilføj eventuelt et stemningsbillede, som understøtter ugens refleksion.</p>
      </div>

      <input name="reflection_image_path" type="hidden" value={imagePath ?? ""} />

      <input
        accept={imageUploadAccept}
        className="sr-only"
        name="reflection_image_file"
        onChange={(event) => void handleFileChange(event)}
        ref={inputRef}
        type="file"
      />

      {visibleImageUrl ? (
        <div className="grid max-w-[420px] gap-3">
          <div className="overflow-hidden rounded-[18px] bg-white shadow-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={altText || "Illustration til ugens refleksion"}
              className="aspect-[4/3] w-full object-cover"
              data-weekly-reflection-image-preview
              src={visibleImageUrl}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md border border-sage-700/20 bg-white px-3 text-xs font-semibold text-sage-700 transition hover:bg-sage-50 disabled:opacity-50"
              disabled={!cropState}
              onClick={() => setIsCropEditorOpen(true)}
              type="button"
            >
              <Pencil className="size-4" aria-hidden="true" />
              Rediger beskæring
            </button>
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md border border-midnight/10 bg-white px-3 text-xs font-semibold text-ink/70 transition hover:bg-[#FAF6EF]"
              onClick={() => inputRef.current?.click()}
              type="button"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Udskift billede
            </button>
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md border border-terracotta/20 bg-white px-3 text-xs font-semibold text-terracotta transition hover:bg-terracotta/10"
              onClick={() => {
                setRemoveImage(true);
                if (inputRef.current) {
                  inputRef.current.value = "";
                }
              }}
              type="button"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Fjern
            </button>
          </div>
        </div>
      ) : (
        <button
          className="grid min-h-40 place-items-center rounded-[18px] border border-dashed border-sage-700/30 bg-[#FBF7EF] px-5 py-7 text-center transition hover:border-sage-700/50 hover:bg-sage-50/70"
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          <span className="grid gap-2">
            <ImagePlus className="mx-auto size-9 text-sage-700" aria-hidden="true" />
            <span className="text-base font-semibold text-midnight">Tilføj stemningsbillede</span>
            <span className="text-xs leading-5 text-ink/55">JPG, PNG, WebP eller HEIC · maks. 10 MB</span>
            <span className="mx-auto mt-1 inline-flex h-9 items-center rounded-md bg-sage-700 px-4 text-xs font-semibold text-white">
              Vælg billede
            </span>
          </span>
        </button>
      )}

      <input name="remove_reflection_image" type="hidden" value={removeImage ? "on" : ""} />

      {message && <p className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-sage-700">{message}</p>}

      <label className="grid gap-2 text-sm font-medium text-ink/72">
        Billedbeskrivelse
        <input
          className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
          defaultValue={altText ?? ""}
          maxLength={140}
          name="reflection_image_alt_text"
          placeholder="Beskriv kort, hvad billedet forestiller"
        />
        <span className="text-xs leading-5 text-ink/55">Bruges til tilgængelighed og vises ikke på siden.</span>
      </label>

      {isCropEditorOpen && cropState && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-midnight/35 px-4 py-6">
          <div className="grid max-h-[92vh] w-full max-w-2xl gap-4 overflow-y-auto rounded-[24px] bg-white p-5 shadow-lift sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold text-midnight">Tilpas billedet</h3>
                <p className="mt-1 text-sm leading-6 text-ink/60">Træk billedet for at placere motivet. Knib med to fingre på mobil for at zoome.</p>
              </div>
              <button
                aria-label="Luk beskæring"
                className="grid size-9 shrink-0 place-items-center rounded-full border border-midnight/10 text-ink/60 transition hover:bg-[#FAF6EF]"
                onClick={() => setIsCropEditorOpen(false)}
                type="button"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div
              className="touch-none overflow-hidden rounded-[18px] bg-sage-50"
              onPointerCancel={stopDrag}
              onPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={stopDrag}
              onTouchEnd={() => {
                pinchRef.current = null;
              }}
              onTouchMove={movePinch}
              onTouchStart={startPinch}
            >
              <svg className="block aspect-[4/3] w-full cursor-move" viewBox={`0 0 ${outputWidth} ${outputHeight}`}>
                {(() => {
                  const preview = getPreviewImage(cropState);
                  return <image height={preview.height} href={cropState.sourceUrl} preserveAspectRatio="none" width={preview.width} x={preview.x} y={preview.y} />;
                })()}
              </svg>
            </div>
            <label className="grid gap-2 text-sm font-semibold text-ink/70">
              Zoom
              <input
                className="w-full accent-sage-700"
                max="2.6"
                min="1"
                onChange={(event) => {
                  const zoom = Number(event.currentTarget.value);
                  setCropState((current) => (current ? { ...current, zoom } : current));
                }}
                step="0.05"
                type="range"
                value={cropState.zoom}
              />
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className="inline-flex h-11 items-center justify-center rounded-button border border-midnight/10 bg-white px-5 text-sm font-semibold text-ink/70 transition hover:bg-[#FAF6EF]"
                onClick={() => setIsCropEditorOpen(false)}
                type="button"
              >
                Annuller
              </button>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-button bg-olive px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-700"
                onClick={() => void saveCrop()}
                type="button"
              >
                <Crop className="size-4" aria-hidden="true" />
                Gem beskæring
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
