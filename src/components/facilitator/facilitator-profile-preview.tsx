"use client";

/* eslint-disable @next/next/no-img-element */
import { CircleUserRound, MapPin, X } from "lucide-react";
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
  introText?: string;
  moodImages: MoodImage[];
  profileImageUrl?: string | null;
  profileName: string;
  shortDescription?: string | null;
  title?: string;
};

const previewTextLimit = 180;

export function FacilitatorProfilePreview({
  categories,
  city,
  introText,
  moodImages,
  profileImageUrl,
  profileName,
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
    <aside className="w-full rounded-card border border-sage-700/15 bg-sage-50 p-5 sm:max-w-sm">
      {title || introText ? (
        <div className="mb-5">
          {title ? <h3 className="font-semibold text-midnight">{title}</h3> : null}
          {introText ? <p className="mt-1 text-sm leading-6 text-ink/65">{introText}</p> : null}
        </div>
      ) : null}

      {profileImageUrl ? (
        <img
          alt={`Profilbillede for ${profileName}`}
          className="mx-auto size-[200px] rounded-full border-4 border-rose object-cover shadow-soft"
          src={profileImageUrl}
        />
      ) : (
        <div className="mx-auto grid size-[200px] place-items-center rounded-full border-4 border-rose bg-white text-sage-700 shadow-soft">
          <CircleUserRound className="size-20" aria-hidden="true" />
        </div>
      )}

      <div className="mt-4 text-center">
        <h3 className="text-xl font-semibold text-midnight">{profileName}</h3>
        {city ? (
          <p className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-ink/65">
            <MapPin className="size-4 text-sage-700" aria-hidden="true" />
            {city}
          </p>
        ) : null}
        {categories.length > 0 ? (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
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
        {visibleDescription ? (
          <div className="mt-4 text-sm leading-6 text-ink/68">
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
