"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowRight, CircleUserRound, MapPin, X } from "lucide-react";
import { useState } from "react";

type PreviewCategory = {
  colorHex?: string;
  name: string;
};

type MoodImage = {
  altText?: string | null;
  imagePath: string;
  url: string;
};

type FacilitatorProfilePreviewProps = {
  categories: PreviewCategory[];
  city?: string | null;
  editHref?: string;
  introText?: string;
  moodImages: MoodImage[];
  profileImageUrl?: string | null;
  profileName: string;
  serviceDescription?: string | null;
  serviceTitles?: string[];
  shortDescription?: string | null;
  title?: string;
};

const previewTextLimit = 180;

export function FacilitatorProfilePreview({
  categories,
  city,
  editHref,
  introText,
  moodImages,
  profileImageUrl,
  profileName,
  serviceDescription,
  serviceTitles = [],
  shortDescription,
  title,
}: FacilitatorProfilePreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeImage, setActiveImage] = useState<MoodImage | null>(null);
  const hasLongDescription = Boolean(shortDescription && shortDescription.length > previewTextLimit);
  const visibleDescription =
    shortDescription && hasLongDescription && !expanded
      ? `${shortDescription.slice(0, previewTextLimit).trim()}...`
      : shortDescription;

  return (
    <aside className="w-full rounded-card border border-sage-700/15 bg-sage-50 p-5">
      {title || introText ? (
        <div className="mb-5">
          {title ? <h3 className="font-semibold text-midnight">{title}</h3> : null}
          {introText ? <p className="mt-1 text-sm leading-6 text-ink/65">{introText}</p> : null}
        </div>
      ) : null}

      {profileImageUrl ? (
        <img
          alt={`Profilbillede for ${profileName}`}
          className="size-[160px] rounded-full border-4 border-rose object-cover shadow-soft lg:mx-auto sm:size-[200px]"
          src={profileImageUrl}
        />
      ) : (
        <div className="grid size-[160px] place-items-center rounded-full border-4 border-rose bg-white text-sage-700 shadow-soft lg:mx-auto sm:size-[200px]">
          <CircleUserRound className="size-20" aria-hidden="true" />
        </div>
      )}

      <div className="mt-4 text-left lg:text-center">
        <h3 className="text-xl font-semibold text-midnight">{profileName}</h3>
        {city ? (
          <p className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-ink/65">
            <MapPin className="size-4 text-sage-700" aria-hidden="true" />
            {city}
          </p>
        ) : null}
        {categories.length > 0 ? (
          <div className="mt-3 flex flex-wrap justify-start gap-2 lg:justify-center">
            {categories.map((category) => (
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold text-white"
                key={category.name}
                style={{ backgroundColor: category.colorHex || "#97A184" }}
              >
                {category.name}
              </span>
            ))}
          </div>
        ) : null}
        {serviceTitles.length > 0 ? (
          <div className="mt-4 rounded-card border border-[#E5D4F7] bg-white/80 p-3 text-left shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7A4EAB]">Titler og ydelser</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {serviceTitles.map((serviceTitle) => (
                <span
                  className="rounded-full bg-[#EDE4F7] px-3 py-1 text-xs font-semibold text-[#7A4EAB]"
                  key={serviceTitle}
                >
                  {serviceTitle}
                </span>
              ))}
            </div>
            {serviceDescription ? <p className="mt-3 text-sm leading-6 text-ink/68">{serviceDescription}</p> : null}
          </div>
        ) : null}

        {visibleDescription ? (
          <div className="mt-4 text-left text-sm leading-6 text-ink/68 lg:text-center">
            <p>{visibleDescription}</p>
            {hasLongDescription ? (
              <button
                className="mt-2 text-sm font-semibold text-olive underline-offset-4 transition hover:text-rose hover:underline"
                onClick={() => setExpanded((current) => !current)}
                type="button"
              >
                {expanded ? "Vis mindre" : "Læs mere"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {moodImages.length > 0 ? (
        <div className="mt-5 grid gap-3">
          <p className="text-sm font-semibold text-midnight">Stemningsbilleder</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {moodImages.map((image, index) => (
              <button
                className="block overflow-hidden rounded-md border border-white bg-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
                key={image.imagePath}
                onClick={() => setActiveImage(image)}
                type="button"
              >
                <img
                  alt={image.altText || `Stemningsbillede ${index + 1}`}
                  className="aspect-video w-full object-cover"
                  src={image.url}
                />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {editHref ? (
        <Link
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-button border border-[#7A4EAB]/30 bg-white px-4 text-sm font-semibold text-[#7A4EAB] shadow-soft transition hover:bg-[#EDE4F7]"
          href={editHref}
        >
          Ret profil
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}

      {activeImage ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-midnight/75 p-4"
          onClick={() => setActiveImage(null)}
          role="presentation"
        >
          <div className="relative w-full max-w-4xl overflow-hidden rounded-card bg-white shadow-lift">
            <button
              className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-white/90 text-midnight shadow-soft transition hover:bg-white"
              onClick={() => setActiveImage(null)}
              type="button"
            >
              <X className="size-5" aria-label="Luk billede" />
            </button>
            <img
              alt={activeImage.altText || "Stemningsbillede"}
              className="max-h-[82vh] w-full object-contain"
              src={activeImage.url}
            />
          </div>
        </div>
      ) : null}
    </aside>
  );
}
