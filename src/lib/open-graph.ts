import type { Metadata } from "next";
import { env } from "@/lib/env";
import { getBrandLogoSettingValue, mediaBucketName, resolveBrandLogoUrl, type LogoSettingClient } from "@/lib/brand-logo";
import { createAdminClient } from "@/lib/supabase/admin";

export const ogImageWidth = 1200;
export const ogImageHeight = 630;

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

export function siteBaseUrl() {
  const baseUrl = (env.appUrl || "https://www.soulevents.dk").replace(/\/$/, "");

  if (baseUrl.startsWith("http://") && !baseUrl.includes("localhost") && !baseUrl.includes("127.0.0.1")) {
    return "https://" + baseUrl.slice("http://".length);
  }

  return baseUrl;
}

export function absoluteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return siteBaseUrl() + (path.startsWith("/") ? path : "/" + path);
}

export function publicMediaUrl(client: StorageClient, path: string | null | undefined, bucket = mediaBucketName) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
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
