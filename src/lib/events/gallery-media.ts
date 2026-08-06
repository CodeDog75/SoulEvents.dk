export const maxEventGalleryVideoFileSize = 50 * 1024 * 1024;
export const eventGalleryUploadAccept = "image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,.heic,.heif,.mp4";
export const supportedEventGalleryUploadText = "Understøtter JPG, PNG, WEBP, HEIC og MP4. Maks. 10 MB pr. billede og 50 MB pr. MP4.";

const allowedImageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export function eventGalleryPathExtension(path: string | null | undefined) {
  return path?.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
}

export function isEventGalleryVideoPath(path: string | null | undefined) {
  return eventGalleryPathExtension(path) === "mp4";
}

export function isEventGalleryVideoFile(file: File) {
  return file.type === "video/mp4" || eventGalleryPathExtension(file.name) === "mp4";
}

export function eventGalleryFileExtension(file: File) {
  if (isEventGalleryVideoFile(file)) return "mp4";
  return allowedImageTypes.get(file.type) ?? null;
}

export function eventGalleryContentTypeFromPath(path: string) {
  const extension = eventGalleryPathExtension(path);

  if (extension === "mp4") return "video/mp4";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}
