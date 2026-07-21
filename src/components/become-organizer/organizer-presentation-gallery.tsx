"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ImageIcon, X } from "lucide-react";

type PresentationCard = {
  alt: string;
  description: string;
  imagePath: string;
  title: string;
};

const presentations: PresentationCard[] = [
  {
    title: "Bliv fundet af de rigtige deltagere",
    description: "Se hvordan en arrangørprofil kan gøre dine events, ydelser og fællesskaber mere synlige på SoulEvents.",
    imagePath: "/facilitator/arrangoer-praesentation-1.png",
    alt: "Informationsgrafik om fordelene ved at blive arrangør på SoulEvents",
  },
  {
    title: "Skab ro omkring dit eventflow",
    description: "En enkel visning af hvordan SoulEvents samler profil, events, tilmeldinger og dialog ét sted.",
    imagePath: "/facilitator/arrangoer-praesentation-2.png",
    alt: "Informationsgrafik om arrangørens eventflow på SoulEvents",
  },
  {
    title: "Del dit virke med tillid",
    description: "Præsenter dit arbejde i et trygt og inspirerende univers, hvor deltagere kan mærke hvem du er.",
    imagePath: "/facilitator/arrangoer-praesentation-3.png",
    alt: "Informationsgrafik om tryg præsentation af arrangører på SoulEvents",
  },
];

function MissingImagePreview() {
  return (
    <div className="grid h-full place-items-center bg-[#F4F0EA] px-5 text-center">
      <div>
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-white text-olive shadow-soft">
          <ImageIcon className="size-6" aria-hidden="true" />
        </span>
        <p className="mt-4 text-sm font-semibold text-olive">Præsentationsbillede</p>
        <p className="mt-1 text-xs leading-5 text-ink/55">Billedfilen kan lægges ind her senere.</p>
      </div>
    </div>
  );
}

function PresentationPreview({ card, priority }: { card: PresentationCard; priority?: boolean }) {
  const [hasImageError, setHasImageError] = useState(false);

  if (hasImageError) {
    return <MissingImagePreview />;
  }

  return (
    <Image
      alt={card.alt}
      className="object-cover object-top transition duration-500 group-hover:scale-[1.02]"
      fill
      onError={() => setHasImageError(true)}
      priority={priority}
      sizes="(min-width: 1024px) 360px, (min-width: 768px) 640px, calc(100vw - 64px)"
      src={card.imagePath}
    />
  );
}

export function OrganizerPresentationGallery() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [missingFullImage, setMissingFullImage] = useState(false);
  const triggerRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeCard = activeIndex === null ? null : presentations[activeIndex] ?? null;

  const closeModal = useCallback(() => {
    const returnFocusIndex = activeIndex;
    setActiveIndex(null);
    setMissingFullImage(false);

    window.requestAnimationFrame(() => {
      if (returnFocusIndex !== null) {
        triggerRefs.current[returnFocusIndex]?.focus();
      }
    });
  }, [activeIndex]);

  useEffect(() => {
    if (!activeCard) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeModal();
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeCard, closeModal]);

  return (
    <section className="rounded-[28px] bg-white p-6 shadow-soft sm:p-8">
      <div className="max-w-[76ch]">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Arrangørprofil</p>
        <h2 className="mt-3 text-3xl font-medium leading-tight text-olive sm:text-4xl">Se fordelene ved SoulEvents</h2>
        <p className="mt-4 text-base leading-8 text-ink/72">
          Få et hurtigt overblik over, hvordan en arrangørprofil kan hjælpe dig med synlighed, tilmeldinger og en rolig præsentation af dit virke.
        </p>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-3">
        {presentations.map((card, index) => (
          <button
            aria-label={`Åbn præsentationen ${card.title}`}
            className="group grid overflow-hidden rounded-[24px] border border-sage-700/12 bg-[#FAF6EF] text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift focus:outline-none focus:ring-4 focus:ring-purple/20"
            key={card.imagePath}
            onClick={() => {
              setMissingFullImage(false);
              setActiveIndex(index);
            }}
            ref={(element) => {
              triggerRefs.current[index] = element;
            }}
            type="button"
          >
            <span className="relative block aspect-[4/5] w-full overflow-hidden bg-sage-50">
              <PresentationPreview card={card} priority={index === 0} />
            </span>
            <span className="grid gap-3 p-5">
              <span className="text-xl font-medium leading-snug text-[#2F2633]">{card.title}</span>
              <span className="text-sm leading-6 text-ink/68">{card.description}</span>
              <span className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-[#7A4EAB]">
                Se hele præsentationen
                <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </span>
          </button>
        ))}
      </div>

      {activeCard ? (
        <div
          aria-label={activeCard.title}
          aria-modal="true"
          className="fixed inset-0 z-[80] bg-[#1F1824]/88 px-4 py-5 backdrop-blur-sm sm:px-8"
          onClick={closeModal}
          role="dialog"
        >
          <button
            aria-label="Luk præsentation"
            className="fixed right-4 top-4 z-[90] grid size-12 place-items-center rounded-full border border-white/20 bg-white text-midnight shadow-lift transition hover:bg-[#FAF6EF] sm:right-8 sm:top-8"
            onClick={closeModal}
            type="button"
          >
            <X className="size-6" aria-hidden="true" />
          </button>

          <div className="mx-auto flex h-full max-w-5xl items-start justify-center overflow-y-auto overscroll-contain rounded-[24px] bg-white p-3 shadow-lift sm:p-5">
            <div
              className="relative w-full"
              onClick={(event) => event.stopPropagation()}
            >
              {missingFullImage ? (
                <div className="grid min-h-[70vh] place-items-center rounded-[20px] bg-[#FAF6EF] px-6 text-center">
                  <div>
                    <span className="mx-auto grid size-16 place-items-center rounded-full bg-white text-olive shadow-soft">
                      <ImageIcon className="size-7" aria-hidden="true" />
                    </span>
                    <h3 className="mt-5 text-2xl font-medium text-olive">{activeCard.title}</h3>
                    <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink/65">
                      Billedfilen er ikke lagt ind endnu. Når grafikken tilføjes i projektet, vises den automatisk her.
                    </p>
                  </div>
                </div>
              ) : (
                <Image
                  alt={activeCard.alt}
                  className="h-auto w-full rounded-[20px]"
                  height={1800}
                  onError={() => setMissingFullImage(true)}
                  priority
                  sizes="(min-width: 1024px) 960px, calc(100vw - 56px)"
                  src={activeCard.imagePath}
                  width={900}
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
