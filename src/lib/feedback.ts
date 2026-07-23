export const feedbackSurveyStatuses = ["draft", "active", "closed", "archived"] as const;
export const feedbackResponseModes = ["named", "anonymous"] as const;
export const feedbackPlacements = ["link_only", "homepage_link"] as const;
export const feedbackHomepageFrequencies = ["once", "after_30_days", "every_visit"] as const;
export const feedbackQuestionTypes = ["rating", "free_text", "yes_no", "multiple_choice"] as const;

export type FeedbackSurveyStatus = (typeof feedbackSurveyStatuses)[number];
export type FeedbackResponseMode = (typeof feedbackResponseModes)[number];
export type FeedbackPlacement = (typeof feedbackPlacements)[number];
export type FeedbackHomepageFrequency = (typeof feedbackHomepageFrequencies)[number];
export type FeedbackQuestionType = (typeof feedbackQuestionTypes)[number];

export const feedbackQuestionTypeLabels: Record<FeedbackQuestionType, string> = {
  free_text: "Fritekst",
  multiple_choice: "Valgmuligheder",
  rating: "Vurdering 1-10",
  yes_no: "Ja / Nej",
};

export const feedbackSurveyStatusLabels: Record<FeedbackSurveyStatus, string> = {
  active: "Aktiv",
  archived: "Arkiveret",
  closed: "Lukket",
  draft: "Kladde",
};

export const feedbackResponseModeLabels: Record<FeedbackResponseMode, string> = {
  anonymous: "Anonym",
  named: "Med navn",
};

export const feedbackPlacementLabels: Record<FeedbackPlacement, string> = {
  homepage_link: "Forsiden + link",
  link_only: "Kun via link",
};

export const feedbackHomepageFrequencyLabels: Record<FeedbackHomepageFrequency, string> = {
  after_30_days: "Vis igen efter 30 dage",
  every_visit: "Vis ved hvert besøg",
  once: "Vis én gang",
};

export function coerceFeedbackSurveyStatus(value: FormDataEntryValue | null): FeedbackSurveyStatus {
  return feedbackSurveyStatuses.includes(value as FeedbackSurveyStatus) ? (value as FeedbackSurveyStatus) : "draft";
}

export function coerceFeedbackResponseMode(value: FormDataEntryValue | null): FeedbackResponseMode {
  return feedbackResponseModes.includes(value as FeedbackResponseMode) ? (value as FeedbackResponseMode) : "named";
}

export function coerceFeedbackPlacement(value: FormDataEntryValue | null): FeedbackPlacement {
  return feedbackPlacements.includes(value as FeedbackPlacement) ? (value as FeedbackPlacement) : "link_only";
}

export function coerceFeedbackHomepageFrequency(value: FormDataEntryValue | null): FeedbackHomepageFrequency {
  return feedbackHomepageFrequencies.includes(value as FeedbackHomepageFrequency)
    ? (value as FeedbackHomepageFrequency)
    : "once";
}

export function coerceFeedbackQuestionType(value: FormDataEntryValue | null): FeedbackQuestionType {
  return feedbackQuestionTypes.includes(value as FeedbackQuestionType) ? (value as FeedbackQuestionType) : "free_text";
}

export function normalizeFeedbackText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function normalizeFeedbackLongText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export function feedbackPublicPath(token: string) {
  return `/feedback/${encodeURIComponent(token)}`;
}

export function formatFeedbackDateTime(value: string | null | undefined) {
  if (!value) return "Ingen svar endnu";
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
