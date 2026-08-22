import Link from "next/link";
import { ArrowLeft, MailPlus, Play, Send } from "lucide-react";
import {
  processNewsletterBatchAction,
  saveNewsletterDraftAction,
  sendNewsletterNowAction,
  sendNewsletterTestAction,
} from "@/app/admin/newsletters/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { NewsletterEditor } from "@/components/admin/newsletters/newsletter-editor";
import { requireRole } from "@/lib/auth/roles";
import {
  newsletterTargetSegmentLabel,
  normalizeNewsletterImageFocus,
  normalizeNewsletterImageLayout,
  normalizeNewsletterTargetSegment,
  type NewsletterSectionInput,
} from "@/lib/newsletters/facilitator-newsletter";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AdminNewslettersPageProps = {
  searchParams: Promise<{ message?: string; newsletter?: string }>;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Ikke sendt";
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function normalizeSections(sections: Array<Record<string, unknown>> | null | undefined) {
  return (sections ?? []).map((section) => ({
    body: typeof section.body === "string" ? section.body : "",
    buttonLabel: typeof section.button_label === "string" ? section.button_label : "",
    buttonUrl: typeof section.button_url === "string" ? section.button_url : "",
    heading: typeof section.heading === "string" ? section.heading : "",
    imageFocus: normalizeNewsletterImageFocus(typeof section.image_focus === "string" ? section.image_focus : "center"),
    imageLayout: normalizeNewsletterImageLayout(typeof section.image_layout === "string" ? section.image_layout : "none"),
    imagePath: typeof section.image_path === "string" ? section.image_path : "",
  })) satisfies NewsletterSectionInput[];
}

export default async function AdminNewslettersPage({ searchParams }: AdminNewslettersPageProps) {
  const [{ message, newsletter: selectedNewsletterId }] = await Promise.all([searchParams, requireRole("admin")]);
  const supabase = createAdminClient();
  const [
    { data: newsletters },
    { data: selectedNewsletter },
    { data: selectedSections },
    { count: pendingRecipients },
    { count: sentRecipients },
    { count: failedRecipients },
  ] = await Promise.all([
    supabase
      .from("admin_newsletters")
      .select("id, subject, status, target_segment, updated_at, sent_at")
      .order("updated_at", { ascending: false })
      .limit(12),
    selectedNewsletterId
      ? supabase
          .from("admin_newsletters")
          .select("id, subject, preheader, status, target_segment, sent_at, locked_at")
          .eq("id", selectedNewsletterId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    selectedNewsletterId
      ? supabase
          .from("admin_newsletter_sections")
          .select("heading, body, image_path, image_layout, image_focus, button_label, button_url, sort_order")
          .eq("newsletter_id", selectedNewsletterId)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] }),
    selectedNewsletterId
      ? supabase
          .from("admin_newsletter_recipients")
          .select("id", { count: "exact", head: true })
          .eq("newsletter_id", selectedNewsletterId)
          .eq("status", "pending")
      : Promise.resolve({ count: 0 }),
    selectedNewsletterId
      ? supabase
          .from("admin_newsletter_recipients")
          .select("id", { count: "exact", head: true })
          .eq("newsletter_id", selectedNewsletterId)
          .eq("status", "sent")
      : Promise.resolve({ count: 0 }),
    selectedNewsletterId
      ? supabase
          .from("admin_newsletter_recipients")
          .select("id", { count: "exact", head: true })
          .eq("newsletter_id", selectedNewsletterId)
          .eq("status", "failed")
      : Promise.resolve({ count: 0 }),
  ]);
  const canEdit = !selectedNewsletter || selectedNewsletter.status === "draft";

  return (
    <main className="min-h-screen bg-[#fbfaf7] text-ink">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-sage-700 text-white">
              <MailPlus className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Administrator</p>
              <h1 className="text-xl font-semibold text-midnight">Nyhedsmails til arrangører</h1>
            </div>
          </div>
          <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight" href="/admin">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Til admin
          </Link>
          <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-[#D8CBE4] bg-[#F7F2FB] px-3 text-sm font-semibold text-[#7A4EAB]" href="/admin/newsletters/invitations">
            Invitationsmails
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:px-8">
        <aside className="h-fit rounded-md border border-midnight/10 bg-white p-4 shadow-soft">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-midnight">Kladder og historik</h2>
            <Link className="text-sm font-semibold text-[#7A4EAB]" href="/admin/newsletters">
              Ny
            </Link>
          </div>
          <div className="mt-4 grid gap-2">
            {(newsletters ?? []).map((newsletter) => (
              <Link
                className={`rounded-[18px] border p-3 text-sm transition ${newsletter.id === selectedNewsletterId ? "border-[#7A4EAB] bg-[#F7F2FB]" : "border-midnight/10 bg-white hover:border-[#D8CBE4]"}`}
                href={`/admin/newsletters?newsletter=${newsletter.id}`}
                key={newsletter.id}
              >
                <span className="block truncate font-semibold text-midnight">{newsletter.subject || "Uden emne"}</span>
                <span className="mt-1 block text-xs text-ink/55">{newsletterTargetSegmentLabel(newsletter.target_segment)}</span>
                <span className="mt-1 block text-xs font-semibold text-sage-700">{newsletter.status}</span>
              </Link>
            ))}
            {!newsletters?.length ? <p className="text-sm leading-6 text-ink/64">Ingen nyhedsmails endnu.</p> : null}
          </div>
        </aside>

        <section className="grid gap-5">
          <AuthMessage message={message} variant={message?.includes("ikke") || message?.includes("fejl") ? "notice" : "success"} />

          <form action={saveNewsletterDraftAction}>
            {canEdit ? (
              <NewsletterEditor
                initialPreheader={selectedNewsletter?.preheader ?? ""}
                initialSections={normalizeSections(selectedSections as Array<Record<string, unknown>> | null)}
                initialSubject={selectedNewsletter?.subject ?? ""}
                initialTargetSegment={normalizeNewsletterTargetSegment(selectedNewsletter?.target_segment)}
                newsletterId={selectedNewsletter?.id ?? null}
              />
            ) : (
              <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sage-700">Låst nyhedsmail</p>
                <h2 className="mt-2 text-2xl font-semibold text-midnight">{selectedNewsletter?.subject}</h2>
                <p className="mt-2 text-sm leading-6 text-ink/64">
                  Nyhedsmailen er låst, fordi modtagerlisten er fastlagt eller udsendelsen er startet.
                </p>
              </section>
            )}

            {canEdit ? (
              <button className="mt-5 inline-flex h-11 items-center rounded-md bg-midnight px-5 text-sm font-semibold text-white" type="submit">
                Gem som kladde
              </button>
            ) : null}
          </form>

          {selectedNewsletter?.id ? (
            <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-sage-700">Udsendelse</p>
                  <h2 className="mt-1 text-xl font-semibold text-midnight">Test og send</h2>
                  <p className="mt-2 text-sm leading-6 text-ink/64">
                    Modtagerlisten fastlåses, når udsendelsen startes. Drifts-, booking- og sikkerhedsmails påvirkes ikke.
                  </p>
                </div>
                <div className="rounded-[18px] bg-[#F4F0F7] px-4 py-3 text-sm leading-6 text-ink/70">
                  <p>Sendt: {sentRecipients ?? 0}</p>
                  <p>Mangler: {pendingRecipients ?? 0}</p>
                  <p>Fejlet: {failedRecipients ?? 0}</p>
                  <p>Sendt dato: {formatDate(selectedNewsletter.sent_at)}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <form action={sendNewsletterTestAction} className="rounded-[20px] border border-[#D8CBE4] bg-[#F7F2FB] p-4">
                  <input name="newsletter_id" type="hidden" value={selectedNewsletter.id} />
                  <label className="grid gap-2 text-sm font-semibold text-midnight">
                    Testmail
                    <input className="h-11 rounded-md border border-midnight/15 bg-white px-3" name="test_email" placeholder="test@soulevents.dk" required type="email" />
                  </label>
                  <button className="mt-3 inline-flex h-10 items-center gap-2 rounded-md border border-[#D8CBE4] bg-white px-4 text-sm font-semibold text-[#7A4EAB]" type="submit">
                    <Send className="size-4" aria-hidden="true" />
                    Send test
                  </button>
                </form>

                <form action={(pendingRecipients ?? 0) > 0 ? processNewsletterBatchAction : sendNewsletterNowAction} className="rounded-[20px] border border-sage-700/20 bg-sage-50 p-4">
                  <input name="newsletter_id" type="hidden" value={selectedNewsletter.id} />
                  <p className="font-semibold text-midnight">{(pendingRecipients ?? 0) > 0 ? "Fortsæt udsendelse" : "Send nyhedsmail"}</p>
                  <p className="mt-2 text-sm leading-6 text-ink/64">
                    Sender højst 25 mails pr. batch, så udsendelsen kan genoptages sikkert ved fejl.
                  </p>
                  <button className="mt-3 inline-flex h-10 items-center gap-2 rounded-md bg-midnight px-4 text-sm font-semibold text-white" type="submit">
                    <Play className="size-4" aria-hidden="true" />
                    {(pendingRecipients ?? 0) > 0 ? "Send næste batch" : "Start udsendelse"}
                  </button>
                </form>
              </div>
            </section>
          ) : null}
        </section>
      </section>
    </main>
  );
}
