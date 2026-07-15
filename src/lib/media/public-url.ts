const mediaBucketName = "media";

export function publicMediaUrl(path: string | null | undefined, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL) {
  const cleanPath = path?.trim();
  if (!cleanPath) return null;
  if (/^https?:\/\//i.test(cleanPath)) return cleanPath;
  if (!supabaseUrl) return null;

  const encodedPath = cleanPath
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");

  if (!encodedPath) return null;

  return supabaseUrl.replace(/\/$/, "") + "/storage/v1/object/public/" + mediaBucketName + "/" + encodedPath;
}
