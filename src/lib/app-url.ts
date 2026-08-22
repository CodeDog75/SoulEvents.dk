import { env } from "@/lib/env";

const localUrlPattern = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?/i;

function cleanUrl(url: string) {
  return url.trim().replace(/\/$/, "");
}

function isLocalUrl(url: string) {
  return localUrlPattern.test(url);
}

export function getAppUrl(fallbackOrigin?: string) {
  const configuredUrl = env.appUrl ? cleanUrl(env.appUrl) : "";
  const requestUrl = fallbackOrigin ? cleanUrl(fallbackOrigin) : "";
  const isLocalDevelopment = process.env.NODE_ENV === "development" && process.env.VERCEL !== "1";

  if (isLocalDevelopment && requestUrl && isLocalUrl(requestUrl)) {
    return requestUrl;
  }

  if (configuredUrl && (isLocalDevelopment || !isLocalUrl(configuredUrl))) {
    return configuredUrl;
  }

  if (process.env.VERCEL_URL) {
    return cleanUrl(`https://${process.env.VERCEL_URL}`);
  }

  if (requestUrl && (isLocalDevelopment || !isLocalUrl(requestUrl))) {
    return requestUrl;
  }

  return isLocalDevelopment ? "http://localhost:3001" : "https://soulevents.dk";
}

export function getCanonicalAppUrl() {
  const configuredUrl = env.appUrl ? cleanUrl(env.appUrl) : "";

  if (configuredUrl && !isLocalUrl(configuredUrl)) {
    try {
      const hostname = new URL(configuredUrl).hostname.replace(/^www\./, "");
      if (hostname === "soulevents.dk") {
        return "https://www.soulevents.dk";
      }
    } catch {
      return "https://www.soulevents.dk";
    }
  }

  return "https://www.soulevents.dk";
}
