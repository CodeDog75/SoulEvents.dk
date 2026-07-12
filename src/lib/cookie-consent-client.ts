"use client";

import {
  cookieConsentName,
  hasConsent as hasConsentFor,
  hasMarketingConsent as hasMarketingConsentFor,
  hasStatisticsConsent as hasStatisticsConsentFor,
  parseCookieConsent,
  type CookieConsentCategory,
} from "@/lib/cookie-consent";

export function getStoredCookieConsent() {
  if (typeof document === "undefined") {
    return null;
  }

  const rawValue = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(cookieConsentName + "="))
    ?.split("=")
    .slice(1)
    .join("=");

  return parseCookieConsent(rawValue);
}

export function hasConsent(category: CookieConsentCategory) {
  return hasConsentFor(getStoredCookieConsent(), category);
}

export function hasStatisticsConsent() {
  return hasStatisticsConsentFor(getStoredCookieConsent());
}

export function hasMarketingConsent() {
  return hasMarketingConsentFor(getStoredCookieConsent());
}
