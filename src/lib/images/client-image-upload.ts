"use client";

export const supportedImageUploadText = "Billeder op til 10 MB. JPG, PNG, WEBP og HEIC understøttes.";
export const imageUploadAccept = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

const allowedImageMimeTypes = ["image/jpeg", "image/png", "image/webp"];
const allowedImageExtensions = ["jpg", "jpeg", "png", "webp"];
const heicMimeTypes = ["image/heic", "image/heif"];
const maxImageFileSize = 10 * 1024 * 1024;
const defaultMaxImageDimension = 2400;

type PrepareImageOptions = {
  maxDimension?: number;
  maxFileSizeBytes?: number;
};

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

function formatMegabytes(bytes: number) {
  return Math.round(bytes / (1024 * 1024));
}

function replaceExtension(fileName: string, extension: string) {
  return fileName.includes(".") ? fileName.replace(/\.[^.]+$/, `.${extension}`) : `${fileName}.${extension}`;
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Billedet kunne ikke behandles. Prøv et andet billede."));
    };
    image.src = objectUrl;
  });
}

async function optimizeImageFile(file: File, maxDimension: number) {
  const image = await loadImage(file);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);

  if (longestSide <= maxDimension) {
    return file;
  }

  const scale = maxDimension / longestSide;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { alpha: file.type === "image/png" || file.type === "image/webp" });
  if (!context) {
    throw new Error("Billedet kunne ikke behandles. Prøv et andet billede.");
  }

  context.drawImage(image, 0, 0, width, height);

  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const extension = outputType === "image/png" ? "png" : "jpg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, 0.88));

  if (!blob) {
    throw new Error("Billedet kunne ikke behandles. Prøv et andet billede.");
  }

  return new File([blob], replaceExtension(file.name, extension), { type: outputType });
}

export async function prepareImageFileForUpload(file: File, options: PrepareImageOptions = {}) {
  const maxFileSizeBytes = options.maxFileSizeBytes ?? maxImageFileSize;
  const maxDimension = options.maxDimension ?? defaultMaxImageDimension;

  if (file.size > maxFileSizeBytes) {
    throw new Error(`Billedet er for stort. Vælg et billede på højst ${formatMegabytes(maxFileSizeBytes)} MB.`);
  }

  if (!isSupportedImageFile(file)) {
    throw new Error("Filtypen understøttes ikke. Brug JPG, PNG eller WebP.");
  }

  let preparedFile = file;

  if (!isHeicOrHeifFile(file)) {
    const inferredMimeType = mimeTypeFromExtension(fileExtension(file));
    preparedFile = !allowedImageMimeTypes.includes(file.type) && inferredMimeType
      ? new File([file], file.name, { type: inferredMimeType })
      : file;
  } else {
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

      preparedFile = new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
    } catch {
      throw new Error("HEIC-billedet kunne ikke konverteres. Prøv et andet billede eller eksportér som JPG.");
    }
  }

  try {
    preparedFile = await optimizeImageFile(preparedFile, maxDimension);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Billedet kunne ikke behandles. Prøv et andet billede.");
  }

  if (preparedFile.size > maxFileSizeBytes) {
    throw new Error(`Billedet er for stort. Vælg et billede på højst ${formatMegabytes(maxFileSizeBytes)} MB.`);
  }

  return preparedFile;
}

export function replaceInputFile(input: HTMLInputElement, file: File) {
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
}
