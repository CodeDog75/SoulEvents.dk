"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type EventMediaGalleryItem = {
  alt: string;
  src: string;
  type: "image" | "video";
};

type EventMediaGalleryProps = {
  items: EventMediaGalleryItem[];
};

function previewAspectRatio(ratio: number | undefined) {
  if (!ratio) return "3 / 2";
  if (ratio >= 1.55) return "16 / 9";
  if (ratio >= 1.15) return "3 / 2";
  if (ratio >= 0.9) return "1 / 1";
  return "4 / 5";
}

function isLocalSupabasePublicMediaUrl(src: string) {
  try {
    const url = new URL(src);
    return (url.hostname === "127.0.0.1" || url.hostname === "localhost") && url.pathname.startsWith("/storage/v1/object/public/media/");
  } catch {
    return false;
  }
}

function lightboxFrameStyle(ratio: number | undefined): CSSProperties {
  const fallbackRatio = ratio ?? 16 / 9;

  return {
    aspectRatio: String(fallbackRatio),
    maxWidth: fallbackRatio < 1 ? `min(92vw, calc(86vh * ${fallbackRatio}))` : "72rem",
  };
}

export function EventMediaGallery({ items }: EventMediaGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [mediaRatios, setMediaRatios] = useState<Record<string, number>>({});
  const touchStartX = useRef<number | null>(null);
  const activeItem = activeIndex === null ? null : items[activeIndex] ?? null;
  const activeRatio = activeItem ? mediaRatios[activeItem.src] : undefined;
  const hasMultipleItems = items.length > 1;

  const gridClass = useMemo(() => {
    if (items.length === 1) return "";
    if (items.length === 2) return "sm:grid-cols-2";
    return "sm:grid-cols-2 lg:grid-cols-3";
  }, [items.length]);

  function closeLightbox() {
    setActiveIndex(null);
  }

  function showPrevious() {
    setActiveIndex((currentIndex) => {
      if (currentIndex === null) return currentIndex;
      return (currentIndex - 1 + items.length) % items.length;
    });
  }

  function showNext() {
    setActiveIndex((currentIndex) => {
      if (currentIndex === null) return currentIndex;
      return (currentIndex + 1) % items.length;
    });
  }

  function registerMediaRatio(src: string, width: number, height: number) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return;
    }

    const ratio = width / height;
    setMediaRatios((currentRatios) => (currentRatios[src] === ratio ? currentRatios : { ...currentRatios, [src]: ratio }));
  }

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeLightbox();
      } else if (event.key === "ArrowLeft" && hasMultipleItems) {
        showPrevious();
      } else if (event.key === "ArrowRight" && hasMultipleItems) {
        showNext();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, hasMultipleItems]);

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [activeIndex]);

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <div className={`mt-5 grid gap-4 ${gridClass}`}>
        {items.map((item, index) => (
          <button
            aria-label={item.type === "video" ? `Afspil ${item.alt}` : `Åbn ${item.alt}`}
            className="group relative max-h-[28rem] overflow-hidden rounded-[18px] bg-[#F4F0F7] text-left shadow-soft outline-none ring-offset-2 ring-offset-white transition hover:-translate-y-0.5 hover:shadow-lift focus-visible:ring-2 focus-visible:ring-[#7A5D91] sm:max-h-[22rem]"
            key={item.src}
            onClick={() => setActiveIndex(index)}
            style={{ aspectRatio: previewAspectRatio(mediaRatios[item.src]) }}
            type="button"
          >
            {item.type === "video" ? (
              <>
                <video
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-xl"
                  muted
                  onLoadedMetadata={(event) => {
                    registerMediaRatio(item.src, event.currentTarget.videoWidth, event.currentTarget.videoHeight);
                  }}
                  playsInline
                  preload="metadata"
                  src={item.src}
                  tabIndex={-1}
                />
                <span className="absolute inset-0 bg-midnight/35" />
                <video
                  className="relative h-full w-full object-contain"
                  muted
                  playsInline
                  preload="metadata"
                  src={item.src}
                />
                <span className="absolute inset-0 bg-midnight/10 transition group-hover:bg-midnight/5" />
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid size-16 place-items-center rounded-full bg-white/90 text-[#7A5D91] shadow-lift transition group-hover:scale-105">
                    <Play className="ml-1 size-7 fill-current" aria-hidden="true" />
                  </span>
                </span>
              </>
            ) : (
              <Image
                alt={item.alt}
                className="object-cover transition duration-300 group-hover:scale-[1.03]"
                fill
                onLoad={(event) => {
                  registerMediaRatio(item.src, event.currentTarget.naturalWidth, event.currentTarget.naturalHeight);
                }}
                unoptimized={isLocalSupabasePublicMediaUrl(item.src)}
                sizes={items.length === 1 ? "(min-width: 1024px) 960px, 100vw" : "(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"}
                src={item.src}
              />
            )}
          </button>
        ))}
      </div>

      {activeItem ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-midnight/85 px-4 py-6 backdrop-blur-sm"
          onClick={closeLightbox}
          onTouchEnd={(event) => {
            if (touchStartX.current === null || !hasMultipleItems) return;
            const deltaX = event.changedTouches[0].clientX - touchStartX.current;
            touchStartX.current = null;
            if (Math.abs(deltaX) < 48) return;
            if (deltaX > 0) {
              showPrevious();
            } else {
              showNext();
            }
          }}
          onTouchStart={(event) => {
            touchStartX.current = event.changedTouches[0].clientX;
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Stemningsmedie"
        >
          <button
            aria-label="Luk galleri"
            className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white/92 text-midnight shadow-lift transition hover:bg-white"
            onClick={closeLightbox}
            type="button"
          >
            <X className="size-5" aria-hidden="true" />
          </button>

          {hasMultipleItems ? (
            <>
              <button
                aria-label="Forrige medie"
                className="absolute left-3 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-midnight shadow-lift transition hover:bg-white sm:grid"
                onClick={(event) => {
                  event.stopPropagation();
                  showPrevious();
                }}
                type="button"
              >
                <ChevronLeft className="size-6" aria-hidden="true" />
              </button>
              <button
                aria-label="Næste medie"
                className="absolute right-3 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-midnight shadow-lift transition hover:bg-white sm:grid"
                onClick={(event) => {
                  event.stopPropagation();
                  showNext();
                }}
                type="button"
              >
                <ChevronRight className="size-6" aria-hidden="true" />
              </button>
            </>
          ) : null}

          <div
            className="relative max-h-[86vh] w-full"
            onClick={(event) => event.stopPropagation()}
            style={lightboxFrameStyle(activeRatio)}
          >
            {activeItem.type === "video" ? (
              <video
                autoPlay
                className="h-full w-full rounded-[18px] bg-midnight object-contain shadow-lift"
                controls
                onLoadedMetadata={(event) => {
                  registerMediaRatio(activeItem.src, event.currentTarget.videoWidth, event.currentTarget.videoHeight);
                }}
                playsInline
                preload="metadata"
                src={activeItem.src}
              />
            ) : (
              <Image
                alt={activeItem.alt}
                className="rounded-[18px] object-contain shadow-lift"
                fill
                onLoad={(event) => {
                  registerMediaRatio(activeItem.src, event.currentTarget.naturalWidth, event.currentTarget.naturalHeight);
                }}
                priority
                unoptimized={isLocalSupabasePublicMediaUrl(activeItem.src)}
                sizes="100vw"
                src={activeItem.src}
              />
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
