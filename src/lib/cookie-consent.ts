export const cookieConsentName = "soulevents_cookie_consent";
export const cookieConsentVersion = "1.0";
export const cookieConsentMaxAgeSeconds = 60 * 60 * 24 * 183;

export type CookieConsentCategory = "necessary" | "statistics" | "marketing";

export type CookieConsent = {
  necessary: true;
  statistics: boolean;
  marketing: boolean;
  consentVersion: string;
  updatedAt: string;
};

export const defaultCookieConsent: CookieConsent = {
  necessary: true,
  statistics: false,
  marketing: false,
  consentVersion: cookieConsentVersion,
  updatedAt: "",
};

export function isCookieConsent(value: unknown): value is CookieConsent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const consent = value as Partial<CookieConsent>;
  const updatedAt = typeof consent.updatedAt === "string" ? Date.parse(consent.updatedAt) : Number.NaN;

  return (
    consent.necessary === true &&
    typeof consent.statistics === "boolean" &&
    typeof consent.marketing === "boolean" &&
    consent.consentVersion === cookieConsentVersion &&
    Number.isFinite(updatedAt)
  );
}

export function hasCookieConsentExpired(consent: CookieConsent, now = Date.now()) {
  const updatedAt = Date.parse(consent.updatedAt);
  return !Number.isFinite(updatedAt) || now - updatedAt > cookieConsentMaxAgeSeconds * 1000;
}

export function parseCookieConsent(rawValue: string | null | undefined): CookieConsent | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(rawValue));
    return isCookieConsent(parsed) && !hasCookieConsentExpired(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function createCookieConsent(input: { marketing?: boolean; statistics?: boolean }): CookieConsent {
  return {
    necessary: true,
    statistics: Boolean(input.statistics),
    marketing: Boolean(input.marketing),
    consentVersion: cookieConsentVersion,
    updatedAt: new Date().toISOString(),
  };
}

export function hasConsent(consent: CookieConsent | null, category: CookieConsentCategory) {
  if (category === "necessary") {
    return true;
  }

  return Boolean(consent?.[category]);
}

export function hasStatisticsConsent(consent: CookieConsent | null) {
  return hasConsent(consent, "statistics");
}

export function hasMarketingConsent(consent: CookieConsent | null) {
  return hasConsent(consent, "marketing");
}
