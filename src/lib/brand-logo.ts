import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const brandLogoSettingKey = "brand_logo_path";
export const desktopBrandLogoSettingKey = brandLogoSettingKey;
export const mobileBrandLogoSettingKey = "brand_logo_mobile_path";
export const faviconSettingKey = "favicon_path";
// Current static fallback assets. Mail logo includes a version query because email clients cache images aggressively.
export const fallbackBrandLogoPath = "/brand/soulevents-logo.png";
export const fallbackEmailBrandLogoPath = "/brand/soulevents-email-logo.png?v=2";
export const mediaBucketName = "media";

export type LogoSettingClient = {
  from(table: "site_settings"): {
    select(columns: "value"): {
      eq(column: "key", value: string): {
        maybeSingle(): PromiseLike<{ data: { value: string | null } | null }>;
      };
    };
  };
};

export type BrandLogoSources = {
  desktop: string;
  mobile: string;
};

function appBaseUrl() {
  const baseUrl = (env.appUrl || "https://www.soulevents.dk").replace(/\/$/, "");

  if (baseUrl.startsWith("http://") && !baseUrl.includes("localhost") && !baseUrl.includes("127.0.0.1")) {
    return "https://" + baseUrl.slice("http://".length);
  }

  return baseUrl;
}

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function isAbsoluteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function toAbsoluteSiteUrl(path: string) {
  if (isAbsoluteUrl(path)) {
    return path;
  }

  return appBaseUrl() + (path.startsWith("/") ? path : "/" + path);
}

export function resolveBrandLogoUrl(value?: string | null, options: { absolute?: boolean } = {}) {
  const logoValue = value?.trim();

  if (!logoValue) {
    return options.absolute ? toAbsoluteSiteUrl(fallbackBrandLogoPath) : fallbackBrandLogoPath;
  }

  if (isAbsoluteUrl(logoValue)) {
    return logoValue;
  }

  if (logoValue.startsWith("/")) {
    return options.absolute ? toAbsoluteSiteUrl(logoValue) : logoValue;
  }

  if (!env.supabaseUrl) {
    return options.absolute ? toAbsoluteSiteUrl(fallbackBrandLogoPath) : fallbackBrandLogoPath;
  }

  return env.supabaseUrl.replace(/\/$/, "") + "/storage/v1/object/public/" + mediaBucketName + "/" + encodeStoragePath(logoValue);
}

export function isSvgLogoUrl(src: string) {
  try {
    return new URL(src, appBaseUrl()).pathname.toLowerCase().endsWith(".svg");
  } catch {
    return src.split("?")[0]?.toLowerCase().endsWith(".svg") ?? false;
  }
}

export async function getBrandLogoSettingValue(supabase: LogoSettingClient) {
  const { data } = await supabase.from("site_settings").select("value").eq("key", brandLogoSettingKey).maybeSingle();
  return data?.value ?? null;
}

export async function getBrandLogoSettingValues(supabase: LogoSettingClient) {
  const [desktopResult, mobileResult] = await Promise.all([
    supabase.from("site_settings").select("value").eq("key", desktopBrandLogoSettingKey).maybeSingle(),
    supabase.from("site_settings").select("value").eq("key", mobileBrandLogoSettingKey).maybeSingle(),
  ]);

  const desktop = desktopResult.data?.value ?? null;
  const mobile = mobileResult.data?.value ?? null;
  return { desktop, mobile };
}

export async function getBrandLogoSources(supabase: LogoSettingClient): Promise<BrandLogoSources> {
  const { desktop, mobile } = await getBrandLogoSettingValues(supabase);
  const desktopSrc = resolveBrandLogoUrl(desktop);

  return {
    desktop: desktopSrc,
    mobile: mobile ? resolveBrandLogoUrl(mobile) : desktopSrc,
  };
}

export async function getEmailBrandLogoUrl() {
  return resolveBrandLogoUrl(fallbackEmailBrandLogoPath, { absolute: true });
}

export async function getSiteFaviconUrl() {
  try {
    const supabase = createAdminClient() as unknown as LogoSettingClient;
    const { data } = await supabase.from("site_settings").select("value").eq("key", faviconSettingKey).maybeSingle();
    return data?.value ? resolveBrandLogoUrl(data.value) : null;
  } catch {
    return null;
  }
}
