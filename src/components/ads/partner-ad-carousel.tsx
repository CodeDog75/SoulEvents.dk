"use client";

import { useEffect, useMemo, useState } from "react";
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
  url,
}: {
  altText: string;
  className: string;
  url: string | null;
}) {
  if (!url) {
    return <div className="h-full w-full bg-gradient-to-br from-[#2F2633] via-[#7A4EAB] to-[#D8A7B1]" />;
  }

  if (isVideoAd(url)) {
    return <video autoPlay className={className} loop muted playsInline src={url} />;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={altText} className={className} src={url} />;
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
  const mobileMediaUrl = activeAd.mobileImageUrl || activeAd.imageUrl;
  const mobileMediaClass = activeAd.mobileImageUrl
    ? "h-full w-full object-cover object-center"
    : "h-full w-full object-contain object-center";

  const content = (
    <article
      className="group relative overflow-hidden rounded-[18px] border border-[#EDE4F7] bg-[#F6F1E7] shadow-soft transition hover:shadow-lift"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative aspect-square bg-[#F6F1E7] lg:aspect-[16/5]">
        <div className="absolute inset-0 lg:hidden">
          <AdMedia altText={activeAd.altText} className={mobileMediaClass} url={mobileMediaUrl} />
        </div>
        <div className="absolute inset-0 hidden lg:block">
          <AdMedia altText={activeAd.altText} className="h-full w-full object-cover object-center" url={activeAd.imageUrl} />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#2F2633]/48 via-transparent to-transparent lg:bg-gradient-to-r lg:from-[#2F2633]/62 lg:via-[#2F2633]/18 lg:to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-5 pb-4 pt-12 sm:p-7">
          {activeAd.showTitle && (
            <h2 className="max-w-2xl font-serif text-xl font-semibold leading-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.45)] sm:text-4xl">
              {activeAd.title}
            </h2>
          )}
          {activeAd.showSponsor && activeAd.sponsorName && (
            <p className="mt-3 inline-flex max-w-full items-center rounded-full bg-[#D8C1A2]/95 px-3 py-1.5 text-xs font-bold text-[#2F2633] shadow-soft ring-1 ring-white/55 sm:text-sm">
              {activeAd.sponsorName}
            </p>
          )}
        </div>
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
