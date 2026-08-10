export const maxEventGalleryVideoFileSize = 50 * 1024 * 1024;
export const maxEventGalleryImageFileSize = 10 * 1024 * 1024;
export const eventGalleryUploadAccept = "image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,.heic,.heif,.mp4,.mov";
export const supportedEventGalleryUploadText = "Billeder op til 10 MB. Videoer op til 50 MB. JPG, PNG, WEBP, HEIC, MP4 og MOV understøttes.";

const allowedImageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/heic", "heic"],
  ["image/heif", "heif"],
]);
const allowedImageExtensions = new Map([
  ["jpg", "jpg"],
  ["jpeg", "jpg"],
  ["png", "png"],
  ["webp", "webp"],
  ["heic", "heic"],
  ["heif", "heif"],
]);
const allowedVideoTypes = new Map([
  ["video/mp4", "mp4"],
  ["video/quicktime", "mov"],
]);
const allowedVideoExtensions = new Map([
  ["mp4", "mp4"],
  ["mov", "mov"],
]);

export function eventGalleryPathExtension(path: string | null | undefined) {
  return path?.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
}

export function isEventGalleryVideoPath(path: string | null | undefined) {
  return allowedVideoExtensions.has(eventGalleryPathExtension(path));
}

export function isEventGalleryVideoFile(file: File) {
  return allowedVideoTypes.has(file.type) || allowedVideoExtensions.has(eventGalleryPathExtension(file.name));
}

export function normalizeEventGalleryVideoFile(file: File) {
  const extension = eventGalleryPathExtension(file.name);
  const inferredType = extension === "mov" ? "video/quicktime" : "video/mp4";
  return file.type ? file : new File([file], file.name, { type: inferredType });
}

export function eventGalleryFileExtension(file: File) {
  const videoExtension = allowedVideoTypes.get(file.type) ?? allowedVideoExtensions.get(eventGalleryPathExtension(file.name));
  if (videoExtension) return videoExtension;
  return allowedImageTypes.get(file.type) ?? allowedImageExtensions.get(eventGalleryPathExtension(file.name)) ?? null;
}

export function validateEventGalleryFile(file: File) {
  if (isEventGalleryVideoFile(file)) {
    if (file.type && !allowedVideoTypes.has(file.type)) {
      return "Kun MP4- og MOV-videoer understøttes.";
    }

    if (file.size > maxEventGalleryVideoFileSize) {
      return "Videoen er for stor. Vælg en MP4 eller MOV på højst 50 MB.";
    }

    return null;
  }

  if (!eventGalleryFileExtension(file)) {
    return "Stemningsmedier skal være JPG, PNG, WebP, HEIC, MP4 eller MOV.";
  }

  if (file.size > maxEventGalleryImageFileSize) {
    return "Billedet er for stort. Vælg et billede på højst 10 MB.";
  }

  return null;
}

export function eventGalleryContentTypeFromPath(path: string) {
  const extension = eventGalleryPathExtension(path);

  if (extension === "mp4") return "video/mp4";
  if (extension === "mov") return "video/quicktime";
  if (extension === "heic") return "image/heic";
  if (extension === "heif") return "image/heif";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}
