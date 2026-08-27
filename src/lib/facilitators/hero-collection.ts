export type ResolvedFacilitatorBanner = {
  altText: string;
  isFallback: boolean;
  objectPositionDesktop: string;
  objectPositionMobile: string;
  url: string;
};

export const defaultFacilitatorBannerImage = {
  altText: "Varmt SoulEvents standardbanner",
  imagePath: "/images/facilitator-default-banner.svg",
  objectPositionDesktop: "center center",
  objectPositionMobile: "center center",
};

export function resolveFacilitatorBanner(input: {
  bannerImagePath?: string | null;
  bannerImageUrl?: string | null;
  fallbackAltText?: string;
  resolveImagePath?: (path: string) => string | null;
}): ResolvedFacilitatorBanner {
  const bannerImageUrl =
    input.bannerImageUrl?.trim() ||
    (input.bannerImagePath
      ? input.resolveImagePath?.(input.bannerImagePath)
      : null);

  if (bannerImageUrl) {
    return {
      altText: input.fallbackAltText ?? "Arrangørens bannerbillede",
      isFallback: false,
      objectPositionDesktop: "center 25%",
      objectPositionMobile: "center center",
      url: bannerImageUrl,
    };
  }

  return {
    altText: input.fallbackAltText ?? defaultFacilitatorBannerImage.altText,
    isFallback: true,
    objectPositionDesktop: defaultFacilitatorBannerImage.objectPositionDesktop,
    objectPositionMobile: defaultFacilitatorBannerImage.objectPositionMobile,
    url: defaultFacilitatorBannerImage.imagePath,
  };
}
