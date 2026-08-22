export const newsletterTargetSegments = ["all", "active", "paused", "onboarding"] as const;
export const newsletterImageLayouts = ["none", "wide", "square"] as const;
export const newsletterImageFocusOptions = ["center", "top", "bottom", "left", "right"] as const;
export const maxNewsletterSections = 12;
export const maxNewsletterImageFileSize = 5 * 1024 * 1024;
export const newsletterImageUploadAccept = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

export type NewsletterTargetSegment = (typeof newsletterTargetSegments)[number];
export type NewsletterImageLayout = (typeof newsletterImageLayouts)[number];
export type NewsletterImageFocus = (typeof newsletterImageFocusOptions)[number];

export type NewsletterSectionInput = {
  body: string;
  buttonLabel: string;
  buttonUrl: string;
  heading: string;
  imageFocus: NewsletterImageFocus;
  imageLayout: NewsletterImageLayout;
  imagePath: string;
};

export function newsletterTargetSegmentLabel(segment: string | null | undefined) {
  if (segment === "active") return "Aktive arrangører";
  if (segment === "paused") return "Arrangører på pause";
  if (segment === "onboarding") return "Arrangører under oprettelse";
  return "Alle arrangører";
}

export function normalizeNewsletterTargetSegment(value: string | null | undefined): NewsletterTargetSegment {
  return newsletterTargetSegments.includes(value as NewsletterTargetSegment) ? value as NewsletterTargetSegment : "all";
}

export function normalizeNewsletterImageLayout(value: string | null | undefined): NewsletterImageLayout {
  return newsletterImageLayouts.includes(value as NewsletterImageLayout) ? value as NewsletterImageLayout : "none";
}

export function normalizeNewsletterImageFocus(value: string | null | undefined): NewsletterImageFocus {
  return newsletterImageFocusOptions.includes(value as NewsletterImageFocus) ? value as NewsletterImageFocus : "center";
}
