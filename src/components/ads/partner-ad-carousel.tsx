"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";

type PartnerAd = {
  id: string;
  title: string;
  imageUrl: string | null;
  altText: string;
  targetUrl: string | null;
  displaySeconds: number;
  sponsorName: string | null;
};

type PartnerAdCarouselProps = {
  ads: PartnerAd[];
};

function safeSeconds(value: number) {
  if (!Number.isFinite(value)) return 10;
  return Math.min(Math.max(value, 6), 30);
}

export function PartnerAdCarousel({ ads }: PartnerAdCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const visibleAds = useMemo(() => ads.filter((ad) => ad.imageUrl), [ads]);
  const activeAd = visibleAds[activeIndex] ?? visibleAds[0];

  useEffect(() => {
    if (paused || visibleAds.length <= 1 || !activeAd) return;
    const delay = safeSeconds(activeAd.displaySeconds) * 1000;
    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % visibleAds.length);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [activeAd, paused, visibleAds.length]);

  useEffect(() => {
    if (activeIndex >= visibleAds.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, visibleAds.length]);

  if (!activeAd) return null;

  const content = (
    <article
      className="group relative overflow-hidden rounded-[28px] border border-[#EDE4F7] bg-[#F6F1E7] shadow-soft transition hover:shadow-lift"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative aspect-[16/7] min-h-[180px] sm:aspect-[16/5]">
        <img alt={activeAd.altText} className="h-full w-full object-cover" src={activeAd.imageUrl ?? ""} />
        <div className="absolute inset-0 bg-gradient-to-r from-[#2F2633]/62 via-[#2F2633]/18 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
          <span className="inline-flex rounded-full bg-white/86 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#7A4EAB] shadow-soft">
            Partner
          </span>
          <h2 className="mt-3 max-w-2xl font-serif text-2xl font-semibold leading-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.45)] sm:text-4xl">
            {activeAd.title}
          </h2>
          {activeAd.sponsorName && (
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
              className={index === activeIndex ? "h-2 w-6 rounded-full bg-white" : "size-2 rounded-full bg-white/55"}
              key={ad.id}
            />
          ))}
        </div>
      )}
    </article>
  );

  return (
    <section className="mt-8" aria-label="Partnerindhold fra SoulEvents.dk">
      {activeAd.targetUrl ? (
        <a aria-label={"Se partnerindhold: " + activeAd.title} href={activeAd.targetUrl} rel="noopener noreferrer" target={activeAd.targetUrl.startsWith("http") ? "_blank" : undefined}>
          {content}
        </a>
      ) : (
        content
      )}
    </section>
  );
}
