"use client";

/* eslint-disable @next/next/no-img-element */

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { facilitatorMoodImageSlotCount } from "@/lib/facilitators/mood-image-slots";

type GalleryImage = {
  altText?: string | null;
  imagePath?: string | null;
  url: string;
};

type PublicFacilitatorGalleryProps = {
  actions?: ReactNode;
  images: GalleryImage[];
};

function GalleryTitle({ actions }: { actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#7A5D91]">Stemninger</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight text-[#2F2437] sm:text-4xl">Galleri</h2>
      </div>
      {actions}
    </div>
  );
}

export function PublicFacilitatorGallery({ actions, images }: PublicFacilitatorGalleryProps) {
  const visibleImages = images.slice(0, facilitatorMoodImageSlotCount);
  const desktopSlots = Array.from({ length: facilitatorMoodImageSlotCount }, (_, index) => visibleImages[index] ?? null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeImage = activeIndex === null ? null : visibleImages[activeIndex] ?? null;

  const showPrevious = useCallback(() => {
    setActiveIndex((current) => {
      if (current === null) return current;
      return (current - 1 + visibleImages.length) % visibleImages.length;
    });
  }, [visibleImages.length]);

  const showNext = useCallback(() => {
    setActiveIndex((current) => {
      if (current === null) return current;
      return (current + 1) % visibleImages.length;
    });
  }, [visibleImages.length]);

  useEffect(() => {
    if (activeIndex === null) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowLeft" && visibleImages.length > 1) showPrevious();
      if (event.key === "ArrowRight" && visibleImages.length > 1) showNext();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, showNext, showPrevious, visibleImages.length]);

  if (visibleImages.length === 0) return null;

  return (
    <section className="rounded-[32px] border border-[#E5DDEA] bg-white/82 p-6 shadow-[0_18px_45px_rgba(47,36,55,0.06)] sm:p-8">
      <GalleryTitle actions={actions} />

      <div className="-mx-6 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-6 px-6 pb-2 md:hidden">
        {visibleImages.map((image, index) => (
          <button
            aria-label={`Åbn stemningsbillede ${index + 1}`}
            className="group block min-w-[82%] snap-start overflow-hidden rounded-xl border-2 border-[#E5DDEA] bg-[#F4F0F7] shadow-[0_12px_30px_rgba(47,36,55,0.08)]"
            key={image.imagePath ?? image.url}
            onClick={() => setActiveIndex(index)}
            type="button"
          >
            <img
              alt={image.altText || `Stemningsbillede ${index + 1}`}
              className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.02]"
              src={image.url}
            />
          </button>
        ))}
      </div>

      <div className="mt-6 hidden gap-3 md:grid md:grid-cols-3">
        {desktopSlots.map((image, index) => (
          image ? (
            <button
              aria-label={`Åbn stemningsbillede ${index + 1}`}
              className="group overflow-hidden rounded-xl border-2 border-[#E5DDEA] bg-[#F4F0F7] shadow-[0_12px_30px_rgba(47,36,55,0.08)]"
              key={image.imagePath ?? image.url}
              onClick={() => setActiveIndex(index)}
              type="button"
            >
              <img
                alt={image.altText || `Stemningsbillede ${index + 1}`}
                className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                src={image.url}
              />
            </button>
          ) : (
            <div
              aria-hidden="true"
              className="aspect-[4/3] rounded-xl border-2 border-transparent"
              key={`empty-gallery-slot-${index + 1}`}
            />
          )
        ))}
      </div>

      {activeImage ? (
        <div
          aria-label="Stemningsbillede"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-[#1F1824]/86 px-4 py-8 backdrop-blur-sm"
          onClick={() => setActiveIndex(null)}
          role="dialog"
        >
          <button
            aria-label="Luk galleri"
            className="absolute right-4 top-4 grid size-11 place-items-center rounded-full border border-white/24 bg-white/12 text-white backdrop-blur transition hover:bg-white/20"
            onClick={() => setActiveIndex(null)}
            type="button"
          >
            <X className="size-5" aria-hidden="true" />
          </button>

          {visibleImages.length > 1 ? (
            <button
              aria-label="Forrige billede"
              className="absolute left-4 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/24 bg-white/12 text-white backdrop-blur transition hover:bg-white/20"
              onClick={(event) => {
                event.stopPropagation();
                showPrevious();
              }}
              type="button"
            >
              <ChevronLeft className="size-6" aria-hidden="true" />
            </button>
          ) : null}

          <img
            alt={activeImage.altText || `Stemningsbillede ${(activeIndex ?? 0) + 1}`}
            className="max-h-[86vh] max-w-full rounded-2xl object-contain shadow-[0_30px_90px_rgba(0,0,0,0.35)]"
            onClick={(event) => event.stopPropagation()}
            src={activeImage.url}
          />

          {visibleImages.length > 1 ? (
            <button
              aria-label="Næste billede"
              className="absolute right-4 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/24 bg-white/12 text-white backdrop-blur transition hover:bg-white/20"
              onClick={(event) => {
                event.stopPropagation();
                showNext();
              }}
              type="button"
            >
              <ChevronRight className="size-6" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
