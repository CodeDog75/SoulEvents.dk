/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Heart, MessageCircle, Sparkles } from "lucide-react";
import { submitFeedbackResponseAction } from "@/app/feedback/[token]/actions";
import { BrandLogo } from "@/components/brand-logo";
import { feedbackQuestionTypeLabels } from "@/lib/feedback";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PublicFeedbackPageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ source?: string; status?: string }>;
};

function statusMessage(status: string | undefined) {
  if (status === "closed") return "Dette spørgeskema er ikke længere aktivt.";
  if (status === "missing_contact") return "Skriv navn og en gyldig e-mailadresse, før du sender.";
  if (status === "missing_answer") return "Besvar de obligatoriske spørgsmål, før du sender.";
  if (status === "error") return "Din feedback kunne ikke gemmes lige nu. Prøv igen om lidt.";
  return null;
}

function RatingLabels() {
  return (
    <div className="mt-3 grid gap-1 text-xs leading-5 text-ink/58 sm:grid-cols-5">
      <span>1-2 · Meget dårlig</span>
      <span>3-4 · Kunne være bedre</span>
      <span>5-6 · Okay</span>
      <span>7-8 · God</span>
      <span>9-10 · Helt fantastisk</span>
    </div>
  );
}

export default async function PublicFeedbackPage({ params, searchParams }: PublicFeedbackPageProps) {
  const [{ token }, { source, status }] = await Promise.all([params, searchParams]);
  const supabase = createAdminClient();
  const { data: survey } = await supabase
    .from("feedback_surveys")
    .select("id, token, title, introduction, response_mode, status, final_question_enabled, final_question_text, feedback_questions(*)")
    .eq("token", token)
    .maybeSingle();

  if (!survey) {
    notFound();
  }

  const message = statusMessage(status);
  const isActive = survey.status === "active";
  const questions = [...(survey.feedback_questions ?? [])].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return (
    <main className="min-h-screen bg-[#FAF6EF] px-4 py-6 text-[#2F2633] sm:px-6 sm:py-10">
      <section className="mx-auto max-w-3xl rounded-[32px] border border-[#E5D9EE] bg-white p-5 shadow-soft sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link className="inline-flex items-center gap-3" href="/">
            <BrandLogo className="size-16" />
            <span>
              <span className="block text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">SoulEvents.dk</span>
              <span className="block text-sm text-ink/62">Feedback Center</span>
            </span>
          </Link>
          <Link className="inline-flex min-h-10 items-center gap-2 rounded-full border border-midnight/10 bg-[#FAF6EF] px-4 text-sm font-semibold text-midnight" href="/">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Forsiden
          </Link>
        </div>

        <div className="mt-8 rounded-[28px] bg-[#FAF6EF] p-6 sm:p-8">
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#7A4EAB] shadow-soft">
            <Sparkles className="size-4" aria-hidden="true" />
            Feedback
          </p>
          <h1 className="mt-5 font-serif text-4xl font-semibold leading-tight text-midnight sm:text-5xl">{survey.title}</h1>
          {survey.introduction ? (
            <p className="mt-4 whitespace-pre-line text-base leading-7 text-ink/70">{survey.introduction}</p>
          ) : (
            <p className="mt-4 text-base leading-7 text-ink/70">
              Tak fordi du vil hjælpe os med at gøre SoulEvents endnu bedre.
            </p>
          )}
        </div>

        {message ? (
          <div className="mt-5 rounded-[20px] border border-[#E8B8BC] bg-[#FFF3F3] p-4 text-sm font-semibold text-[#8A3342]">
            {message}
          </div>
        ) : null}

        {!isActive ? (
          <div className="mt-6 rounded-[22px] bg-[#FAF6EF] p-6 text-center">
            <Heart className="mx-auto size-8 text-[#7A4EAB]" aria-hidden="true" />
            <h2 className="mt-4 text-2xl font-semibold text-midnight">Spørgeskemaet er lukket</h2>
            <p className="mt-2 text-sm leading-6 text-ink/64">Tak fordi du kiggede forbi. Dette spørgeskema tager ikke imod flere svar.</p>
          </div>
        ) : (
          <form action={submitFeedbackResponseAction} className="mt-7 grid gap-5">
            <input name="token" type="hidden" value={survey.token} />
            <input name="source" type="hidden" value={source === "homepage" ? "homepage" : "direct"} />

            {survey.response_mode === "named" ? (
              <section className="grid gap-4 rounded-[24px] border border-midnight/10 bg-white p-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-midnight">
                  Navn
                  <input className="min-h-12 rounded-md border border-midnight/15 px-4 text-base outline-none transition focus:border-[#7A4EAB]" name="respondent_name" required />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-midnight">
                  E-mail
                  <input className="min-h-12 rounded-md border border-midnight/15 px-4 text-base outline-none transition focus:border-[#7A4EAB]" name="respondent_email" required type="email" />
                </label>
              </section>
            ) : null}

            {questions.map((question: any) => (
              <fieldset className="rounded-[24px] border border-midnight/10 bg-[#FAF6EF] p-5" key={question.id}>
                <legend className="text-base font-semibold text-midnight">
                  {question.question_text}
                  {question.is_required ? <span className="text-[#7A4EAB]"> *</span> : null}
                </legend>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink/45">
                  {feedbackQuestionTypeLabels[question.question_type as keyof typeof feedbackQuestionTypeLabels]}
                </p>

                {question.question_type === "rating" ? (
                  <>
                    <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10">
                      {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                        <label className="grid min-h-12 cursor-pointer place-items-center rounded-[14px] border border-midnight/10 bg-white text-sm font-semibold text-midnight transition hover:border-[#7A4EAB]" key={value}>
                          <input className="sr-only peer" name={`answer_${question.id}`} required={question.is_required} type="radio" value={value} />
                          <span className="grid size-full place-items-center rounded-[14px] peer-checked:bg-[#7A4EAB] peer-checked:text-white">{value}</span>
                        </label>
                      ))}
                    </div>
                    <RatingLabels />
                    {question.rating_comment_enabled ? (
                      <label className="mt-4 grid gap-2 text-sm font-semibold text-midnight">
                        Har du lyst til at uddybe dit svar?
                        <textarea className="min-h-24 rounded-md border border-midnight/15 bg-white px-4 py-3 text-base outline-none transition focus:border-[#7A4EAB]" name={`rating_comment_${question.id}`} />
                      </label>
                    ) : null}
                  </>
                ) : null}

                {question.question_type === "free_text" ? (
                  <textarea className="mt-4 min-h-32 w-full rounded-md border border-midnight/15 bg-white px-4 py-3 text-base outline-none transition focus:border-[#7A4EAB]" name={`answer_${question.id}`} required={question.is_required} />
                ) : null}

                {question.question_type === "yes_no" ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["yes", "Ja"],
                      ["no", "Nej"],
                    ].map(([value, label]) => (
                      <label className="grid min-h-14 cursor-pointer place-items-center rounded-[16px] border border-midnight/10 bg-white text-base font-semibold text-midnight transition hover:border-[#7A4EAB]" key={value}>
                        <input className="sr-only peer" name={`answer_${question.id}`} required={question.is_required} type="radio" value={value} />
                        <span className="grid size-full place-items-center rounded-[16px] peer-checked:bg-[#7A4EAB] peer-checked:text-white">{label}</span>
                      </label>
                    ))}
                  </div>
                ) : null}

                {question.question_type === "multiple_choice" ? (
                  <div className="mt-4 grid gap-3">
                    {(Array.isArray(question.options) ? question.options : []).map((option: string) => (
                      <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-[16px] border border-midnight/10 bg-white px-4 text-base font-semibold text-midnight transition hover:border-[#7A4EAB]" key={option}>
                        <input className="size-4 accent-[#7A4EAB]" name={`answer_${question.id}`} required={question.is_required} type="radio" value={option} />
                        {option}
                      </label>
                    ))}
                  </div>
                ) : null}
              </fieldset>
            ))}

            {survey.final_question_enabled ? (
              <label className="grid gap-2 rounded-[24px] border border-midnight/10 bg-[#FAF6EF] p-5 text-base font-semibold text-midnight">
                {survey.final_question_text || "Er der andet du synes vi bør vide?"}
                <textarea className="min-h-32 rounded-md border border-midnight/15 bg-white px-4 py-3 text-base outline-none transition focus:border-[#7A4EAB]" name="final_answer" />
              </label>
            ) : null}

            <button className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[#7A4EAB] px-6 text-base font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-[#6B429D]" type="submit">
              <Check className="size-5" aria-hidden="true" />
              Send feedback
            </button>
            <p className="text-center text-xs leading-5 text-ink/50">
              Din besvarelse bruges kun til at forbedre SoulEvents.
            </p>
          </form>
        )}

        <div className="mt-8 flex items-center justify-center gap-2 text-sm font-semibold text-ink/60">
          <MessageCircle className="size-4 text-[#7A4EAB]" aria-hidden="true" />
          Tak fordi du deler dine erfaringer.
        </div>
      </section>
    </main>
  );
}
