import { getFacilitatorProfileReadiness } from "@/lib/facilitators/profile-readiness";

const hiddenPublicFacilitatorReferenceIds = new Set(["V101"]);

export type FacilitatorPublicEligibilityInput = {
  categoryIds?: string[] | null;
  city?: string | null;
  companyName?: string | null;
  fullName?: string | null;
  hostReferenceId?: string | null;
  isDisabled?: boolean | null;
  isPaused?: boolean | null;
  postalCode?: string | null;
  profileImagePath?: string | null;
  shortDescription?: string | null;
  status?: string | null;
};

export type FacilitatorPublicEligibilityMissingKey =
  | "approved_status"
  | "categories"
  | "company_name"
  | "full_name"
  | "not_disabled"
  | "not_hidden"
  | "not_paused"
  | "profile_image"
  | "short_description";

export function getFacilitatorPublicEligibility(input: FacilitatorPublicEligibilityInput) {
  const missing: FacilitatorPublicEligibilityMissingKey[] = [];

  if (input.status !== "approved") missing.push("approved_status");
  if (input.isPaused) missing.push("not_paused");
  if (input.isDisabled) missing.push("not_disabled");
  if (hiddenPublicFacilitatorReferenceIds.has(input.hostReferenceId ?? "")) missing.push("not_hidden");
  if (!input.profileImagePath?.trim()) missing.push("profile_image");

  const readiness = getFacilitatorProfileReadiness({
    categoryIds: input.categoryIds,
    city: input.city,
    companyName: input.companyName,
    fullName: input.fullName,
    postalCode: input.postalCode,
    requireLocation: false,
    shortDescription: input.shortDescription,
  });

  for (const key of readiness.missing) {
    if (key === "city" || key === "postal_code") continue;
    missing.push(key);
  }

  return {
    isEligible: missing.length === 0,
    missing,
  };
}

export function isFacilitatorPubliclyEligible(input: FacilitatorPublicEligibilityInput) {
  return getFacilitatorPublicEligibility(input).isEligible;
}
