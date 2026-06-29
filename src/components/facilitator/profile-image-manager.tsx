"use client";

import { ArrowDown, ArrowUp, ImagePlus, Pencil, Repeat2, Trash2, Upload } from "lucide-react";
import { type ChangeEvent, type ReactNode, type Ref, useEffect, useRef, useState } from "react";
import { imageUploadAccept, prepareImageFileForUpload, replaceInputFile, supportedImageUploadText } from "@/lib/images/client-image-upload";

type GalleryImage = {
  image_path: string;
  alt_text: string | null;
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

function publicImageUrl(path: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return supabaseUrl && path ? `${supabaseUrl}/storage/v1/object/public/media/${path}` : "";
}

type UploadFieldProps = {
  imagePath: string;
  inputRef?: Ref<HTMLInputElement>;
  name: string;
  onClear: () => void;
  onSelect: (file: File, previewUrl: string) => void;
  onUnsupportedFile: (message: string) => void;
  previewUrl: string;
  ratio?: "square";
  secondaryActions?: ReactNode;
  selectedFileName: string;
  title: string;
  unsupportedMessage: string;
};

function publicUploadText() {
  return supportedImageUploadText.replace("Understøtter ", "").replace("Maks. 10 MB pr. billede.", "Maks. 10 MB.");
}

function UploadField({
  imagePath,
  inputRef,
  name,
  onClear,
  onSelect,
  onUnsupportedFile,
  previewUrl,
  ratio = "square",
  secondaryActions,
  selectedFileName,
  title,
  unsupportedMessage,
}: UploadFieldProps) {
  const imageUrl = previewUrl || publicImageUrl(imagePath);
  const inputId = `${name}-${title.replace(/\s+/g, "-").toLowerCase()}`;

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    let file = event.target.files?.[0];

    if (file) {
      onUnsupportedFile(file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif") ? "Konverterer HEIC til JPG..." : "");

      try {
        file = await prepareImageFileForUpload(file);
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
              <span className="max-w-44 text-xs leading-5 text-ink/55">{publicUploadText()}</span>
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
              <label
                className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-midnight/15 bg-white px-2 text-xs font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
                htmlFor={inputId}
              >
                <Pencil className="size-4" aria-hidden="true" />
                Rediger
              </label>
              <button
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-rose/30 bg-white px-2 text-xs font-semibold text-rose transition hover:bg-rose/10"
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
          {secondaryActions ? <div className="grid grid-cols-3 gap-2 border-t border-midnight/10 pt-2">{secondaryActions}</div> : null}
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

function SmallActionButton({
  children,
  disabled,
  icon,
  onClick,
  title,
}: {
  children: string;
  disabled?: boolean;
  icon: ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-midnight/10 bg-white px-2 text-xs font-semibold text-ink/70 transition hover:border-sage-700 hover:text-sage-700 disabled:cursor-not-allowed disabled:opacity-35"
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
  const profileInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRefs = useRef<Array<HTMLInputElement | null>>([]);
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
      path: galleryImages[index]?.image_path ?? "",
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

  return (
    <div className="grid gap-4 md:col-span-2 sm:grid-cols-2 xl:grid-cols-4">
      <div className="grid content-start gap-3 rounded-[22px] bg-sage-50 p-3">
        <div className="min-h-10">
          <p className="text-sm font-semibold text-ink/80">Profilbillede</p>
          <p className="mt-0.5 text-xs text-ink/50">Vises øverst på din offentlige profil</p>
        </div>
        <UploadField
          imagePath={profileSlot.path}
          inputRef={profileInputRef}
          name="profile_image_file"
          onClear={clearProfileImage}
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
          <div className="grid content-start gap-3 rounded-[22px] bg-sage-50 p-3" key={index}>
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
              name="gallery_image_files"
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
              secondaryActions={
                <>
                  <SmallActionButton disabled={index === 0 || !hasImage} icon={<ArrowUp className="size-4" aria-hidden="true" />} onClick={() => moveUp(index)} title="Flyt billedet en plads op">
                    Op
                  </SmallActionButton>
                  <SmallActionButton disabled={index === gallery.length - 1 || !hasImage} icon={<ArrowDown className="size-4" aria-hidden="true" />} onClick={() => moveDown(index)} title="Flyt billedet en plads ned">
                    Ned
                  </SmallActionButton>
                  <SmallActionButton disabled={!hasImage} icon={<Repeat2 className="size-4" aria-hidden="true" />} onClick={() => swapWithProfile(index)} title="Byt dette billede med profilbilledet">
                    Profil
                  </SmallActionButton>
                </>
              }
              title={`Stemningsbillede ${index + 1}`}
              unsupportedMessage={slot.message}
            />
            <input name="gallery_image_paths" type="hidden" value={slot.path} />
          </div>
        );
      })}
    </div>
  );
}
