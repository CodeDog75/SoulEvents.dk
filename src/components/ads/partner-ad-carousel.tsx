"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";

export type PartnerAd = {
  id: string;
  title: string;
  imageUrl: string | null;
  mobileImageUrl?: string | null;
  altText: string;
  targetUrl: string | null;
  displaySeconds: number;
  sponsorName: string | null;
  showTitle: boolean;
  showSponsor: boolean;
};

type PartnerAdCarouselProps = {
  ads: PartnerAd[];
  className?: string;
};

function safeSeconds(value: number) {
  if (!Number.isFinite(value)) return 10;
  return Math.min(Math.max(value, 10), 30);
}

function isVideoAd(url: string | null) {
  return Boolean(url && /\.mp4($|[?#])/i.test(url));
}

function isExternalUrl(url: string | null) {
  return Boolean(url && /^https?:\/\//i.test(url));
}

function AdMedia({
  altText,
  className,
  shouldLoad,
  url,
}: {
  altText: string;
  className: string;
  shouldLoad: boolean;
  url: string | null;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const hasMediaError = Boolean(url && failedUrl === url);

  if (!shouldLoad || !url || hasMediaError) {
    return <div className="h-full w-full bg-gradient-to-br from-[#2F2633] via-[#7A4EAB] to-[#D8A7B1]" />;
  }

  if (isVideoAd(url)) {
    return <video autoPlay className={className} loop muted onError={() => setFailedUrl(url)} playsInline preload="none" src={url} />;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={altText} className={className} decoding="async" loading="lazy" onError={() => setFailedUrl(url)} src={url} />;
}

export function PartnerAdCarousel({ ads, className = "" }: PartnerAdCarouselProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [fadingIndex, setFadingIndex] = useState<number | null>(null);
  const [isDesktopMedia, setIsDesktopMedia] = useState<boolean | null>(null);
  const [shouldLoadMedia, setShouldLoadMedia] = useState(false);
  const [paused, setPaused] = useState(false);
  const visibleAds = useMemo(() => ads, [ads]);
  const safeActiveIndex = visibleAds.length > 0 ? activeIndex % visibleAds.length : 0;
  const safeFadingIndex = fadingIndex === null || visibleAds.length === 0 ? null : fadingIndex % visibleAds.length;
  const activeAd = visibleAds[safeActiveIndex] ?? visibleAds[0];

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const updateMediaVariant = () => setIsDesktopMedia(query.matches);

    updateMediaVariant();
    query.addEventListener("change", updateMediaVariant);

    return () => query.removeEventListener("change", updateMediaVariant);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || shouldLoadMedia) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoadMedia(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [shouldLoadMedia]);

  useEffect(() => {
    if (paused || visibleAds.length <= 1 || !activeAd) return;
    const delay = safeSeconds(activeAd.displaySeconds) * 1000;
    const timer = window.setTimeout(() => {
      setFadingIndex(safeActiveIndex);
      setActiveIndex((current) => (current + 1) % visibleAds.length);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [activeAd, paused, safeActiveIndex, visibleAds.length]);

  useEffect(() => {
    if (safeFadingIndex === null) return;
    const timer = window.setTimeout(() => {
      setFadingIndex(null);
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [safeFadingIndex]);

  if (!activeAd) return null;

  const opensInNewTab = isExternalUrl(activeAd.targetUrl);
  const slideIndexes = Array.from(new Set([safeFadingIndex, safeActiveIndex].filter((index): index is number => index !== null)));

  const content = (
    <article
      className="group relative overflow-hidden rounded-[18px] border border-[#EDE4F7] bg-[#F6F1E7] shadow-soft transition hover:shadow-lift"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative aspect-square bg-[#F6F1E7] lg:aspect-[8/3]">
        {slideIndexes.map((index) => {
          const ad = visibleAds[index];
          if (!ad) return null;
          const isActive = index === safeActiveIndex;
          const mobileMediaUrl = ad.mobileImageUrl || ad.imageUrl;
          const mediaUrl = isDesktopMedia ? ad.imageUrl : mobileMediaUrl;
          const mediaClass = !isDesktopMedia && !ad.mobileImageUrl
            ? "h-full w-full object-contain object-center"
            : "h-full w-full object-cover object-center";

          return (
            <div
              aria-hidden={!isActive}
              className={"absolute inset-0 transition-opacity duration-1000 ease-in-out " + (isActive ? "opacity-100" : "opacity-0")}
              key={ad.id}
            >
              <div className="absolute inset-0">
                <AdMedia altText={ad.altText} className={mediaClass} shouldLoad={shouldLoadMedia && isDesktopMedia !== null} url={mediaUrl} />
              </div>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#2F2633]/48 via-transparent to-transparent lg:bg-gradient-to-r lg:from-[#2F2633]/62 lg:via-[#2F2633]/18 lg:to-transparent" />
              <div className="absolute inset-x-0 bottom-0 px-5 pb-4 pt-12 sm:p-7">
                {ad.showTitle && (
                  <h2 className="max-w-2xl font-serif text-xl font-semibold leading-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.45)] sm:text-4xl">
                    {ad.title}
                  </h2>
                )}
                {ad.showSponsor && ad.sponsorName && (
                  <p className="mt-3 inline-flex max-w-full items-center rounded-full bg-[#D8C1A2]/95 px-3 py-1.5 text-xs font-bold text-[#2F2633] shadow-soft ring-1 ring-white/55 sm:text-sm">
                    {ad.sponsorName}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        {activeAd.targetUrl && (
          <span className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-white/88 text-[#7A4EAB] shadow-soft transition group-hover:bg-white sm:right-4 sm:top-4 sm:size-11">
            <ExternalLink className="size-4" aria-hidden="true" />
          </span>
        )}
      </div>
      {visibleAds.length > 1 && (
        <div className="absolute bottom-4 right-4 flex gap-1.5" aria-label="Partnerindhold">
          {visibleAds.map((ad, index) => (
            <span
              className={index === safeActiveIndex ? "h-2 w-6 rounded-full bg-white" : "size-2 rounded-full bg-white/55"}
              key={ad.id}
            />
          ))}
        </div>
      )}
    </article>
  );

  return (
    <section className={className} aria-label="Partnerindhold fra SoulEvents.dk" ref={sectionRef}>
      {activeAd.targetUrl ? (
        <a aria-label={"Se partnerindhold: " + activeAd.title} href={"/ads/" + activeAd.id + "/click"} rel={opensInNewTab ? "noopener noreferrer" : undefined} target={opensInNewTab ? "_blank" : undefined}>
          {content}
        </a>
      ) : (
        content
      )}
    </section>
  );
}
