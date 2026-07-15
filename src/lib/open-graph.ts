import type { Metadata } from "next";
import { getBrandLogoSettingValue, mediaBucketName, resolveBrandLogoUrl, type LogoSettingClient } from "@/lib/brand-logo";
import {
  absoluteUrl,
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

type SiteSettingClient = LogoSettingClient & StorageClient & {
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

export async function getOgLogoUrl(client?: LogoSettingClient) {
  try {
    const supabase = client ?? (createAdminClient() as unknown as LogoSettingClient);
    const value = await getBrandLogoSettingValue(supabase);
    return resolveBrandLogoUrl(value, { absolute: true });
  } catch {
    return resolveBrandLogoUrl(null, { absolute: true });
  }
}

export function ogImageUrl({
  imageUrl,
  subtitle,
  title,
  type,
}: {
  imageUrl?: string | null;
  subtitle?: string | null;
  title: string;
  type?: string;
}) {
  const params = new URLSearchParams();
  params.set("title", title);
  if (subtitle) params.set("subtitle", subtitle);
  if (imageUrl) params.set("image", imageUrl);
  if (type) params.set("type", type);
  return absoluteUrl("/api/og?" + params.toString());
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
  const canonical = absoluteUrl(path);
  const normalizedDescription = truncateText(stripHtml(description), 180);
  const ogImage = ogImageUrl({
    imageUrl,
    subtitle: imageSubtitle ?? normalizedDescription,
    title: imageTitle ?? title,
    type,
  });

  return {
    title,
    description: normalizedDescription,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description: normalizedDescription,
      images: [{ url: ogImage, width: ogImageWidth, height: ogImageHeight, alt: imageTitle ?? title }],
      type,
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: normalizedDescription,
      images: [ogImage],
    },
  };
}
