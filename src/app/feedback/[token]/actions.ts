"use server";

import { redirect } from "next/navigation";
import { normalizeFeedbackLongText, normalizeFeedbackText } from "@/lib/feedback";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

function feedbackGo(token: string, params: Record<string, string>): never {
  const query = new URLSearchParams(params).toString();
  redirect(`/feedback/${encodeURIComponent(token)}${query ? "?" + query : ""}`);
}

function isValidEmail(value: string) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function submitFeedbackResponseAction(formData: FormData) {
  const token = normalizeFeedbackText(formData.get("token"));
  const source = formData.get("source") === "homepage" ? "homepage" : "direct";

  if (!token) {
    redirect("/");
  }

  const supabase = createAdminClient();
  const { data: survey, error: surveyError } = await supabase
    .from("feedback_surveys")
    .select("id, token, status, response_mode, final_question_enabled, final_question_text, feedback_questions(id, question_text, question_type, is_required, options, rating_comment_enabled, sort_order)")
    .eq("token", token)
    .maybeSingle();

  if (surveyError || !survey || survey.status !== "active") {
    console.error("[feedback-center] public survey lookup failed", {
      code: surveyError?.code,
      message: surveyError?.message,
      tokenFound: Boolean(survey),
    });
    feedbackGo(token, { status: "closed" });
  }

  const questions = [...(survey.feedback_questions ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const respondentName = survey.response_mode === "named" ? normalizeFeedbackText(formData.get("respondent_name")) : "";
  const respondentEmail = survey.response_mode === "named" ? normalizeFeedbackText(formData.get("respondent_email")).toLowerCase() : "";

  if (survey.response_mode === "named" && (!respondentName || !respondentEmail || !isValidEmail(respondentEmail))) {
    feedbackGo(token, { status: "missing_contact" });
  }

  const answers = [];
  for (const question of questions) {
    const key = `answer_${question.id}`;
    const commentKey = `rating_comment_${question.id}`;
    const rawValue = normalizeFeedbackLongText(formData.get(key));
    const ratingComment = normalizeFeedbackLongText(formData.get(commentKey));
    const options = Array.isArray(question.options) ? question.options.map((option) => String(option)) : [];

    if (question.is_required && !rawValue) {
      feedbackGo(token, { status: "missing_answer" });
    }

    if (!rawValue && !ratingComment) continue;

    if (question.question_type === "rating") {
      const ratingValue = Number(rawValue);
      if (!Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 10) {
        feedbackGo(token, { status: "missing_answer" });
      }

      answers.push({
        question_id: question.id,
        question_text_snapshot: question.question_text,
        question_type: question.question_type,
        rating_comment: ratingComment || null,
        rating_value: ratingValue,
      });
    } else if (question.question_type === "yes_no") {
      if (!["yes", "no"].includes(rawValue)) {
        feedbackGo(token, { status: "missing_answer" });
      }

      answers.push({
        boolean_value: rawValue === "yes",
        question_id: question.id,
        question_text_snapshot: question.question_text,
        question_type: question.question_type,
      });
    } else if (question.question_type === "multiple_choice") {
      if (!options.includes(rawValue)) {
        feedbackGo(token, { status: "missing_answer" });
      }

      answers.push({
        option_value: rawValue,
        question_id: question.id,
        question_text_snapshot: question.question_text,
        question_type: question.question_type,
      });
    } else {
      answers.push({
        question_id: question.id,
        question_text_snapshot: question.question_text,
        question_type: question.question_type,
        text_value: rawValue,
      });
    }
  }

  const finalAnswer = normalizeFeedbackLongText(formData.get("final_answer"));
  if (survey.final_question_enabled && finalAnswer) {
    answers.push({
      question_id: null,
      question_text_snapshot: survey.final_question_text || "Er der andet du synes vi bør vide?",
      question_type: "final_text",
      text_value: finalAnswer,
    });
  }

  if (answers.length === 0) {
    feedbackGo(token, { status: "missing_answer" });
  }

  const { data: response, error: responseError } = await supabase
    .from("feedback_responses")
    .insert({
      respondent_email: respondentEmail || null,
      respondent_name: respondentName || null,
      response_identity_hash: null,
      source,
      survey_id: survey.id,
    })
    .select("id")
    .single();

  if (responseError || !response) {
    console.error("[feedback-center] public response insert failed", {
      code: responseError?.code,
      details: responseError?.details,
      hint: responseError?.hint,
      message: responseError?.message,
      surveyId: survey.id,
    });
    feedbackGo(token, { status: "error" });
  }

  const answerPayload = answers.map((answer) => ({
    ...answer,
    response_id: response.id,
  })) as Json[];

  const { error: answersError } = await supabase.from("feedback_answers").insert(answerPayload);

  if (answersError) {
    console.error("[feedback-center] public answers insert failed", {
      code: answersError.code,
      details: answersError.details,
      hint: answersError.hint,
      message: answersError.message,
      responseId: response.id,
      surveyId: survey.id,
    });
    feedbackGo(token, { status: "error" });
  }

  redirect(`/feedback/${encodeURIComponent(token)}/tak`);
}
