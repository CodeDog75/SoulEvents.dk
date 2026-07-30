import { getFacilitatorSubmissionReadiness } from "@/lib/facilitators/profile-readiness";
import { getMissingRequiredLegalAcceptances, organizerAcceptanceTypes } from "@/lib/legal/documents";

type SupabaseLike = Parameters<typeof getMissingRequiredLegalAcceptances>[0];

export type FacilitatorOnboardingState = "approved" | "changes_requested" | "disabled" | "onboarding" | "pending_review";

export type FacilitatorStateProfileInput = {
  categoryIds?: string[] | null;
  companyName?: string | null;
  fullName?: string | null;
  hasMoodImage?: boolean | null;
  hasProfileImage?: boolean | null;
  isDisabled?: boolean | null;
  longDescription?: string | null;
  profileId: string;
  shortDescription?: string | null;
  status?: string | null;
};

export async function getFacilitatorOnboardingState(
  supabase: SupabaseLike,
  input: FacilitatorStateProfileInput,
): Promise<FacilitatorOnboardingState> {
  if (input.isDisabled) {
    return "disabled";
  }

  if (input.status === "approved") {
    return "approved";
  }

  if (input.status === "rejected" || input.status === "changes_requested") {
    return "changes_requested";
  }

  if (input.status !== "pending_review" && input.status !== "pending") {
    return "onboarding";
  }

  try {
    const missingLegalAcceptances = await getMissingRequiredLegalAcceptances(
      supabase,
      input.profileId,
      organizerAcceptanceTypes,
    );
    const hasAcceptedRequiredLegalDocuments = missingLegalAcceptances.length === 0;
    const submissionReadiness = getFacilitatorSubmissionReadiness({
      categoryIds: input.categoryIds,
      companyName: input.companyName,
      fullName: input.fullName,
      hasAcceptedRequiredLegalDocuments,
      hasMoodImage: input.hasMoodImage,
      hasProfileImage: input.hasProfileImage,
      shortDescription: input.longDescription || input.shortDescription,
    });

    return submissionReadiness.isComplete ? "pending_review" : "onboarding";
  } catch (error) {
    console.error("Could not determine facilitator onboarding state", {
      message: error instanceof Error ? error.message : "Unknown legal acceptance error",
      profileId: input.profileId,
    });
    return "onboarding";
  }
}

export async function getFacilitatorOnboardingStateForProfile(
  supabase: SupabaseLike,
  input: {
    fullName?: string | null;
    profileId: string;
  },
): Promise<FacilitatorOnboardingState> {
  const { data: facilitatorProfile, error } = await supabase
    .from("facilitator_profiles")
    .select(
      "id, status, is_disabled, company_name, profile_image_path, short_description, long_description, facilitator_categories(category_id), facilitator_images(image_path)",
    )
    .eq("profile_id", input.profileId)
    .maybeSingle();

  if (error || !facilitatorProfile) {
    return "onboarding";
  }

  return getFacilitatorOnboardingState(supabase, {
    categoryIds: facilitatorProfile.facilitator_categories?.map((row: { category_id: string }) => row.category_id) ?? [],
    companyName: facilitatorProfile.company_name,
    fullName: input.fullName,
    hasMoodImage: Boolean(facilitatorProfile.facilitator_images?.length),
    hasProfileImage: Boolean(facilitatorProfile.profile_image_path),
    isDisabled: facilitatorProfile.is_disabled,
    longDescription: facilitatorProfile.long_description,
    profileId: input.profileId,
    shortDescription: facilitatorProfile.short_description,
    status: facilitatorProfile.status,
  });
}
