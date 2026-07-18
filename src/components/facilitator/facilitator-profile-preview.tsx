"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowRight, CircleUserRound, MapPin, X } from "lucide-react";
import { useState } from "react";
import { OrganizerBadges, OrganizerImageBadge, type OrganizerBadgeType } from "@/components/badges/organizer-badges";
import { withFacilitatorMoodImageFallback } from "@/lib/facilitators/mood-image-fallback";

type PreviewCategory = {
  colorHex?: string;
  name: string;
};

type MoodImage = {
  altText?: string | null;
  imagePath: string;
  url: string;
};

type VisibleMoodImage = {
  altText?: string | null;
  imagePath: string;
  url: string;
};

type FacilitatorProfilePreviewProps = {
  badges?: OrganizerBadgeType[];
  categories: PreviewCategory[];
  city?: string | null;
  editHref?: string;
  fullProfileHref?: string | null;
  introText?: string;
  moodImages: MoodImage[];
  profileImageUrl?: string | null;
  profileName: string;
  serviceDescription?: string | null;
  shortDescription?: string | null;
  showStandardMoodImageNotice?: boolean;
  title?: string;
};

const previewTextLimit = 180;

export function FacilitatorProfilePreview({
  badges = [],
  categories,
  city,
  editHref,
  fullProfileHref,
  introText,
  moodImages,
  profileImageUrl,
  profileName,
  serviceDescription,
  shortDescription,
  showStandardMoodImageNotice = false,
  title,
}: FacilitatorProfilePreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeImage, setActiveImage] = useState<VisibleMoodImage | null>(null);
  const hasLongDescription = Boolean(shortDescription && shortDescription.length > previewTextLimit);
  const visibleDescription =
    shortDescription && hasLongDescription && !expanded
      ? `${shortDescription.slice(0, previewTextLimit).trim()}...`
      : shortDescription;
  const moodImageFallback = withFacilitatorMoodImageFallback(moodImages, {
    fallbackAltText: `Stemningsbillede for ${profileName}`,
  });
  const visibleMoodImages = moodImageFallback.images
    .map((image, index) => ({
      altText: image.altText,
      imagePath: ("imagePath" in image ? image.imagePath : null) ?? image.url ?? `standard-stemningsbillede-${index + 1}`,
      url: image.url ?? "",
    }))
    .filter((image) => image.url);

  return (
    <aside className="w-full rounded-card border border-sage-700/15 bg-sage-50 p-5 shadow-soft">
      {title || introText ? (
        <div className="mb-5">
          {title ? <h3 className="font-semibold text-midnight">{title}</h3> : null}
          {introText ? <p className="mt-1 text-sm leading-6 text-ink/65">{introText}</p> : null}
        </div>
      ) : null}

      <div className="relative aspect-square overflow-hidden rounded-card bg-white shadow-soft">
        {badges.includes("experienced") ? (
          <OrganizerImageBadge type="experienced" />
        ) : badges.includes("active") ? (
          <OrganizerImageBadge type="active" />
        ) : null}
        {profileImageUrl ? (
          <img
            alt={`Profilbillede for ${profileName}`}
            className="h-full w-full object-cover"
            src={profileImageUrl}
          />
        ) : (
          <div className="grid h-full place-items-center text-sage-700">
            <CircleUserRound className="size-20" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="mt-4 text-left">
        <h3 className="text-xl font-semibold text-midnight">{profileName}</h3>
        {city ? (
          <p className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-ink/65">
            <MapPin className="size-4 text-sage-700" aria-hidden="true" />
            {city}
          </p>
        ) : null}
        {categories.length > 0 ? (
          <div className="mt-3 flex flex-wrap justify-start gap-2">
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
        {badges.length > 0 ? (
          <div className="mt-3">
            <OrganizerBadges badges={badges} />
          </div>
        ) : null}
        {serviceDescription ? (
          <div className="mt-4 rounded-card border border-[#E5D4F7] bg-white/80 p-3 text-left shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7A4EAB]">Individuelle ydelser</p>
            <p className="mt-2 text-sm leading-6 text-ink/68">{serviceDescription}</p>
          </div>
        ) : null}

        {visibleDescription ? (
          <div className="relative mt-4 text-left text-sm leading-6 text-ink/68">
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

      {visibleMoodImages.length > 0 ? (
        <div className="mt-5 grid gap-3">
          <p className="text-sm font-semibold text-midnight">Stemningsbilleder</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {visibleMoodImages.map((image, index) => (
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
          {moodImageFallback.isUsingFallback && showStandardMoodImageNotice ? (
            <p className="rounded-[18px] border border-[#D8CBE4] bg-[#F1EAF5] px-3 py-2 text-xs font-semibold leading-5 text-[#6E5285]">
              Du bruger i øjeblikket SoulEvents&apos; standardbillede. Upload dine egne stemningsbilleder for at gøre din profil mere personlig.
            </p>
          ) : null}
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

      {fullProfileHref ? (
        <Link
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-button bg-olive px-4 py-3 text-center text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-rose"
          href={fullProfileHref}
        >
          Se profil som gæst
          <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
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
