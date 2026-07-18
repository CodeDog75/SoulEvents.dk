export const defaultFacilitatorMoodImageUrl = "/images/facilitator-heroes/soulevents-mist.svg";

export type FacilitatorMoodImageSource = {
  altText?: string | null;
  imagePath?: string | null;
  sortOrder?: number | null;
  url?: string | null;
};

export type ResolvedFacilitatorMoodImage = {
  altText: string;
  isFallback: boolean;
  url: string;
};

export function resolveFacilitatorMoodImage(
  images: FacilitatorMoodImageSource[],
  options: {
    fallbackAltText?: string;
    resolveImagePath?: (path: string) => string | null;
  } = {},
): ResolvedFacilitatorMoodImage {
  const sortedImages = [...images].sort((first, second) => (first.sortOrder ?? 0) - (second.sortOrder ?? 0));

  for (const image of sortedImages) {
    const url = image.url?.trim() || (image.imagePath && options.resolveImagePath?.(image.imagePath));

    if (url) {
      return {
        altText: image.altText || "Stemningsbillede",
        isFallback: false,
        url,
      };
    }
  }

  return {
    altText: options.fallbackAltText ?? "Roligt SoulEvents naturbillede",
    isFallback: true,
    url: defaultFacilitatorMoodImageUrl,
  };
}

export function withFacilitatorMoodImageFallback(
  images: FacilitatorMoodImageSource[],
  options: {
    fallbackAltText?: string;
    resolveImagePath?: (path: string) => string | null;
  } = {},
) {
  const usableImages = [...images]
    .sort((first, second) => (first.sortOrder ?? 0) - (second.sortOrder ?? 0))
    .filter((image) => image.url?.trim() || (image.imagePath && options.resolveImagePath?.(image.imagePath)));

  if (usableImages.length > 0) {
    return {
      images: usableImages,
      isUsingFallback: false,
    };
  }

  const fallback = resolveFacilitatorMoodImage([], options);

  return {
    images: [fallback],
    isUsingFallback: true,
  };
}
