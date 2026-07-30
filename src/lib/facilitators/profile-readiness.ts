export type FacilitatorProfileReadinessInput = {
  categoryIds?: string[] | null;
  city?: string | null;
  companyName?: string | null;
  fullName?: string | null;
  postalCode?: string | null;
  requireLocation?: boolean;
  shortDescription?: string | null;
};

export type FacilitatorProfileMissingKey =
  | "categories"
  | "city"
  | "company_name"
  | "full_name"
  | "postal_code"
  | "short_description";

export const facilitatorProfileMissingLabels: Record<FacilitatorProfileMissingKey, string> = {
  categories: "arbejdsområder",
  city: "by",
  company_name: "profilnavn",
  full_name: "navn",
  postal_code: "postnummer",
  short_description: "fortælling",
};

export const facilitatorStoryMinLength = 100;

export function normalizeFacilitatorStory(input: string | null | undefined) {
  return (input ?? "").replace(/\s+/g, " ").trim();
}

export function getFacilitatorProfileReadiness(input: FacilitatorProfileReadinessInput) {
  const missing: FacilitatorProfileMissingKey[] = [];
  const shortDescription = normalizeFacilitatorStory(input.shortDescription);

  if (!input.fullName?.trim()) missing.push("full_name");
  if (!input.companyName?.trim()) missing.push("company_name");
  if (shortDescription.length < facilitatorStoryMinLength) missing.push("short_description");
  if (input.requireLocation && !input.postalCode?.trim()) missing.push("postal_code");
  if (input.requireLocation && !input.city?.trim()) missing.push("city");
  if (!input.categoryIds?.length) missing.push("categories");

  return {
    isComplete: missing.length === 0,
    missing,
  };
}

export type FacilitatorSubmissionReadinessInput = FacilitatorProfileReadinessInput & {
  hasAcceptedRequiredLegalDocuments?: boolean | null;
  hasMoodImage?: boolean | null;
  hasProfileImage?: boolean | null;
};

export type FacilitatorSubmissionMissingKey = FacilitatorProfileMissingKey | "legal_terms" | "mood_image" | "profile_image";

export const facilitatorSubmissionMissingLabels: Record<FacilitatorSubmissionMissingKey, string> = {
  ...facilitatorProfileMissingLabels,
  legal_terms: "arrangørvilkår og retningslinjer",
  mood_image: "stemningsbillede",
  profile_image: "profilbillede",
};

export type FacilitatorSubmissionMissingDisplayItem = {
  label: string;
  tone: "legal" | "neutral";
};

const facilitatorSubmissionMissingDisplayLabels: Record<FacilitatorSubmissionMissingKey, string> = {
  categories: "Mindst ét arbejdsområde",
  city: "Postnummer og by",
  company_name: "Profilnavn",
  full_name: "Navn",
  legal_terms: "Arrangørvilkår ikke accepteret",
  mood_image: "Mindst ét stemningsbillede",
  postal_code: "Postnummer og by",
  profile_image: "Profilbillede",
  short_description: "Fortælling",
};

export function getFacilitatorSubmissionMissingDisplayItems(
  missing: FacilitatorSubmissionMissingKey[],
): FacilitatorSubmissionMissingDisplayItem[] {
  const seenLabels = new Set<string>();
  const items: FacilitatorSubmissionMissingDisplayItem[] = [];

  for (const key of missing) {
    const label = facilitatorSubmissionMissingDisplayLabels[key];
    if (seenLabels.has(label)) continue;
    seenLabels.add(label);
    items.push({
      label,
      tone: key === "legal_terms" ? "legal" : "neutral",
    });
  }

  return items;
}

export function getFacilitatorSubmissionReadiness(input: FacilitatorSubmissionReadinessInput) {
  const profileReadiness = getFacilitatorProfileReadiness(input);
  const missing: FacilitatorSubmissionMissingKey[] = [...profileReadiness.missing];

  if (!input.hasProfileImage) missing.push("profile_image");
  if (!input.hasMoodImage) missing.push("mood_image");
  if (!input.hasAcceptedRequiredLegalDocuments) missing.push("legal_terms");

  return {
    isComplete: missing.length === 0,
    missing,
  };
}
