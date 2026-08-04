import type { SupabaseClient } from "@supabase/supabase-js";

export const mediaBucketName = "media";
export const mediaBucketFileSizeLimit = 100 * 1024 * 1024;
export const mediaBucketAllowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "video/mp4",
];

export async function ensureMediaStorageBucket(supabase: SupabaseClient) {
  const { data: bucket, error: getBucketError } = await supabase.storage.getBucket(mediaBucketName);

  if (bucket) {
    return null;
  }

  if (getBucketError && getBucketError.message && !getBucketError.message.toLowerCase().includes("not found")) {
    return getBucketError;
  }

  const { error } = await supabase.storage.createBucket(mediaBucketName, {
    allowedMimeTypes: mediaBucketAllowedMimeTypes,
    fileSizeLimit: mediaBucketFileSizeLimit,
    public: true,
  });

  if (error && !error.message.toLowerCase().includes("already exists")) {
    return error;
  }

  return null;
}
