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

  if (process.env.NODE_ENV === "development" && requestUrl && isLocalUrl(requestUrl)) {
    return requestUrl;
  }

  if (configuredUrl && (process.env.NODE_ENV === "development" || !isLocalUrl(configuredUrl))) {
    return configuredUrl;
  }

  if (process.env.VERCEL_URL) {
    return cleanUrl(`https://${process.env.VERCEL_URL}`);
  }

  if (requestUrl && (process.env.NODE_ENV === "development" || !isLocalUrl(requestUrl))) {
    return requestUrl;
  }

  return process.env.NODE_ENV === "development" ? "http://localhost:3001" : "https://soulevents.dk";
}
