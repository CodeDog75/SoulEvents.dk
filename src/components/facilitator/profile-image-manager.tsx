"use client";

import { ArrowUp, ImagePlus, Repeat2, Upload } from "lucide-react";
import { type ChangeEvent, useState } from "react";

type GalleryImage = {
  image_path: string;
  alt_text: string | null;
};

type ProfileImageManagerProps = {
  galleryImages: GalleryImage[];
  profileImagePath: string | null;
};

function publicImageUrl(path: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return supabaseUrl && path ? `${supabaseUrl}/storage/v1/object/public/media/${path}` : "";
}

type UploadFieldProps = {
  imagePath: string;
  name: string;
  onSelect: (file: File, previewUrl: string) => void;
  onUnsupportedFile: (message: string) => void;
  previewUrl: string;
  selectedFileName: string;
  unsupportedMessage: string;
};

function isHeicFile(file: File) {
  const name = file.name.toLowerCase();
  return file.type === "image/heic" || file.type === "image/heif" || name.endsWith(".heic") || name.endsWith(".heif");
}

async function imageBitmapFromFile(file: File) {
  if (typeof createImageBitmap !== "function") {
    return null;
  }

  try {
    return await createImageBitmap(file);
  } catch {
    return null;
  }
}

async function imageElementFromFile(file: File) {
  const url = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.src = url;

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Image could not be decoded."));
    });

    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function canvasBlobFromImage(source: ImageBitmap | HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;

  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  context.drawImage(source, 0, 0);

  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
  });
}

async function convertHeicToJpeg(file: File) {
  const bitmap = await imageBitmapFromFile(file);
  const blob = bitmap ? await canvasBlobFromImage(bitmap) : await canvasBlobFromImage(await imageElementFromFile(file));

  if (!blob) {
    return null;
  }

  const fileName = file.name.replace(/\.(heic|heif)$/i, ".jpg");
  return new File([blob], fileName, { type: "image/jpeg" });
}

function uploadField({
  imagePath,
  name,
  onSelect,
  onUnsupportedFile,
  previewUrl,
  selectedFileName,
  unsupportedMessage,
}: UploadFieldProps) {
  const imageUrl = previewUrl || publicImageUrl(imagePath);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    let file = event.target.files?.[0];

    if (file) {
      if (isHeicFile(file)) {
        onUnsupportedFile("Konverterer HEIC til JPG...");

        try {
          const convertedFile = await convertHeicToJpeg(file);

          if (!convertedFile) {
            event.target.value = "";
            onUnsupportedFile("Din browser kunne ikke konvertere HEIC. Vælg JPG, PNG eller WebP.");
            return;
          }

          const files = new DataTransfer();
          files.items.add(convertedFile);
          event.target.files = files.files;
          file = convertedFile;
        } catch {
          event.target.value = "";
          onUnsupportedFile("Din browser kunne ikke konvertere HEIC. Vælg JPG, PNG eller WebP.");
          return;
        }
      }

      onUnsupportedFile("");
      onSelect(file, URL.createObjectURL(file));
    }
  }

  return (
    <span className="relative grid min-h-40 cursor-pointer place-items-center overflow-hidden rounded-md border border-dashed border-midnight/20 bg-white px-4 py-5 text-center transition hover:border-sage-700 hover:bg-sage-50">
      {imageUrl && (
        <span
          className="absolute inset-0 bg-cover bg-center opacity-70"
          style={{ backgroundImage: `url("${imageUrl}")` }}
          aria-hidden="true"
        />
      )}
      {imageUrl && <span className="absolute inset-0 bg-white/70" aria-hidden="true" />}
      <span className="relative z-10 grid place-items-center gap-3">
        <ImagePlus className="size-8 text-sage-700" aria-hidden="true" />
        <span className="text-sm font-semibold leading-6 text-midnight">
          Vælg et billede, der formidler din energi og personlighed
        </span>
        <span className="inline-flex h-10 items-center gap-2 rounded-md bg-sage-700 px-4 text-sm font-semibold text-white">
          <Upload className="size-4" aria-hidden="true" />
          Indsæt billede
        </span>
        {selectedFileName && (
          <span className="rounded-md bg-white/85 px-3 py-1 text-xs font-semibold text-sage-700">
            Valgt: {selectedFileName}
          </span>
        )}
        {unsupportedMessage && (
          <span className="rounded-md bg-terracotta/10 px-3 py-1 text-xs font-semibold text-terracotta">
            {unsupportedMessage}
          </span>
        )}
      </span>
      <input
        accept="image/jpeg,image/png,image/webp,image/gif,.heic,.heif"
        className="absolute inset-0 z-20 cursor-pointer opacity-0"
        name={name}
        onChange={handleChange}
        type="file"
      />
    </span>
  );
}

export function ProfileImageManager({ galleryImages, profileImagePath }: ProfileImageManagerProps) {
  const [profileImage, setProfileImage] = useState(profileImagePath ?? "");
  const [profilePreview, setProfilePreview] = useState("");
  const [profileFileName, setProfileFileName] = useState("");
  const [profileUnsupportedMessage, setProfileUnsupportedMessage] = useState("");
  const [gallery, setGallery] = useState(
    Array.from({ length: 3 }, (_, index) => galleryImages[index]?.image_path ?? ""),
  );
  const [galleryPreviews, setGalleryPreviews] = useState(Array.from({ length: 3 }, () => ""));
  const [galleryFileNames, setGalleryFileNames] = useState(Array.from({ length: 3 }, () => ""));
  const [galleryUnsupportedMessages, setGalleryUnsupportedMessages] = useState(Array.from({ length: 3 }, () => ""));

  function moveUp(index: number) {
    if (index === 0) {
      return;
    }

    setGallery((current) => {
      const next = [...current];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
    setGalleryPreviews((current) => {
      const next = [...current];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
    setGalleryFileNames((current) => {
      const next = [...current];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
    setGalleryUnsupportedMessages((current) => {
      const next = [...current];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function swapWithProfile(index: number) {
    setGallery((current) => {
      const next = [...current];
      const selected = next[index];
      next[index] = profileImage;
      setProfileImage(selected);
      return next;
    });
    setGalleryPreviews((current) => {
      const next = [...current];
      const selectedPreview = next[index];
      next[index] = profilePreview;
      setProfilePreview(selectedPreview);
      return next;
    });
    setGalleryFileNames((current) => {
      const next = [...current];
      const selectedFileName = next[index];
      next[index] = profileFileName;
      setProfileFileName(selectedFileName);
      return next;
    });
    setGalleryUnsupportedMessages((current) => {
      const next = [...current];
      const selectedMessage = next[index];
      next[index] = profileUnsupportedMessage;
      setProfileUnsupportedMessage(selectedMessage);
      return next;
    });
  }

  return (
    <div className="grid gap-5 md:col-span-2">
      <label className="grid gap-2 text-sm font-medium text-ink/72">
        <span>Profilbillede</span>
        {uploadField({
          imagePath: profileImage,
          name: "profile_image_file",
          onSelect: (file, previewUrl) => {
            setProfileFileName(file.name);
            setProfilePreview(previewUrl);
            setProfileUnsupportedMessage("");
          },
          onUnsupportedFile: setProfileUnsupportedMessage,
          previewUrl: profilePreview,
          selectedFileName: profileFileName,
          unsupportedMessage: profileUnsupportedMessage,
        })}
        <input name="profile_image_path" type="hidden" value={profileImage} />
        {profileImage && <span className="text-xs text-ink/55">Nuværende billede bevares, hvis du ikke vælger et nyt.</span>}
      </label>

      <div className="mt-5 grid gap-4">
        {gallery.map((imagePath, index) => (
          <div className="grid gap-3 rounded-md bg-sage-50 p-4" key={index}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-semibold text-ink/72">
                Stemningsbillede {index + 1} <span className="font-normal text-ink/55">Valgfrit</span>
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={index === 0 || !imagePath}
                  onClick={() => moveUp(index)}
                  type="button"
                >
                  <ArrowUp className="size-4" aria-hidden="true" />
                  Flyt op
                </button>
                <button
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!imagePath}
                  onClick={() => swapWithProfile(index)}
                  type="button"
                >
                  <Repeat2 className="size-4" aria-hidden="true" />
                  Byt med profil
                </button>
              </div>
            </div>
            {uploadField({
              imagePath,
              name: "gallery_image_files",
              onSelect: (file, previewUrl) => {
                setGalleryFileNames((current) => {
                  const next = [...current];
                  next[index] = file.name;
                  return next;
                });
                setGalleryUnsupportedMessages((current) => {
                  const next = [...current];
                  next[index] = "";
                  return next;
                });
                setGalleryPreviews((current) => {
                  const next = [...current];
                  next[index] = previewUrl;
                  return next;
                });
              },
              onUnsupportedFile: (message) =>
                setGalleryUnsupportedMessages((current) => {
                  const next = [...current];
                  next[index] = message;
                  return next;
                }),
              previewUrl: galleryPreviews[index],
              selectedFileName: galleryFileNames[index],
              unsupportedMessage: galleryUnsupportedMessages[index],
            })}
            <input name="gallery_image_paths" type="hidden" value={imagePath} />
            {imagePath && <span className="text-xs text-ink/55">Nuværende billede bevares, hvis du ikke vælger et nyt.</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
