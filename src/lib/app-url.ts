import { env } from "@/lib/env";

const localUrlPattern = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i;

function cleanUrl(url: string) {
  return url.trim().replace(/\/$/, "");
}

function isLocalUrl(url: string) {
  return localUrlPattern.test(url);
}

export function getAppUrl(fallbackOrigin?: string) {
  const configuredUrl = env.appUrl ? cleanUrl(env.appUrl) : "";

  if (configuredUrl && (process.env.NODE_ENV === "development" || !isLocalUrl(configuredUrl))) {
    return configuredUrl;
  }

  if (process.env.VERCEL_URL) {
    return cleanUrl(`https://${process.env.VERCEL_URL}`);
  }

  if (fallbackOrigin && (process.env.NODE_ENV === "development" || !isLocalUrl(fallbackOrigin))) {
    return cleanUrl(fallbackOrigin);
  }

  return process.env.NODE_ENV === "development" ? "http://localhost:3001" : "https://soulevents.dk";
}
