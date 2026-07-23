/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import {
  Archive,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clipboard,
  Download,
  Edit3,
  Eye,
  Lock,
  Plus,
  XCircle,
} from "lucide-react";
import { saveFeedbackSurveyAction, setFeedbackSurveyStatusAction } from "@/app/admin/feedback/actions";
import { FeedbackCopyLinkButton } from "@/components/admin/feedback-copy-link-button";
import { FeedbackQuestionRow } from "@/components/admin/feedback-question-row";
import { AuthMessage } from "@/components/auth/auth-message";
import { requireRole } from "@/lib/auth/roles";
import {
  feedbackHomepageFrequencyLabels,
  feedbackPlacementLabels,
  feedbackPublicPath,
  feedbackQuestionTypeLabels,
  feedbackResponseModeLabels,
  feedbackSurveyStatusLabels,
  formatFeedbackDateTime,
} from "@/lib/feedback";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AdminFeedbackPageProps = {
  searchParams: Promise<{ edit?: string; message?: string; results?: string }>;
};

function absoluteFeedbackUrl(token: string) {
  const base = env.appUrl || "http://localhost:3001";
  return new URL(feedbackPublicPath(token), base).toString();
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("da-DK").format(value ?? 0);
}

function statusClass(status: string) {
  if (status === "active") return "bg-[#E8F3E4] text-[#4F654A]";
  if (status === "closed") return "bg-[#F8E8E9] text-[#8A3342]";
  if (status === "archived") return "bg-stone-100 text-stone-600";
  return "bg-[#F1EAF5] text-[#7A4EAB]";
}

function SurveyStatusActions({ survey }: { survey: { id: string; status: string } }) {
  const actions = [
    { icon: CheckCircle2, label: "Aktivér", status: "active" },
    { icon: XCircle, label: "Luk", status: "closed" },
    { icon: Archive, label: "Arkivér", status: "archived" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <form action={setFeedbackSurveyStatusAction} key={action.status}>
          <input name="id" type="hidden" value={survey.id} />
          <input name="status" type="hidden" value={action.status} />
          <button
            className="inline-flex min-h-9 items-center gap-2 rounded-full border border-midnight/10 bg-white px-3 text-xs font-semibold text-ink/65 transition hover:border-[#7A4EAB]/40 hover:text-[#7A4EAB] disabled:opacity-45"
            disabled={survey.status === action.status}
            type="submit"
          >
            <action.icon className="size-3.5" aria-hidden="true" />
            {action.label}
          </button>
        </form>
      ))}
    </div>
  );
}

function FeedbackSurveyForm({ survey }: { survey: any | null }) {
  const questions = [...(survey?.feedback_questions ?? [])].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const rows = Array.from({ length: 10 }, (_, index) => questions[index] ?? null);

  return (
    <section className="rounded-[28px] border border-[#D8CBE4] bg-white p-5 shadow-soft sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">
            {survey ? "Rediger spørgeskema" : "Opret spørgeskema"}
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight text-midnight">
            {survey ? survey.title : "Nyt spørgeskema"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/64">
            Version 1 er bevidst enkel: op til 10 spørgsmål, sikkert link og resultater i admin.
          </p>
        </div>
        {survey?.token ? (
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-midnight/10 bg-[#FAF6EF] px-4 text-sm font-semibold text-midnight"
            href={feedbackPublicPath(survey.token)}
            target="_blank"
          >
            <Eye className="size-4" aria-hidden="true" />
            Åbn offentlig formular
          </Link>
        ) : null}
      </div>

      <form action={saveFeedbackSurveyAction} className="mt-7 grid gap-6">
        <input name="id" type="hidden" value={survey?.id ?? ""} />
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-midnight">
            Titel
            <input
              className="min-h-12 rounded-md border border-midnight/15 bg-white px-4 text-base outline-none transition focus:border-[#7A4EAB]"
              defaultValue={survey?.title ?? ""}
              maxLength={140}
              name="title"
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-midnight">
            Status
            <select
              className="min-h-12 rounded-md border border-midnight/15 bg-white px-4 text-base outline-none transition focus:border-[#7A4EAB]"
              defaultValue={survey?.status ?? "draft"}
              name="status"
            >
              <option value="draft">Kladde</option>
              <option value="active">Aktiv</option>
              <option value="closed">Lukket</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-midnight">
            Introduktion
            <textarea
              className="min-h-32 rounded-md border border-midnight/15 bg-white px-4 py-3 text-base outline-none transition focus:border-[#7A4EAB]"
              defaultValue={survey?.introduction ?? ""}
              maxLength={900}
              name="introduction"
              placeholder="Kort tekst der vises før spørgsmålene."
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-midnight">
            Takketekst
            <textarea
              className="min-h-32 rounded-md border border-midnight/15 bg-white px-4 py-3 text-base outline-none transition focus:border-[#7A4EAB]"
              defaultValue={survey?.thank_you_text ?? "Din feedback hjælper os med at gøre SoulEvents endnu bedre."}
              maxLength={500}
              name="thank_you_text"
              required
            />
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <label className="grid gap-2 text-sm font-semibold text-midnight">
            Besvarelse
            <select className="min-h-12 rounded-md border border-midnight/15 bg-white px-4 text-base outline-none transition focus:border-[#7A4EAB]" defaultValue={survey?.response_mode ?? "named"} name="response_mode">
              <option value="named">Med navn</option>
              <option value="anonymous">Anonym</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-midnight">
            Placering
            <select className="min-h-12 rounded-md border border-midnight/15 bg-white px-4 text-base outline-none transition focus:border-[#7A4EAB]" defaultValue={survey?.placement ?? "link_only"} name="placement">
              <option value="link_only">Kun via link</option>
              <option value="homepage_link">Forsiden + link</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-midnight">
            Forsidevisning
            <select className="min-h-12 rounded-md border border-midnight/15 bg-white px-4 text-base outline-none transition focus:border-[#7A4EAB]" defaultValue={survey?.homepage_display_frequency ?? "once"} name="homepage_display_frequency">
              <option value="once">Vis én gang</option>
              <option value="after_30_days">Vis igen efter 30 dage</option>
              <option value="every_visit">Vis ved hvert besøg</option>
            </select>
          </label>
        </div>

        <section className="rounded-[22px] border border-[#D8CBE4] bg-[#FAF6EF] p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Spørgsmål</p>
              <h3 className="mt-1 text-xl font-semibold text-midnight">Op til 10 spørgsmål</h3>
            </div>
            <p className="text-sm text-ink/60">Tomme rækker ignoreres.</p>
          </div>
          <div className="mt-5 grid gap-4">
            {rows.map((question: any | null, index) => (
              <FeedbackQuestionRow index={index} key={question?.id ?? index} question={question} />
            ))}
          </div>
        </section>

        <label className="rounded-[18px] border border-midnight/10 bg-[#FAF6EF] p-4 text-sm font-semibold text-midnight">
          <span className="flex items-center gap-2">
            <input className="size-4 accent-[#7A4EAB]" defaultChecked={survey?.final_question_enabled ?? false} name="final_question_enabled" type="checkbox" />
            Tilføj afsluttende spørgsmål
          </span>
          <input
            className="mt-3 min-h-11 w-full rounded-md border border-midnight/15 bg-white px-3 text-base outline-none transition focus:border-[#7A4EAB]"
            defaultValue={survey?.final_question_text ?? "Er der andet du synes vi bør vide?"}
            name="final_question_text"
          />
        </label>

        <button className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#7A4EAB] px-6 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-[#6B429D] sm:w-fit" type="submit">
          <Plus className="size-4" aria-hidden="true" />
          Gem spørgeskema
        </button>
      </form>
    </section>
  );
}

function ResultsPanel({ survey }: { survey: any | null }) {
  if (!survey) return null;

  const responses = survey.feedback_responses ?? [];
  const answers = responses.flatMap((response: any) => response.feedback_answers ?? []);
  const ratingAnswers = answers.filter((answer: any) => typeof answer.rating_value === "number");
  const average =
    ratingAnswers.length > 0
      ? ratingAnswers.reduce((sum: number, answer: any) => sum + Number(answer.rating_value), 0) / ratingAnswers.length
      : null;
  const distribution = Array.from({ length: 10 }, (_, index) => {
    const value = index + 1;
    return {
      count: ratingAnswers.filter((answer: any) => Number(answer.rating_value) === value).length,
      value,
    };
  });

  return (
    <section className="rounded-[28px] border border-midnight/10 bg-white p-5 shadow-soft sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Resultater</p>
          <h2 className="mt-2 font-serif text-3xl font-semibold text-midnight">{survey.title}</h2>
          <p className="mt-2 text-sm text-ink/60">{formatNumber(responses.length)} svar i alt.</p>
        </div>
        <Link className="inline-flex min-h-10 items-center gap-2 rounded-full border border-midnight/10 bg-[#FAF6EF] px-4 text-sm font-semibold text-midnight" href={`/admin/feedback/export?survey=${survey.id}`}>
          <Download className="size-4" aria-hidden="true" />
          Download CSV
        </Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <article className="rounded-[20px] bg-[#FAF6EF] p-5">
          <p className="text-sm font-semibold text-ink/60">Antal svar</p>
          <p className="mt-2 text-4xl font-semibold text-midnight">{formatNumber(responses.length)}</p>
        </article>
        <article className="rounded-[20px] bg-[#F1EAF5] p-5">
          <p className="text-sm font-semibold text-ink/60">Gennemsnit</p>
          <p className="mt-2 text-4xl font-semibold text-midnight">{average ? average.toFixed(1).replace(".", ",") : "-"}</p>
        </article>
        <article className="rounded-[20px] bg-[#E8F3E4] p-5">
          <p className="text-sm font-semibold text-ink/60">Seneste svar</p>
          <p className="mt-2 text-lg font-semibold text-midnight">{formatFeedbackDateTime(responses[0]?.submitted_at)}</p>
        </article>
      </div>

      {ratingAnswers.length > 0 ? (
        <div className="mt-6 rounded-[20px] border border-midnight/10 bg-white p-4">
          <h3 className="font-semibold text-midnight">Fordeling af vurderinger</h3>
          <div className="mt-4 grid gap-2">
            {distribution.map((item) => (
              <div className="grid grid-cols-[2rem_minmax(0,1fr)_3rem] items-center gap-3 text-sm" key={item.value}>
                <span className="font-semibold text-midnight">{item.value}</span>
                <span className="h-3 overflow-hidden rounded-full bg-[#F1EAF5]">
                  <span className="block h-full rounded-full bg-[#7A4EAB]" style={{ width: `${ratingAnswers.length ? (item.count / ratingAnswers.length) * 100 : 0}%` }} />
                </span>
                <span className="text-right text-ink/60">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4">
        {responses.length === 0 ? (
          <div className="rounded-[20px] bg-[#FAF6EF] p-5 text-sm text-ink/64">Der er endnu ingen svar.</div>
        ) : null}
        {responses.map((response: any) => (
          <article className="rounded-[20px] border border-midnight/10 bg-[#FAF6EF] p-4" key={response.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-midnight">
                {response.respondent_name || "Anonym besvarelse"}
                {response.respondent_email ? <span className="text-ink/55"> · {response.respondent_email}</span> : null}
              </p>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink/60">
                {response.source === "homepage" ? "Forside" : "Direkte link"} · {formatFeedbackDateTime(response.submitted_at)}
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {(response.feedback_answers ?? []).map((answer: any) => (
                <div className="rounded-[14px] bg-white p-3" key={answer.id}>
                  <p className="text-sm font-semibold text-midnight">{answer.question_text_snapshot}</p>
                  <p className="mt-1 whitespace-pre-line text-sm leading-6 text-ink/68">
                    {answer.rating_value ?? answer.option_value ?? (typeof answer.boolean_value === "boolean" ? (answer.boolean_value ? "Ja" : "Nej") : answer.text_value) ?? "-"}
                  </p>
                  {answer.rating_comment ? <p className="mt-2 whitespace-pre-line text-sm text-ink/58">{answer.rating_comment}</p> : null}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default async function AdminFeedbackPage({ searchParams }: AdminFeedbackPageProps) {
  const [{ edit, message, results }] = await Promise.all([searchParams, requireRole("admin")]);
  const supabase = createAdminClient();

  const [{ data: surveys }, { data: editSurvey }, { data: resultSurvey }] = await Promise.all([
    supabase
      .from("feedback_surveys")
      .select("id, token, title, status, response_mode, placement, homepage_display_frequency, created_at, updated_at, feedback_questions(id), feedback_responses(id, submitted_at)")
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
    edit
      ? supabase
          .from("feedback_surveys")
          .select("*, feedback_questions(*)")
          .eq("id", edit)
          .maybeSingle()
          .then((result) => result)
      : Promise.resolve({ data: null }),
    results
      ? supabase
          .from("feedback_surveys")
          .select("*, feedback_responses(*, feedback_answers(*))")
          .eq("id", results)
          .maybeSingle()
          .then((result) => result)
      : Promise.resolve({ data: null }),
  ]);

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-[#7A4EAB] text-white">
              <Clipboard className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Feedback Center</p>
              <h1 className="text-xl font-semibold text-midnight">Spørgeskemaer og svar</h1>
            </div>
          </div>
          <Link className="inline-flex min-h-10 items-center gap-2 rounded-full border border-midnight/10 bg-white px-4 text-sm font-semibold text-midnight" href="/admin">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Admin
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <AuthMessage message={message} />

        <section className="rounded-[28px] border border-midnight/10 bg-white p-5 shadow-soft sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Oversigt</p>
              <h2 className="mt-1 font-serif text-3xl font-semibold text-midnight">Feedback-spørgeskemaer</h2>
            </div>
            <Link className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#7A4EAB] px-5 text-sm font-semibold text-white shadow-soft" href="/admin/feedback#create">
              <Plus className="size-4" aria-hidden="true" />
              Opret spørgeskema
            </Link>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3 text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink/55">
                <tr>
                  <th className="px-3 py-2">Titel</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Spørgsmål</th>
                  <th className="px-3 py-2">Svar</th>
                  <th className="px-3 py-2">Oprettet</th>
                  <th className="px-3 py-2">Seneste svar</th>
                  <th className="px-3 py-2">Handlinger</th>
                </tr>
              </thead>
              <tbody>
                {(surveys ?? []).map((survey: any) => {
                  const responses = survey.feedback_responses ?? [];
                  const latestResponse = [...responses].sort((a: any, b: any) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0];
                  return (
                    <tr className="bg-[#FAF6EF] shadow-soft" key={survey.id}>
                      <td className="rounded-l-[18px] px-3 py-4">
                        <p className="font-semibold text-midnight">{survey.title}</p>
                        <p className="mt-1 text-xs text-ink/55">{feedbackResponseModeLabels[survey.response_mode as keyof typeof feedbackResponseModeLabels]} · {feedbackPlacementLabels[survey.placement as keyof typeof feedbackPlacementLabels]}</p>
                      </td>
                      <td className="px-3 py-4">
                        <span className={"inline-flex rounded-full px-3 py-1 text-xs font-semibold " + statusClass(survey.status)}>
                          {feedbackSurveyStatusLabels[survey.status as keyof typeof feedbackSurveyStatusLabels] ?? survey.status}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-ink/70">{formatNumber(survey.feedback_questions?.length ?? 0)}</td>
                      <td className="px-3 py-4 text-ink/70">{formatNumber(responses.length)}</td>
                      <td className="px-3 py-4 text-ink/70">{formatFeedbackDateTime(survey.created_at)}</td>
                      <td className="px-3 py-4 text-ink/70">{formatFeedbackDateTime(latestResponse?.submitted_at)}</td>
                      <td className="rounded-r-[18px] px-3 py-4">
                        <div className="grid gap-2">
                          <div className="flex flex-wrap gap-2">
                            <Link className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white px-3 text-xs font-semibold text-midnight" href={`/admin/feedback?edit=${survey.id}#editor`}>
                              <Edit3 className="size-3.5" aria-hidden="true" />
                              Rediger
                            </Link>
                            <Link className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white px-3 text-xs font-semibold text-midnight" href={`/admin/feedback?results=${survey.id}#results`}>
                              <BarChart3 className="size-3.5" aria-hidden="true" />
                              Resultater
                            </Link>
                            <FeedbackCopyLinkButton url={absoluteFeedbackUrl(survey.token)} />
                          </div>
                          <p className="break-all text-xs text-ink/52">{absoluteFeedbackUrl(survey.token)}</p>
                          <SurveyStatusActions survey={survey} />
                          {responses.length > 0 ? (
                            <p className="inline-flex items-center gap-1 text-xs font-semibold text-ink/55">
                              <Lock className="size-3.5" aria-hidden="true" />
                              Har svar og arkiveres i stedet for at blive slettet.
                            </p>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {(surveys ?? []).length === 0 ? (
            <div className="mt-6 rounded-[22px] bg-[#FAF6EF] p-6 text-sm leading-6 text-ink/64">
              Der er endnu ingen spørgeskemaer i Feedback Center.
            </div>
          ) : null}
        </section>

        <div id="editor">
          <FeedbackSurveyForm survey={editSurvey} />
        </div>

        <div id="results">
          <ResultsPanel survey={resultSurvey} />
        </div>

        <section className="rounded-[22px] border border-midnight/10 bg-[#FAF6EF] p-5 text-sm leading-6 text-ink/64">
          <p className="font-semibold text-midnight">Isolering i version 1</p>
          <p className="mt-1">
            Feedback Center sender ikke mails, vælger ikke modtagere og er ikke koblet til arrangører, events, bookinger eller notifikationer.
          </p>
          <p className="mt-2">
            Forsidevisningen følger: {Object.values(feedbackHomepageFrequencyLabels).join(", ")}.
          </p>
          <p className="mt-2">
            Spørgsmålstyper: {Object.values(feedbackQuestionTypeLabels).join(", ")}.
          </p>
        </section>
      </div>
    </main>
  );
}
