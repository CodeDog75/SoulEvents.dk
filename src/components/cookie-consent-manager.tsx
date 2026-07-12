"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  cookieConsentMaxAgeSeconds,
  cookieConsentName,
  createCookieConsent,
  defaultCookieConsent,
  hasMarketingConsent,
  hasStatisticsConsent,
  parseCookieConsent,
  type CookieConsent,
} from "@/lib/cookie-consent";

const optionalCookieNames = ["_ga", "_gid", "_gat", "_fbp", "_fbc"];

function readConsentCookie() {
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

function writeConsentCookie(consent: CookieConsent) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${cookieConsentName}=${encodeURIComponent(JSON.stringify(consent))}; Path=/; Max-Age=${cookieConsentMaxAgeSeconds}; SameSite=Lax${secure}`;
}

function deleteCookie(name: string) {
  const host = window.location.hostname;
  const domains = ["", host, "." + host.replace(/^www\./, "")];

  for (const domain of domains) {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${domain ? `; Domain=${domain}` : ""}`;
  }
}

function clearOptionalFirstPartyCookies(consent: CookieConsent) {
  if (hasStatisticsConsent(consent) && hasMarketingConsent(consent)) {
    return;
  }

  for (const cookieName of optionalCookieNames) {
    if (!hasStatisticsConsent(consent) && cookieName.startsWith("_ga")) {
      deleteCookie(cookieName);
    }

    if (!hasMarketingConsent(consent) && (cookieName === "_fbp" || cookieName === "_fbc")) {
      deleteCookie(cookieName);
    }
  }
}

function broadcastConsent(consent: CookieConsent) {
  window.dispatchEvent(new CustomEvent("soulevents:cookie-consent-changed", { detail: consent }));
}

function Toggle({
  checked,
  children,
  description,
  disabled = false,
  id,
  onChange,
}: {
  checked: boolean;
  children: string;
  description: string;
  disabled?: boolean;
  id: string;
  onChange?: (checked: boolean) => void;
}) {
  const descriptionId = `${id}-description`;

  return (
    <label className="flex items-start gap-3 rounded-md border border-midnight/10 bg-white p-4 text-sm leading-6 text-ink/72">
      <input
        aria-describedby={descriptionId}
        checked={checked}
        className="mt-1 size-4 accent-sage-700 disabled:cursor-not-allowed"
        disabled={disabled}
        id={id}
        onChange={(event) => onChange?.(event.currentTarget.checked)}
        type="checkbox"
      />
      <span>
        <span className="block font-semibold text-midnight">{children}</span>
        <span className="mt-1 block text-ink/64" id={descriptionId}>
          {description}
        </span>
      </span>
    </label>
  );
}

export function CookieConsentManager() {
  const [consent, setConsent] = useState<CookieConsent | null>(() => readConsentCookie());
  const [draft, setDraft] = useState<CookieConsent>(() => readConsentCookie() ?? defaultCookieConsent);
  const [isBannerVisible, setIsBannerVisible] = useState(() => !readConsentCookie());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const showBanner = isBannerVisible && !isSettingsOpen;
  const categories = useMemo(
    () => ({
      marketing: draft.marketing,
      statistics: draft.statistics,
    }),
    [draft.marketing, draft.statistics],
  );

  useEffect(() => {
    const openSettings = () => {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const latestConsent = readConsentCookie();
      setConsent(latestConsent);
      setDraft(latestConsent ?? defaultCookieConsent);
      setIsBannerVisible(false);
      setIsSettingsOpen(true);
    };

    window.addEventListener("soulevents:open-cookie-settings", openSettings);
    return () => window.removeEventListener("soulevents:open-cookie-settings", openSettings);
  }, []);

  useEffect(() => {
    if (!isSettingsOpen) {
      return;
    }

    const focusable = dialogRef.current?.querySelector<HTMLElement>("button, input, a, [tabindex]:not([tabindex='-1'])");
    focusable?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSettingsOpen(false);
        setIsBannerVisible(!consent);
        window.setTimeout(() => {
          previousFocusRef.current?.focus();
          previousFocusRef.current = null;
        }, 0);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [consent, isSettingsOpen]);

  function saveConsent(nextConsent: CookieConsent) {
    writeConsentCookie(nextConsent);
    clearOptionalFirstPartyCookies(nextConsent);
    setConsent(nextConsent);
    setDraft(nextConsent);
    setIsBannerVisible(false);
    setIsSettingsOpen(false);
    broadcastConsent(nextConsent);
    window.setTimeout(() => {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    }, 0);
  }

  function closeSettings() {
    setIsSettingsOpen(false);
    setIsBannerVisible(!consent);
    window.setTimeout(() => {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    }, 0);
  }

  function openSettings() {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDraft(consent ?? defaultCookieConsent);
    setIsBannerVisible(false);
    setIsSettingsOpen(true);
  }

  function acceptAll() {
    saveConsent(createCookieConsent({ marketing: true, statistics: true }));
  }

  function rejectOptional() {
    saveConsent(createCookieConsent({ marketing: false, statistics: false }));
  }

  function saveDraft() {
    saveConsent(createCookieConsent(categories));
  }

  return (
    <>
      {showBanner ? (
        <section
          aria-describedby="cookie-banner-description"
          aria-labelledby="cookie-banner-title"
          className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-4xl rounded-card border border-[#D8CBE4] bg-white p-5 text-ink shadow-lift sm:bottom-5 sm:p-6"
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h2 className="text-xl font-semibold text-midnight" id="cookie-banner-title">
                Cookies på SoulEvents
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink/70" id="cookie-banner-description">
                Vi bruger nødvendige cookies for at få SoulEvents til at fungere. Med dit samtykke kan vi også bruge
                cookies til statistik og markedsføring. Du kan altid ændre dit valg senere.
              </p>
              <Link className="mt-2 inline-flex text-sm font-semibold text-[#7A4EAB] underline underline-offset-4" href="/legal/cookies">
                Se cookieoversigt
              </Link>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[30rem]">
              <button
                className="h-11 rounded-button border border-[#7A4EAB]/30 bg-white px-4 text-sm font-semibold text-[#7A4EAB] transition hover:bg-[#F7F2FB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A4EAB]"
                onClick={rejectOptional}
                type="button"
              >
                Afvis valgfrie
              </button>
              <button
                className="h-11 rounded-button border border-midnight/15 bg-white px-4 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700"
                onClick={openSettings}
                type="button"
              >
                Tilpas cookies
              </button>
              <button
                className="h-11 rounded-button bg-midnight px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-midnight"
                onClick={acceptAll}
                type="button"
              >
                Accepter alle
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {consent && !isSettingsOpen ? (
        <button
          className="fixed bottom-3 left-3 z-40 rounded-full border border-midnight/10 bg-white/95 px-3 py-2 text-xs font-semibold text-ink/64 shadow-soft transition hover:border-sage-700 hover:text-sage-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700"
          onClick={openSettings}
          type="button"
        >
          Cookieindstillinger
        </button>
      ) : null}

      {isSettingsOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-midnight/35 px-4 py-6" role="presentation">
          <section
            aria-describedby="cookie-settings-description"
            aria-labelledby="cookie-settings-title"
            aria-modal="true"
            className="max-h-[min(42rem,calc(100vh-3rem))] w-full max-w-2xl overflow-y-auto rounded-card bg-[#FBFAF7] p-5 text-ink shadow-lift sm:p-6"
            ref={dialogRef}
            role="dialog"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-midnight" id="cookie-settings-title">
                  Cookieindstillinger
                </h2>
                <p className="mt-2 text-sm leading-6 text-ink/70" id="cookie-settings-description">
                  Vælg hvilke cookies SoulEvents må bruge. Nødvendige cookies er altid aktive.
                </p>
              </div>
              <button
                className="rounded-full border border-midnight/15 bg-white px-3 py-1.5 text-sm font-semibold text-ink/70 transition hover:border-sage-700 hover:text-sage-700"
                onClick={closeSettings}
                ref={settingsButtonRef}
                type="button"
              >
                Luk
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <Toggle
                checked
                description="Nødvendige cookies får SoulEvents til at fungere og bruges blandt andet til login, sikkerhed, sessionsstyring og lagring af dine cookievalg."
                disabled
                id="cookie-necessary"
              >
                Nødvendige cookies
              </Toggle>
              <Toggle
                checked={draft.statistics}
                description="Statistik hjælper os med at forstå, hvordan SoulEvents bliver brugt, så vi kan forbedre platformen."
                id="cookie-statistics"
                onChange={(statistics) => setDraft((current) => ({ ...current, statistics }))}
              >
                Statistik
              </Toggle>
              <Toggle
                checked={draft.marketing}
                description="Markedsføringscookies kan bruges til at måle annoncer og vise mere relevante budskaber på eksempelvis Facebook og Instagram."
                id="cookie-marketing"
                onChange={(marketing) => setDraft((current) => ({ ...current, marketing }))}
              >
                Markedsføring
              </Toggle>
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              <button
                className="h-11 rounded-button border border-[#7A4EAB]/30 bg-white px-4 text-sm font-semibold text-[#7A4EAB] transition hover:bg-[#F7F2FB]"
                onClick={rejectOptional}
                type="button"
              >
                Afvis alle valgfrie
              </button>
              <button
                className="h-11 rounded-button border border-midnight/15 bg-white px-4 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
                onClick={acceptAll}
                type="button"
              >
                Accepter alle
              </button>
              <button
                className="h-11 rounded-button bg-midnight px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-700"
                onClick={saveDraft}
                type="button"
              >
                Gem mine valg
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
