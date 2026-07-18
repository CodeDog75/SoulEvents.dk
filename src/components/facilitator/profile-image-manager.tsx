"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ImagePlus, Pencil, Repeat2, Trash2, Upload } from "lucide-react";
import { type ChangeEvent, type PointerEvent, type ReactNode, type Ref, type TouchEvent, useEffect, useRef, useState } from "react";
import { normalizeFacilitatorMoodImageSlots } from "@/lib/facilitators/mood-image-slots";
import { imageUploadAccept, prepareImageFileForUpload, replaceInputFile, supportedImageUploadText } from "@/lib/images/client-image-upload";

type GalleryImage = {
  image_path: string;
  alt_text: string | null;
  sort_order?: number | null;
};

type ProfileImageManagerProps = {
  galleryImages: GalleryImage[];
  profileImagePath: string | null;
};

type ImageSlot = {
  file: File | null;
  fileName: string;
  message: string;
  path: string;
  previewUrl: string;
};

const profileImageMaxFileSize = 10 * 1024 * 1024;
const moodImageMaxFileSize = 15 * 1024 * 1024;

type ProfileCropState = {
  cropX: number;
  cropY: number;
  fileName: string;
  naturalHeight: number;
  naturalWidth: number;
  sourceUrl: string;
  zoom: number;
};

function publicImageUrl(path: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return supabaseUrl && path ? `${supabaseUrl}/storage/v1/object/public/media/${path}` : "";
}

type UploadFieldProps = {
  imagePath: string;
  inputRef?: Ref<HTMLInputElement>;
  name: string;
  maxFileSizeBytes?: number;
  onClear: () => void;
  onEdit?: () => void;
  onSelect: (file: File, previewUrl: string) => void;
  onUnsupportedFile: (message: string) => void;
  previewUrl: string;
  ratio?: "square";
  secondaryActions?: ReactNode;
  selectedFileName: string;
  title: string;
  unsupportedMessage: string;
  uploadText?: string;
};

function publicUploadText(maxFileSizeBytes: number) {
  const maxMegabytes = Math.round(maxFileSizeBytes / (1024 * 1024));
  return supportedImageUploadText.replace("Understøtter ", "").replace("Maks. 10 MB pr. billede.", `Maks. ${maxMegabytes} MB.`);
}

function UploadField({
  imagePath,
  inputRef,
  maxFileSizeBytes = profileImageMaxFileSize,
  name,
  onClear,
  onEdit,
  onSelect,
  onUnsupportedFile,
  previewUrl,
  ratio = "square",
  secondaryActions,
  selectedFileName,
  title,
  unsupportedMessage,
  uploadText,
}: UploadFieldProps) {
  const imageUrl = previewUrl || publicImageUrl(imagePath);
  const inputId = `${name}-${title.replace(/\s+/g, "-").toLowerCase()}`;

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    let file = event.target.files?.[0];

    if (file) {
      onUnsupportedFile(file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif") ? "Konverterer HEIC til JPG..." : "");

      try {
        file = await prepareImageFileForUpload(file, { maxFileSizeBytes });
        replaceInputFile(event.target, file);
      } catch (error) {
        event.target.value = "";
        onUnsupportedFile(error instanceof Error ? error.message : "Billedet kunne ikke klargøres til upload.");
        return;
      }

      onUnsupportedFile("");
      onSelect(file, URL.createObjectURL(file));
    }
  }

  return (
    <div className="overflow-hidden rounded-[20px] border border-midnight/10 bg-white shadow-soft">
      <div className={(ratio === "square" ? "aspect-square" : "aspect-video") + " overflow-hidden bg-[#F6F8F3]"}>
        {imageUrl ? (
          <img alt={title} className="h-full w-full object-cover" src={imageUrl} />
        ) : (
          <label className="grid h-full cursor-pointer place-items-center p-4 text-center transition hover:bg-sage-100" htmlFor={inputId}>
            <span className="grid justify-items-center gap-3">
              <span className="grid size-12 place-items-center rounded-full bg-white text-sage-700 shadow-soft">
                <ImagePlus className="size-6" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold text-midnight">Indsæt billede</span>
              <span className="max-w-44 whitespace-pre-line text-xs leading-5 text-ink/55">
                {uploadText ?? publicUploadText(maxFileSizeBytes)}
              </span>
            </span>
          </label>
        )}
      </div>

      <div className="grid gap-2 border-t border-midnight/10 p-3">
        {selectedFileName ? <p className="truncate text-xs font-semibold text-sage-700">Valgt: {selectedFileName}</p> : null}
        {unsupportedMessage ? <p className="rounded-md bg-terracotta/10 px-3 py-2 text-xs font-semibold text-terracotta">{unsupportedMessage}</p> : null}

        <div className="grid gap-2">
          <label
            className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-olive px-3 text-xs font-semibold text-white transition hover:bg-sage-700"
            htmlFor={inputId}
          >
            <Upload className="size-4" aria-hidden="true" />
            {imageUrl ? "Udskift billede" : "Indsæt billede"}
          </label>
          {imageUrl ? (
            <div className="grid grid-cols-2 gap-2">
              {onEdit ? (
                <button
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-midnight/15 bg-white px-2 text-xs font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
                  onClick={onEdit}
                  type="button"
                >
                  <Pencil className="size-4" aria-hidden="true" />
                  Rediger
                </button>
              ) : null}
              <button
                className={(onEdit ? "" : "col-span-2 ") + "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-rose/30 bg-white px-2 text-xs font-semibold text-rose transition hover:bg-rose/10"}
                onClick={() => {
                  if (window.confirm("Er du sikker på, at du vil slette billedet?")) {
                    onClear();
                  }
                }}
                type="button"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Slet
              </button>
            </div>
          ) : null}
          {secondaryActions ? <div className="flex flex-wrap justify-center gap-2 border-t border-midnight/10 pt-2">{secondaryActions}</div> : null}
        </div>
      </div>

      <input
        accept={imageUploadAccept}
        className="sr-only"
        id={inputId}
        name={name}
        onChange={handleChange}
        ref={inputRef}
        type="file"
      />
    </div>
  );
}

function loadImageSize(sourceUrl: string) {
  return new Promise<{ naturalHeight: number; naturalWidth: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ naturalHeight: image.naturalHeight, naturalWidth: image.naturalWidth });
    image.onerror = () => reject(new Error("Billedet kunne ikke åbnes til beskæring."));
    image.src = sourceUrl;
  });
}

async function imageUrlToObjectUrl(sourceUrl: string) {
  if (sourceUrl.startsWith("blob:")) {
    return sourceUrl;
  }

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error("Billedet kunne ikke hentes til beskæring.");
  }

  return URL.createObjectURL(await response.blob());
}

function getSquareCropArea(crop: ProfileCropState) {
  const sourceSize = Math.min(crop.naturalWidth, crop.naturalHeight) / crop.zoom;
  const maxX = Math.max(crop.naturalWidth - sourceSize, 0);
  const maxY = Math.max(crop.naturalHeight - sourceSize, 0);

  return {
    size: sourceSize,
    sourceX: maxX * (crop.cropX / 100),
    sourceY: maxY * (crop.cropY / 100),
  };
}

function SmallActionButton({
  children,
  disabled,
  icon,
  iconOnly = false,
  onClick,
  title,
  variant = "default",
}: {
  children: ReactNode;
  disabled?: boolean;
  icon: ReactNode;
  iconOnly?: boolean;
  onClick: () => void;
  title: string;
  variant?: "back" | "default" | "forward";
}) {
  const variantClass =
    variant === "back"
      ? "border-[#D8CBE4] bg-[#F4F0F7] text-[#6E5A86] hover:border-[#7A5D91] hover:text-[#5B4778]"
      : variant === "forward"
        ? "border-sage-700/15 bg-sage-50 text-sage-700 hover:border-sage-700 hover:bg-[#EEF6E8]"
        : "border-midnight/10 bg-white text-ink/70 hover:border-sage-700 hover:text-sage-700";

  return (
    <button
      className={
        "inline-flex h-9 items-center justify-center rounded-md border text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 " +
        variantClass +
        (iconOnly ? " w-9 px-0" : " gap-1 px-2")
      }
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {icon}
      {children}
    </button>
  );
}

export function ProfileImageManager({ galleryImages, profileImagePath }: ProfileImageManagerProps) {
  const galleryImageSlots = normalizeFacilitatorMoodImageSlots(galleryImages);
  const profileInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const cropDragRef = useRef<{
    cropX: number;
    cropY: number;
    height: number;
    pointerId: number;
    startX: number;
    startY: number;
    width: number;
  } | null>(null);
  const cropPinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const [profileCrop, setProfileCrop] = useState<ProfileCropState | null>(null);
  const [profileSlot, setProfileSlot] = useState<ImageSlot>({
    file: null,
    fileName: "",
    message: "",
    path: profileImagePath ?? "",
    previewUrl: "",
  });
  const [gallery, setGallery] = useState(
    Array.from({ length: 3 }, (_, index): ImageSlot => ({
      file: null,
      fileName: "",
      message: "",
      path: galleryImageSlots[index]?.image_path ?? "",
      previewUrl: "",
    })),
  );

  useEffect(() => {
    if (profileInputRef.current) {
      if (profileSlot.file) {
        replaceInputFile(profileInputRef.current, profileSlot.file);
      } else {
        profileInputRef.current.value = "";
      }
    }

    gallery.forEach((slot, index) => {
      const input = galleryInputRefs.current[index];
      if (!input) return;

      if (slot.file) {
        replaceInputFile(input, slot.file);
      } else {
        input.value = "";
      }
    });
  }, [gallery, profileSlot]);

  function clearProfileImage() {
    setProfileSlot((current) => ({ ...current, file: null, fileName: "", message: "", path: "", previewUrl: "" }));
  }

  function clearGalleryImage(index: number) {
    setGallery((current) => {
      const next = [...current];
      next[index] = { file: null, fileName: "", message: "", path: "", previewUrl: "" };
      return next;
    });
  }

  function moveUp(index: number) {
    if (index === 0) {
      return;
    }

    setGallery((current) => {
      const next = [...current];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveDown(index: number) {
    if (index >= gallery.length - 1) {
      return;
    }

    setGallery((current) => {
      const next = [...current];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  function swapWithProfile(index: number) {
    setGallery((current) => {
      const next = [...current];
      const selected = next[index];
      next[index] = profileSlot;
      setProfileSlot(selected);
      return next;
    });
  }

  async function openProfileCrop() {
    const sourceUrl = profileSlot.previewUrl || publicImageUrl(profileSlot.path);

    if (!sourceUrl) {
      return;
    }

    setProfileSlot((current) => ({ ...current, message: "" }));

    try {
      const cropSourceUrl = await imageUrlToObjectUrl(sourceUrl);
      const size = await loadImageSize(cropSourceUrl);
      setProfileCrop({
        cropX: 50,
        cropY: 50,
        fileName: profileSlot.fileName || "profilbillede.jpg",
        naturalHeight: size.naturalHeight,
        naturalWidth: size.naturalWidth,
        sourceUrl: cropSourceUrl,
        zoom: 1,
      });
    } catch (error) {
      setProfileSlot((current) => ({
        ...current,
        message: error instanceof Error ? error.message : "Billedet kunne ikke åbnes til beskæring.",
      }));
    }
  }

  function getSquareCropPreview(crop: ProfileCropState) {
    const area = getSquareCropArea(crop);
    const scale = 900 / area.size;

    return {
      height: crop.naturalHeight * scale,
      width: crop.naturalWidth * scale,
      x: -area.sourceX * scale,
      y: -area.sourceY * scale,
    };
  }

  function updateProfileCropZoom(direction: "in" | "out") {
    setProfileCrop((current) => {
      if (!current) return current;
      const nextZoom = direction === "in" ? current.zoom + 0.15 : current.zoom - 0.15;
      return { ...current, zoom: Math.min(Math.max(nextZoom, 1), 3) };
    });
  }

  function startProfileCropDrag(event: PointerEvent<HTMLDivElement>) {
    if (!profileCrop) return;

    const rect = event.currentTarget.getBoundingClientRect();
    cropDragRef.current = {
      cropX: profileCrop.cropX,
      cropY: profileCrop.cropY,
      height: rect.height,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      width: rect.width,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveProfileCrop(event: PointerEvent<HTMLDivElement>) {
    const drag = cropDragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    const nextCropX = Math.min(Math.max(drag.cropX - (deltaX / drag.width) * 100, 0), 100);
    const nextCropY = Math.min(Math.max(drag.cropY - (deltaY / drag.height) * 100, 0), 100);

    setProfileCrop((current) => (current ? { ...current, cropX: nextCropX, cropY: nextCropY } : current));
  }

  function stopProfileCropDrag(event: PointerEvent<HTMLDivElement>) {
    if (cropDragRef.current?.pointerId === event.pointerId) {
      cropDragRef.current = null;
    }
  }

  function getTouchDistance(touches: TouchEvent<HTMLDivElement>["touches"]) {
    const firstTouch = touches[0];
    const secondTouch = touches[1];

    if (!firstTouch || !secondTouch) {
      return 0;
    }

    return Math.hypot(firstTouch.clientX - secondTouch.clientX, firstTouch.clientY - secondTouch.clientY);
  }

  function startProfileCropPinch(event: TouchEvent<HTMLDivElement>) {
    if (!profileCrop || event.touches.length !== 2) {
      cropPinchRef.current = null;
      return;
    }

    cropPinchRef.current = { distance: getTouchDistance(event.touches), zoom: profileCrop.zoom };
  }

  function moveProfileCropPinch(event: TouchEvent<HTMLDivElement>) {
    const pinch = cropPinchRef.current;

    if (!pinch || event.touches.length !== 2 || pinch.distance <= 0) {
      return;
    }

    event.preventDefault();
    const nextDistance = getTouchDistance(event.touches);
    const nextZoom = Math.min(Math.max(pinch.zoom * (nextDistance / pinch.distance), 1), 3);
    setProfileCrop((current) => (current ? { ...current, zoom: nextZoom } : current));
  }

  function stopProfileCropPinch() {
    cropPinchRef.current = null;
  }

  function closeProfileCrop() {
    if (profileCrop?.sourceUrl.startsWith("blob:")) {
      URL.revokeObjectURL(profileCrop.sourceUrl);
    }

    setProfileCrop(null);
  }

  async function applyProfileCrop() {
    if (!profileCrop) {
      return;
    }

    const image = new Image();
    image.src = profileCrop.sourceUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Billedet kunne ikke beskæres."));
    });

    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 900;
    const context = canvas.getContext("2d");

    if (!context) {
      setProfileSlot((current) => ({ ...current, message: "Billedet kunne ikke beskæres." }));
      return;
    }

    const area = getSquareCropArea(profileCrop);
    context.drawImage(image, area.sourceX, area.sourceY, area.size, area.size, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) {
      setProfileSlot((current) => ({ ...current, message: "Billedet kunne ikke beskæres." }));
      return;
    }

    const croppedFileName = profileCrop.fileName.replace(/\.[^.]+$/, "") + "-beskaaret.jpg";
    const croppedFile = new File([blob], croppedFileName, { type: "image/jpeg" });
    const previewUrl = URL.createObjectURL(croppedFile);
    setProfileSlot((current) => ({ ...current, file: croppedFile, fileName: croppedFile.name, message: "", path: "", previewUrl }));
    closeProfileCrop();
  }

  return (
    <div className="grid gap-4 md:col-span-2 sm:grid-cols-2 xl:grid-cols-4">
      <div className="grid content-start gap-3 rounded-[22px] border border-lavender/30 bg-lavender/15 p-3 shadow-[0_18px_45px_rgba(126,87,166,0.12)]">
        <div className="min-h-10">
          <p className="text-sm font-semibold text-ink/80">Profilbillede</p>
          <p className="mt-0.5 text-xs text-ink/50">Vises øverst på din offentlige profil</p>
        </div>
        <UploadField
          imagePath={profileSlot.path}
          inputRef={profileInputRef}
          name="profile_image_file"
          onClear={clearProfileImage}
          onEdit={openProfileCrop}
          onSelect={(file, previewUrl) => {
            setProfileSlot((current) => ({ ...current, file, fileName: file.name, message: "", previewUrl }));
          }}
          onUnsupportedFile={(message) => setProfileSlot((current) => ({ ...current, message }))}
          previewUrl={profileSlot.previewUrl}
          selectedFileName={profileSlot.fileName}
          title="Profilbillede"
          unsupportedMessage={profileSlot.message}
        />
        <input name="profile_image_path" type="hidden" value={profileSlot.path} />
      </div>

      {gallery.map((slot, index) => {
        const hasImage = Boolean(slot.path || slot.previewUrl);
        return (
          <div className="grid content-start gap-3 rounded-[22px] bg-sage-50 p-3" key={`gallery-slot-${index + 1}`}>
            <div className="min-h-10">
              <p className="text-sm font-semibold text-ink/80">
                Stemningsbillede {index + 1} <span className="font-normal text-ink/50">Valgfrit</span>
              </p>
              <p className="mt-0.5 text-xs text-ink/50">Vises i galleriet på din profil</p>
            </div>
            <UploadField
              imagePath={slot.path}
              inputRef={(element: HTMLInputElement | null) => {
                galleryInputRefs.current[index] = element;
              }}
              maxFileSizeBytes={moodImageMaxFileSize}
              name={`gallery_image_file_${index}`}
              onClear={() => clearGalleryImage(index)}
              onSelect={(file, previewUrl) => {
                setGallery((current) => {
                  const next = [...current];
                  next[index] = { ...next[index], file, fileName: file.name, message: "", previewUrl };
                  return next;
                });
              }}
              onUnsupportedFile={(message) =>
                setGallery((current) => {
                  const next = [...current];
                  next[index] = { ...next[index], message };
                  return next;
                })
              }
              previewUrl={slot.previewUrl}
              selectedFileName={slot.fileName}
              secondaryActions={hasImage ? (
                <>
                  {index > 0 ? (
                    <SmallActionButton
                      icon={
                        <>
                          <ArrowUp className="size-4 md:hidden" aria-hidden="true" />
                          <ArrowLeft className="hidden size-4 md:block" aria-hidden="true" />
                        </>
                      }
                      iconOnly
                      onClick={() => moveUp(index)}
                      title="Flyt billedet tilbage"
                      variant="back"
                    >
                      <span className="sr-only">Flyt billedet tilbage</span>
                    </SmallActionButton>
                  ) : null}
                  {index < gallery.length - 1 ? (
                    <SmallActionButton
                      icon={
                        <>
                          <ArrowDown className="size-4 md:hidden" aria-hidden="true" />
                          <ArrowRight className="hidden size-4 md:block" aria-hidden="true" />
                        </>
                      }
                      iconOnly
                      onClick={() => moveDown(index)}
                      title="Flyt billedet frem"
                      variant="forward"
                    >
                      <span className="sr-only">Flyt billedet frem</span>
                    </SmallActionButton>
                  ) : null}
                  <SmallActionButton icon={<Repeat2 className="size-4" aria-hidden="true" />} onClick={() => swapWithProfile(index)} title="Byt dette billede med profilbilledet">
                    Profil
                  </SmallActionButton>
                </>
              ) : null}
              title={`Stemningsbillede ${index + 1}`}
              unsupportedMessage={slot.message}
              uploadText={"JPG, PNG eller WebP\nMaks. 15 MB"}
            />
            <input name="gallery_image_paths" type="hidden" value={slot.path} />
          </div>
        );
      })}
      {profileCrop ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-midnight/45 p-4">
          <div className="w-full max-w-2xl rounded-[22px] bg-white p-5 shadow-lift">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-midnight">Rediger profilbillede</h3>
                <p className="mt-1 text-sm leading-6 text-ink/60">Træk i billedet for at flytte udsnittet.</p>
              </div>
              <button className="rounded-full p-2 text-ink/50 transition hover:bg-sage-50 hover:text-midnight" onClick={closeProfileCrop} type="button">
                Luk
              </button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
              <div
                className="relative aspect-square touch-none cursor-grab overflow-hidden rounded-[18px] border-4 border-[#D8CBE4] bg-[#F4F0F7] active:cursor-grabbing"
                onPointerCancel={stopProfileCropDrag}
                onPointerDown={startProfileCropDrag}
                onPointerMove={moveProfileCrop}
                onPointerUp={stopProfileCropDrag}
                onTouchCancel={stopProfileCropPinch}
                onTouchEnd={stopProfileCropPinch}
                onTouchMove={moveProfileCropPinch}
                onTouchStart={startProfileCropPinch}
              >
                {(() => {
                  const preview = getSquareCropPreview(profileCrop);

                  return (
                    <svg
                      aria-label="Beskæring af profilbillede"
                      className="absolute inset-0 size-full"
                      preserveAspectRatio="none"
                      role="img"
                      viewBox="0 0 900 900"
                    >
                      <image
                        height={preview.height}
                        href={profileCrop.sourceUrl}
                        preserveAspectRatio="none"
                        width={preview.width}
                        x={preview.x}
                        y={preview.y}
                      />
                    </svg>
                  );
                })()}
                <div className="pointer-events-none absolute inset-0 rounded-[14px] ring-2 ring-inset ring-white/80" />
              </div>

              <div className="grid content-start gap-4 rounded-[18px] bg-[#FAF6EF] p-4">
                <div>
                  <p className="text-sm font-semibold text-midnight">Zoom</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <button
                      className="inline-flex h-12 items-center justify-center rounded-md border border-[#D8CBE4] bg-white text-2xl font-semibold text-[#7A5D91]"
                      onClick={() => updateProfileCropZoom("out")}
                      type="button"
                    >
                      {"−"}
                    </button>
                    <button
                      className="inline-flex h-12 items-center justify-center rounded-md border border-[#D8CBE4] bg-white text-2xl font-semibold text-[#7A5D91]"
                      onClick={() => updateProfileCropZoom("in")}
                      type="button"
                    >
                      {"+"}
                    </button>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-ink/64">Træk med musen eller fingeren for at placere billedet.</p>
                </div>

                <div className="grid gap-3 pt-2">
                  <button className="h-10 rounded-md bg-olive px-4 text-sm font-semibold text-white" onClick={applyProfileCrop} type="button">
                    Gem beskæring
                  </button>
                  <button className="h-10 rounded-md border border-midnight/15 bg-white px-4 text-sm font-semibold text-midnight" onClick={closeProfileCrop} type="button">
                    Fortryd
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
