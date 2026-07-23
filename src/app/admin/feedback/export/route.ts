import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  await requireRole("admin");
  const surveyId = new URL(request.url).searchParams.get("survey");

  if (!surveyId) {
    return NextResponse.json({ error: "Survey missing" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: survey, error } = await supabase
    .from("feedback_surveys")
    .select("title, feedback_responses(id, source, respondent_name, respondent_email, submitted_at, feedback_answers(question_text_snapshot, question_type, rating_value, text_value, boolean_value, option_value, rating_comment))")
    .eq("id", surveyId)
    .maybeSingle();

  if (error || !survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  const rows = [
    ["submitted_at", "source", "name", "email", "question", "type", "answer", "comment"],
    ...((survey.feedback_responses ?? []).flatMap((response) =>
      (response.feedback_answers ?? []).map((answer) => [
        response.submitted_at,
        response.source,
        response.respondent_name ?? "",
        response.respondent_email ?? "",
        answer.question_text_snapshot,
        answer.question_type,
        answer.rating_value ?? answer.option_value ?? (typeof answer.boolean_value === "boolean" ? (answer.boolean_value ? "Ja" : "Nej") : answer.text_value) ?? "",
        answer.rating_comment ?? "",
      ]),
    )),
  ];

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const fileName =
    "feedback-" +
    survey.title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) +
    ".csv";

  return new NextResponse("\uFEFF" + csv, {
    headers: {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
