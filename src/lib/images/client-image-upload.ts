"use client";

export const supportedImageUploadText = "Understøtter JPG, PNG, WEBP og HEIC. Maks. 10 MB pr. billede.";
export const imageUploadAccept = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

const allowedImageMimeTypes = ["image/jpeg", "image/png", "image/webp"];
const allowedImageExtensions = ["jpg", "jpeg", "png", "webp"];
const heicMimeTypes = ["image/heic", "image/heif"];
const maxImageFileSize = 10 * 1024 * 1024;

function fileExtension(file: File) {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

function mimeTypeFromExtension(extension: string) {
  if (extension === "jpg" || extension === "jpeg") {
    return "image/jpeg";
  }

  if (extension === "png") {
    return "image/png";
  }

  if (extension === "webp") {
    return "image/webp";
  }

  return null;
}

export function isHeicOrHeifFile(file: File) {
  const extension = fileExtension(file);
  return heicMimeTypes.includes(file.type) || extension === "heic" || extension === "heif";
}

export function isSupportedImageFile(file: File) {
  const extension = fileExtension(file);
  return allowedImageMimeTypes.includes(file.type) || allowedImageExtensions.includes(extension) || isHeicOrHeifFile(file);
}

export async function prepareImageFileForUpload(file: File) {
  if (file.size > maxImageFileSize) {
    throw new Error("Billedet må højst fylde 10 MB.");
  }

  if (!isSupportedImageFile(file)) {
    throw new Error("Du kan uploade JPG, PNG, WEBP eller HEIC.");
  }

  if (!isHeicOrHeifFile(file)) {
    const inferredMimeType = mimeTypeFromExtension(fileExtension(file));
    return !allowedImageMimeTypes.includes(file.type) && inferredMimeType
      ? new File([file], file.name, { type: inferredMimeType })
      : file;
  }

  try {
    if (typeof window === "undefined") {
      throw new Error("HEIC kan kun konverteres i browseren.");
    }

    const heic2any = (await import("heic2any")).default;
    const converted = await heic2any({
      blob: file,
      quality: 0.9,
      toType: "image/jpeg",
    });
    const blob = Array.isArray(converted) ? converted[0] : converted;

    if (!blob) {
      throw new Error("Konvertering fejlede.");
    }

    return new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
  } catch {
    throw new Error("HEIC-billedet kunne ikke konverteres. Prøv et andet billede eller eksportér som JPG.");
  }
}

export function replaceInputFile(input: HTMLInputElement, file: File) {
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
}
