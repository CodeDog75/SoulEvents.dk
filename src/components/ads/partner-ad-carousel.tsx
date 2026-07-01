"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";

export type PartnerAd = {
  id: string;
  title: string;
  imageUrl: string | null;
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

export function PartnerAdCarousel({ ads, className = "" }: PartnerAdCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const visibleAds = useMemo(() => ads, [ads]);
  const safeActiveIndex = visibleAds.length > 0 ? activeIndex % visibleAds.length : 0;
  const activeAd = visibleAds[safeActiveIndex] ?? visibleAds[0];

  useEffect(() => {
    if (paused || visibleAds.length <= 1 || !activeAd) return;
    const delay = safeSeconds(activeAd.displaySeconds) * 1000;
    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % visibleAds.length);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [activeAd, paused, visibleAds.length]);

  if (!activeAd) return null;

  const opensInNewTab = isExternalUrl(activeAd.targetUrl);

  const content = (
    <article
      className="group relative overflow-hidden rounded-[18px] border border-[#EDE4F7] bg-[#F6F1E7] shadow-soft transition hover:shadow-lift"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative aspect-[16/7] min-h-[180px] sm:aspect-[16/5]">
        {activeAd.imageUrl && isVideoAd(activeAd.imageUrl) ? (
          <video
            autoPlay
            className="h-full w-full object-cover"
            loop
            muted
            playsInline
            src={activeAd.imageUrl}
          />
        ) : activeAd.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={activeAd.altText} className="h-full w-full object-cover" src={activeAd.imageUrl} />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#2F2633] via-[#7A4EAB] to-[#D8A7B1]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#2F2633]/62 via-[#2F2633]/18 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
          {activeAd.showTitle && (
            <h2 className="max-w-2xl font-serif text-2xl font-semibold leading-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.45)] sm:text-4xl">
              {activeAd.title}
            </h2>
          )}
          {activeAd.showSponsor && activeAd.sponsorName && (
            <p className="mt-2 text-sm font-semibold text-white/88 drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]">
              {activeAd.sponsorName}
            </p>
          )}
        </div>
        {activeAd.targetUrl && (
          <span className="absolute right-4 top-4 inline-flex size-11 items-center justify-center rounded-full bg-white/88 text-[#7A4EAB] shadow-soft transition group-hover:bg-white">
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
    <section className={className} aria-label="Partnerindhold fra SoulEvents.dk">
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
