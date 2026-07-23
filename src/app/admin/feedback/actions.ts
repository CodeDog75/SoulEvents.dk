"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  coerceFeedbackHomepageFrequency,
  coerceFeedbackPlacement,
  coerceFeedbackQuestionType,
  coerceFeedbackResponseMode,
  coerceFeedbackSurveyStatus,
  normalizeFeedbackLongText,
  normalizeFeedbackText,
  type FeedbackQuestionType,
} from "@/lib/feedback";
import { requireRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

type QuestionInput = {
  id: string | null;
  isRequired: boolean;
  options: string[];
  questionText: string;
  questionType: FeedbackQuestionType;
  ratingCommentEnabled: boolean;
  sortOrder: number;
};

function adminFeedbackGo(message: string, id?: string | null): never {
  const params = new URLSearchParams({ message });
  if (id) params.set("edit", id);
  redirect("/admin/feedback?" + params.toString());
}

function feedbackToken() {
  return randomBytes(24).toString("hex");
}

function readQuestions(formData: FormData) {
  const questions: QuestionInput[] = [];

  for (let index = 0; index < 10; index += 1) {
    const questionText = normalizeFeedbackLongText(formData.get(`question_text_${index}`));
    const existingId = normalizeFeedbackText(formData.get(`question_id_${index}`));
    if (!questionText) continue;

    const questionType = coerceFeedbackQuestionType(formData.get(`question_type_${index}`));
    const options = normalizeFeedbackLongText(formData.get(`question_options_${index}`))
      .split(/\n|,/)
      .map((option) => option.trim())
      .filter(Boolean)
      .slice(0, 6);

    if (questionType === "multiple_choice" && options.length < 2) {
      adminFeedbackGo("Et spørgsmål med valgmuligheder skal have mindst 2 muligheder.", normalizeFeedbackText(formData.get("id")));
    }

    questions.push({
      id: existingId || null,
      isRequired: formData.get(`question_required_${index}`) === "on",
      options,
      questionText,
      questionType,
      ratingCommentEnabled: formData.get(`question_rating_comment_${index}`) === "on",
      sortOrder: questions.length + 1,
    });
  }

  if (questions.length > 10) {
    adminFeedbackGo("Et spørgeskema kan højst have 10 spørgsmål.", normalizeFeedbackText(formData.get("id")));
  }

  return questions;
}

export async function saveFeedbackSurveyAction(formData: FormData) {
  await requireRole("admin");
  const supabase = createAdminClient();
  const existingId = normalizeFeedbackText(formData.get("id"));
  const title = normalizeFeedbackText(formData.get("title"));
  const introduction = normalizeFeedbackLongText(formData.get("introduction"));
  const thankYouText = normalizeFeedbackLongText(formData.get("thank_you_text")) || "Din feedback hjælper os med at gøre SoulEvents endnu bedre.";
  const status = coerceFeedbackSurveyStatus(formData.get("status"));
  const responseMode = coerceFeedbackResponseMode(formData.get("response_mode"));
  const placement = coerceFeedbackPlacement(formData.get("placement"));
  const homepageDisplayFrequency = coerceFeedbackHomepageFrequency(formData.get("homepage_display_frequency"));
  const finalQuestionEnabled = formData.get("final_question_enabled") === "on";
  const finalQuestionText = normalizeFeedbackText(formData.get("final_question_text")) || "Er der andet du synes vi bør vide?";
  const questions = readQuestions(formData);

  if (!title) {
    adminFeedbackGo("Skriv en titel til spørgeskemaet.", existingId);
  }

  if (questions.length === 0) {
    adminFeedbackGo("Tilføj mindst ét spørgsmål.", existingId);
  }

  const payload = {
    final_question_enabled: finalQuestionEnabled,
    final_question_text: finalQuestionText,
    homepage_display_frequency: homepageDisplayFrequency,
    introduction: introduction || null,
    placement,
    response_mode: responseMode,
    status,
    thank_you_text: thankYouText,
    title,
  };

  let surveyId = existingId;
  if (surveyId) {
    const { error } = await supabase.from("feedback_surveys").update(payload).eq("id", surveyId);
    if (error) {
      console.error("[feedback-center] survey update failed", {
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
        surveyId,
      });
      adminFeedbackGo("Spørgeskemaet kunne ikke gemmes.", surveyId);
    }
  } else {
    const { data, error } = await supabase
      .from("feedback_surveys")
      .insert({
        ...payload,
        token: feedbackToken(),
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("[feedback-center] survey insert failed", {
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        message: error?.message,
      });
      adminFeedbackGo("Spørgeskemaet kunne ikke oprettes.");
    }

    surveyId = data.id;
  }

  const existingQuestionIds = questions.map((question) => question.id).filter((id): id is string => Boolean(id));
  const { error: deleteError } = await supabase
    .from("feedback_questions")
    .delete()
    .eq("survey_id", surveyId)
    .not("id", "in", `(${existingQuestionIds.length ? existingQuestionIds.join(",") : "00000000-0000-0000-0000-000000000000"})`);

  if (deleteError) {
    console.error("[feedback-center] stale question delete failed", {
      code: deleteError.code,
      details: deleteError.details,
      hint: deleteError.hint,
      message: deleteError.message,
      surveyId,
    });
    adminFeedbackGo("Spørgsmålene kunne ikke opdateres.", surveyId);
  }

  for (const question of questions) {
    const questionPayload = {
      is_required: question.isRequired,
      options: question.options as Json,
      question_text: question.questionText,
      question_type: question.questionType,
      rating_comment_enabled: question.questionType === "rating" ? question.ratingCommentEnabled : false,
      sort_order: question.sortOrder,
      survey_id: surveyId,
    };

    const result = question.id
      ? await supabase.from("feedback_questions").update(questionPayload).eq("id", question.id).eq("survey_id", surveyId)
      : await supabase.from("feedback_questions").insert(questionPayload);

    if (result.error) {
      console.error("[feedback-center] question save failed", {
        code: result.error.code,
        details: result.error.details,
        hint: result.error.hint,
        message: result.error.message,
        surveyId,
      });
      adminFeedbackGo("Et spørgsmål kunne ikke gemmes.", surveyId);
    }
  }

  revalidatePath("/admin/feedback");
  revalidatePath("/");
  adminFeedbackGo("Spørgeskemaet er gemt.", surveyId);
}

export async function setFeedbackSurveyStatusAction(formData: FormData) {
  await requireRole("admin");
  const id = normalizeFeedbackText(formData.get("id"));
  const status = coerceFeedbackSurveyStatus(formData.get("status"));

  if (!id) {
    adminFeedbackGo("Spørgeskemaet kunne ikke findes.");
  }

  const payload = status === "archived" ? { archived_at: new Date().toISOString(), status } : { archived_at: null, status };
  const supabase = createAdminClient();
  const { error } = await supabase.from("feedback_surveys").update(payload).eq("id", id);

  if (error) {
    console.error("[feedback-center] status update failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
      status,
      surveyId: id,
    });
    adminFeedbackGo("Status kunne ikke opdateres.", id);
  }

  revalidatePath("/admin/feedback");
  revalidatePath("/");
  adminFeedbackGo("Status er opdateret.", id);
}
