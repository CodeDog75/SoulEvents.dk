"use client";

import { useEffect, useState } from "react";

type AdPreviewTabsProps = {
  altText?: string | null;
  desktopPath?: string | null;
  desktopUrl?: string | null;
  formId: string;
  mobilePath?: string | null;
  mobileUrl?: string | null;
  showSponsor: boolean;
  showTitle: boolean;
  sponsorName?: string | null;
  title: string;
};

type PreviewState = {
  altText: string;
  desktopPath?: string | null;
  desktopType?: string | null;
  desktopUrl?: string | null;
  mobilePath?: string | null;
  mobileType?: string | null;
  mobileUrl?: string | null;
  showSponsor: boolean;
  showTitle: boolean;
  sponsorName: string;
  title: string;
};

function isVideoMedia(path?: string | null, mediaType?: string | null) {
  return mediaType === "video/mp4" || Boolean(path && /\.mp4($|[?#])/i.test(path));
}

function PreviewMedia({
  altText,
  className,
  mediaType,
  path,
  url,
}: {
  altText: string;
  className: string;
  mediaType?: string | null;
  path?: string | null;
  url?: string | null;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const hasMediaError = Boolean(url && failedUrl === url);

  if (!url || hasMediaError) {
    return (
      <div className={className + " grid place-items-center bg-gradient-to-br from-[#2F2633] via-[#7A4EAB] to-[#D8A7B1] px-6 text-center text-sm font-semibold text-white"}>
        Upload banner for at se preview
      </div>
    );
  }

  if (isVideoMedia(path, mediaType)) {
    return <video autoPlay className={className} loop muted onError={() => setFailedUrl(url)} playsInline src={url} />;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={altText} className={className} onError={() => setFailedUrl(url)} src={url} />;
}

export function AdPreviewTabs({
  altText,
  desktopPath,
  desktopUrl,
  formId,
  mobilePath,
  mobileUrl,
  showSponsor,
  showTitle,
  sponsorName,
  title,
}: AdPreviewTabsProps) {
  const [view, setView] = useState<"desktop" | "mobile">("desktop");
  const [preview, setPreview] = useState<PreviewState>({
    altText: altText || title || "Reklamebanner",
    desktopPath,
    desktopUrl,
    mobilePath,
    mobileUrl,
    showSponsor,
    showTitle,
    sponsorName: sponsorName || "",
    title,
  });

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return undefined;

    let desktopObjectUrl: string | null = null;
    let mobileObjectUrl: string | null = null;

    const revokeDesktopUrl = () => {
      if (desktopObjectUrl) URL.revokeObjectURL(desktopObjectUrl);
      desktopObjectUrl = null;
    };
    const revokeMobileUrl = () => {
      if (mobileObjectUrl) URL.revokeObjectURL(mobileObjectUrl);
      mobileObjectUrl = null;
    };

    const syncPreview = () => {
      const desktopFileInput = form.elements.namedItem("image_file");
      const mobileFileInput = form.elements.namedItem("mobile_image_file");
      const removeDesktopInput = form.elements.namedItem("remove_image");
      const removeMobileInput = form.elements.namedItem("remove_mobile_image");
      const titleInput = form.elements.namedItem("title");
      const sponsorInput = form.elements.namedItem("sponsor_name");
      const altInput = form.elements.namedItem("alt_text");
      const showTitleInput = form.elements.namedItem("show_title_on_banner");
      const showSponsorInput = form.elements.namedItem("show_sponsor_on_banner");

      const selectedDesktopFile = desktopFileInput instanceof HTMLInputElement ? desktopFileInput.files?.[0] : null;
      const selectedMobileFile = mobileFileInput instanceof HTMLInputElement ? mobileFileInput.files?.[0] : null;
      const removeDesktop = removeDesktopInput instanceof HTMLInputElement && removeDesktopInput.checked;
      const removeMobile = removeMobileInput instanceof HTMLInputElement && removeMobileInput.checked;

      let nextDesktopUrl = desktopUrl;
      let nextDesktopPath = desktopPath;
      let nextDesktopType: string | null = null;
      if (selectedDesktopFile) {
        revokeDesktopUrl();
        desktopObjectUrl = URL.createObjectURL(selectedDesktopFile);
        nextDesktopUrl = desktopObjectUrl;
        nextDesktopPath = selectedDesktopFile.name;
        nextDesktopType = selectedDesktopFile.type;
      } else if (removeDesktop) {
        nextDesktopUrl = null;
        nextDesktopPath = null;
      }

      let nextMobileUrl = mobileUrl;
      let nextMobilePath = mobilePath;
      let nextMobileType: string | null = null;
      if (selectedMobileFile) {
        revokeMobileUrl();
        mobileObjectUrl = URL.createObjectURL(selectedMobileFile);
        nextMobileUrl = mobileObjectUrl;
        nextMobilePath = selectedMobileFile.name;
        nextMobileType = selectedMobileFile.type;
      } else if (removeMobile) {
        nextMobileUrl = null;
        nextMobilePath = null;
      }

      const nextTitle = titleInput instanceof HTMLInputElement ? titleInput.value : title;
      const nextSponsorName = sponsorInput instanceof HTMLInputElement ? sponsorInput.value : sponsorName || "";
      const nextAltText = altInput instanceof HTMLInputElement ? altInput.value : altText || nextTitle || "Reklamebanner";

      setPreview({
        altText: nextAltText,
        desktopPath: nextDesktopPath,
        desktopType: nextDesktopType,
        desktopUrl: nextDesktopUrl,
        mobilePath: nextMobilePath,
        mobileType: nextMobileType,
        mobileUrl: nextMobileUrl,
        showSponsor: showSponsorInput instanceof HTMLInputElement ? showSponsorInput.checked : showSponsor,
        showTitle: showTitleInput instanceof HTMLInputElement ? showTitleInput.checked : showTitle,
        sponsorName: nextSponsorName,
        title: nextTitle,
      });
    };

    const syncAfterReset = () => window.setTimeout(syncPreview, 0);
    const fields = Array.from(
      form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        'input[name="image_file"], input[name="mobile_image_file"], input[name="remove_image"], input[name="remove_mobile_image"], input[name="title"], input[name="sponsor_name"], input[name="alt_text"], input[name="show_title_on_banner"], input[name="show_sponsor_on_banner"]',
      ),
    );

    fields.forEach((field) => {
      field.addEventListener("change", syncPreview);
      field.addEventListener("input", syncPreview);
    });
    form.addEventListener("reset", syncAfterReset);
    syncPreview();

    return () => {
      fields.forEach((field) => {
        field.removeEventListener("change", syncPreview);
        field.removeEventListener("input", syncPreview);
      });
      form.removeEventListener("reset", syncAfterReset);
      revokeDesktopUrl();
      revokeMobileUrl();
    };
  }, [altText, desktopPath, desktopUrl, formId, mobilePath, mobileUrl, showSponsor, showTitle, sponsorName, title]);

  const isMobile = view === "mobile";
  const activeUrl = isMobile ? preview.mobileUrl || preview.desktopUrl : preview.desktopUrl;
  const activePath = isMobile ? preview.mobilePath || preview.desktopPath : preview.desktopPath;
  const activeType = isMobile ? preview.mobileType || preview.desktopType : preview.desktopType;
  const usesDesktopFallback = isMobile && !preview.mobileUrl && Boolean(preview.desktopUrl);

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
            altText={preview.altText || preview.title || "Reklamebanner"}
            className={(isMobile ? "aspect-square" : "aspect-[16/6]") + " w-full object-cover"}
            mediaType={activeType}
            path={activePath}
            url={activeUrl}
          />
          {activeUrl && (
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-midnight/55 via-midnight/12 to-transparent" />
          )}
          {activeUrl && (preview.showTitle || (preview.showSponsor && preview.sponsorName)) && (
            <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
              {preview.showTitle && <p className="max-w-2xl text-xl font-semibold leading-tight sm:text-2xl">{preview.title || "Titel på reklame"}</p>}
              {preview.showSponsor && preview.sponsorName && (
                <span className="mt-3 inline-flex rounded-full bg-[#D8C1A2] px-3 py-1 text-xs font-bold uppercase tracking-wide text-midnight shadow-soft">
                  {preview.sponsorName}
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
