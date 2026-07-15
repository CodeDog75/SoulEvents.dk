import type { Metadata } from "next";
import { mediaBucketName } from "@/lib/brand-logo";
import {
  absoluteUrl,
  isValidSharingImageUrl,
  ogImageHeight,
  ogImageWidth,
  siteBaseUrl,
  storagePublicUrl,
  stripHtml,
  truncateText,
} from "@/lib/open-graph-core";
import { createAdminClient } from "@/lib/supabase/admin";

export { absoluteUrl, ogImageHeight, ogImageWidth, siteBaseUrl, stripHtml, truncateText };

type StorageClient = {
  storage: {
    from(bucket: string): {
      getPublicUrl(path: string): { data: { publicUrl: string } };
    };
  };
};

type SiteSettingClient = StorageClient & {
  from(table: "hero_images"): any;
};

export function publicMediaUrl(client: StorageClient, path: string | null | undefined, bucket = mediaBucketName) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return storagePublicUrl(path, bucket) ?? client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function getHomepageOgImageUrl(client?: SiteSettingClient) {
  try {
    const supabase = client ?? (createAdminClient() as unknown as SiteSettingClient);
    const { data } = await supabase
      .from("hero_images")
      .select("image_path")
      .eq("scope", "homepage")
      .eq("is_active", true)
      .order("sort_order") as { data: Array<{ image_path: string | null }> | null };
    const imagePath = data?.find((image) => image.image_path)?.image_path ?? null;
    return publicMediaUrl(supabase, imagePath);
  } catch {
    return null;
  }
}

export function ogImageUrlForPath(path: string) {
  if (path.startsWith("/events/")) {
    return absoluteUrl(path.replace(/\/$/, "") + "/opengraph-image");
  }

  if (path.startsWith("/facilitators/") && path !== "/facilitators") {
    return absoluteUrl(path.replace(/\/$/, "") + "/opengraph-image");
  }

  return absoluteUrl("/opengraph-image");
}

export function createPageMetadata({
  description,
  imageSubtitle,
  imageTitle,
  imageUrl,
  path,
  title,
  type = "website",
}: {
  description: string;
  imageSubtitle?: string | null;
  imageTitle?: string | null;
  imageUrl?: string | null;
  path: string;
  title: string;
  type?: "website" | "article";
}): Metadata {
  void imageSubtitle;

  const canonical = absoluteUrl(path);
  const normalizedDescription = truncateText(stripHtml(description), 180);
  const ogImage = isValidSharingImageUrl(imageUrl) ? imageUrl : ogImageUrlForPath(path);
  const imageAlt = imageTitle ?? title;

  return {
    title,
    description: normalizedDescription,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description: normalizedDescription,
      images: [{ url: ogImage, width: ogImageWidth, height: ogImageHeight, alt: imageAlt }],
      siteName: "SoulEvents.dk",
      type,
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: normalizedDescription,
      images: [{ url: ogImage, alt: imageAlt }],
    },
  };
}
