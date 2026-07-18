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

export function getFacilitatorProfileReadiness(input: FacilitatorProfileReadinessInput) {
  const missing: FacilitatorProfileMissingKey[] = [];
  const shortDescription = input.shortDescription?.trim() ?? "";

  if (!input.fullName?.trim()) missing.push("full_name");
  if (!input.companyName?.trim()) missing.push("company_name");
  if (shortDescription.length < 20) missing.push("short_description");
  if (input.requireLocation && !input.postalCode?.trim()) missing.push("postal_code");
  if (input.requireLocation && !input.city?.trim()) missing.push("city");
  if (!input.categoryIds?.length) missing.push("categories");

  return {
    isComplete: missing.length === 0,
    missing,
  };
}

export type FacilitatorSubmissionReadinessInput = FacilitatorProfileReadinessInput & {
  hasMoodImage?: boolean | null;
  hasProfileImage?: boolean | null;
};

export type FacilitatorSubmissionMissingKey = FacilitatorProfileMissingKey | "mood_image" | "profile_image";

export function getFacilitatorSubmissionReadiness(input: FacilitatorSubmissionReadinessInput) {
  const profileReadiness = getFacilitatorProfileReadiness(input);
  const missing: FacilitatorSubmissionMissingKey[] = [...profileReadiness.missing];

  if (!input.hasProfileImage) missing.push("profile_image");
  if (!input.hasMoodImage) missing.push("mood_image");

  return {
    isComplete: missing.length === 0,
    missing,
  };
}
