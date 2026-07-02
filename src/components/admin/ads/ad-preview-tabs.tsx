"use client";

import { useState } from "react";

type AdPreviewTabsProps = {
  altText?: string | null;
  desktopPath?: string | null;
  desktopUrl?: string | null;
  mobilePath?: string | null;
  mobileUrl?: string | null;
  showSponsor: boolean;
  showTitle: boolean;
  sponsorName?: string | null;
  title: string;
};

function isVideoMedia(path?: string | null) {
  return Boolean(path && /\.mp4($|[?#])/i.test(path));
}

function PreviewMedia({
  altText,
  className,
  path,
  url,
}: {
  altText: string;
  className: string;
  path?: string | null;
  url?: string | null;
}) {
  if (!url) {
    return (
      <div className={className + " grid place-items-center bg-gradient-to-br from-[#2F2633] via-[#7A4EAB] to-[#D8A7B1] px-6 text-center text-sm font-semibold text-white"}>
        Upload banner for at se preview
      </div>
    );
  }

  if (isVideoMedia(path)) {
    return <video autoPlay className={className} loop muted playsInline src={url} />;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={altText} className={className} src={url} />;
}

export function AdPreviewTabs({
  altText,
  desktopPath,
  desktopUrl,
  mobilePath,
  mobileUrl,
  showSponsor,
  showTitle,
  sponsorName,
  title,
}: AdPreviewTabsProps) {
  const [view, setView] = useState<"desktop" | "mobile">("desktop");
  const isMobile = view === "mobile";
  const activeUrl = isMobile ? mobileUrl || desktopUrl : desktopUrl;
  const activePath = isMobile ? mobilePath || desktopPath : desktopPath;
  const usesDesktopFallback = isMobile && !mobileUrl && Boolean(desktopUrl);

  return (
    <section className="rounded-card border border-midnight/10 bg-white p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#7A4EAB]">Preview</p>
          <h3 className="mt-1 text-lg font-semibold text-midnight">Sådan vises reklamen</h3>
        </div>
        <div className="inline-flex rounded-full border border-midnight/10 bg-[#FAF6EF] p-1">
          {(["desktop", "mobile"] as const).map((mode) => (
            <button
              className={
                "h-9 rounded-full px-4 text-sm font-semibold transition " +
                (view === mode ? "bg-sage-700 text-white shadow-soft" : "text-ink/65 hover:text-midnight")
              }
              key={mode}
              onClick={() => setView(mode)}
              type="button"
            >
              {mode === "desktop" ? "Desktop" : "Mobil"}
            </button>
          ))}
        </div>
      </div>

      {usesDesktopFallback && (
        <p className="mt-4 rounded-md bg-[#FAF6EF] px-4 py-3 text-sm font-semibold text-ink/70">
          Mobilbanner mangler - desktopbanner bruges som fallback.
        </p>
      )}

      <div className={"mt-4 overflow-hidden rounded-[18px] border border-midnight/10 bg-[#F6F1E7] shadow-soft " + (isMobile ? "mx-auto max-w-[360px]" : "")}>
        <div className="relative">
          <PreviewMedia
            altText={altText || title || "Reklamebanner"}
            className={(isMobile ? "aspect-square" : "aspect-[16/6]") + " w-full object-cover"}
            path={activePath}
            url={activeUrl}
          />
          {activeUrl && (
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-midnight/55 via-midnight/12 to-transparent" />
          )}
          {activeUrl && (showTitle || (showSponsor && sponsorName)) && (
            <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
              {showTitle && <p className="max-w-2xl text-xl font-semibold leading-tight sm:text-2xl">{title || "Titel på reklame"}</p>}
              {showSponsor && sponsorName && (
                <span className="mt-3 inline-flex rounded-full bg-[#D8C1A2] px-3 py-1 text-xs font-bold uppercase tracking-wide text-midnight shadow-soft">
                  {sponsorName}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 text-xs font-semibold text-ink/55">
        {isMobile ? "Mobilformat anbefales: 1200 x 1200 px." : "Desktopformat anbefales: 1600 x 600 px."}
      </p>
    </section>
  );
}
