export const ogImageWidth = 1200;
export const ogImageHeight = 630;
export const mediaBucketName = "media";
export const fallbackBrandLogoPath = "/brand/soulevents-logo.png";

function appUrl() {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.soulevents.dk").replace(/\/$/, "");

  if (baseUrl.startsWith("http://") && !baseUrl.includes("localhost") && !baseUrl.includes("127.0.0.1")) {
    return "https://" + baseUrl.slice("http://".length);
  }

  return baseUrl;
}

export function siteBaseUrl() {
  return appUrl();
}

export function absoluteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return siteBaseUrl() + (path.startsWith("/") ? path : "/" + path);
}

export function storagePublicUrl(path: string | null | undefined, bucket = mediaBucketName) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!supabaseUrl) return null;
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return supabaseUrl + "/storage/v1/object/public/" + bucket + "/" + encodedPath;
}

export function resolveLogoUrl(value?: string | null) {
  const logoValue = value?.trim();

  if (!logoValue) return absoluteUrl(fallbackBrandLogoPath);
  if (/^https?:\/\//i.test(logoValue)) return logoValue;
  if (logoValue.startsWith("/")) return absoluteUrl(logoValue);

  return storagePublicUrl(logoValue) ?? absoluteUrl(fallbackBrandLogoPath);
}

export function stripHtml(value: string | null | undefined) {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength - 1).trimEnd() + "…";
}
