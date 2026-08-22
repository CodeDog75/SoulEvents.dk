import Link from "next/link";
import { ArrowLeft, MailPlus, ShieldCheck } from "lucide-react";
import {
  saveFacilitatorInvitationTemplateAction,
  savePotentialFacilitatorContactAction,
  sendFacilitatorInvitationTestAction,
  sendPotentialFacilitatorInvitationAction,
  suppressPotentialFacilitatorContactAction,
} from "@/app/admin/newsletters/invitations/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { FacilitatorInvitationEditor } from "@/components/admin/newsletters/facilitator-invitation-editor";
import { requireRole } from "@/lib/auth/roles";
import {
  defaultInvitationBody,
  defaultInvitationButtonLabel,
  defaultInvitationButtonUrl,
  defaultInvitationPreheader,
  defaultInvitationSignoff,
  defaultInvitationSubject,
} from "@/lib/newsletters/facilitator-invitation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ contact?: string; message?: string }>;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Ikke sendt";
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusLabel(value: string | null | undefined) {
  if (value === "invited") return "Invitation sendt";
  if (value === "replied") return "Har svaret";
  if (value === "declined") return "Nej tak";
  if (value === "no_contact") return "Må ikke kontaktes";
  return "Ikke sendt";
}

export default async function AdminFacilitatorInvitationsPage({ searchParams }: PageProps) {
  const [{ contact: selectedContactId, message }] = await Promise.all([searchParams, requireRole("admin")]);
  const supabase = createAdminClient();
  const [
    { data: template },
    { data: contacts },
    { data: selectedContact },
    { count: suppressionCount },
  ] = await Promise.all([
    supabase
      .from("potential_facilitator_invitation_templates")
      .select("id, subject, preheader, body, button_label, button_url, signoff")
      .eq("is_default", true)
      .maybeSingle(),
    supabase
      .from("potential_facilitator_contacts")
      .select("id, name, email, company, invitation_status, invitation_sent_at, no_contact_at, registered_at")
      .order("updated_at", { ascending: false })
      .limit(30),
    selectedContactId
      ? supabase
          .from("potential_facilitator_contacts")
          .select("id, name, email, company, contact_source, lawful_contact_basis, lawful_contact_confirmed_at, invitation_status, invitation_sent_at, response_notes, no_contact_at")
          .eq("id", selectedContactId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("potential_facilitator_invitation_suppressions")
      .select("email", { count: "exact", head: true }),
  ]);

  return (
    <main className="min-h-screen bg-[#fbfaf7] text-ink">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-[#7A4EAB] text-white">
              <MailPlus className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Administrator</p>
              <h1 className="text-xl font-semibold text-midnight">Invitationsmails</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight" href="/admin/newsletters">
              Nyhedsmails
            </Link>
            <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight" href="/admin">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Til admin
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[19rem_minmax(0,1fr)] lg:px-8">
        <aside className="grid h-fit gap-4">
          <section className="rounded-md border border-midnight/10 bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-midnight">Potentielle arrangører</h2>
              <Link className="text-sm font-semibold text-[#7A4EAB]" href="/admin/newsletters/invitations">
                Ny
              </Link>
            </div>
            <p className="mt-2 text-xs leading-5 text-ink/58">{suppressionCount ?? 0} e-mails er permanent undertrykt.</p>
            <div className="mt-4 grid gap-2">
              {(contacts ?? []).map((contact) => (
                <Link
                  className={`rounded-[18px] border p-3 text-sm transition ${contact.id === selectedContactId ? "border-[#7A4EAB] bg-[#F7F2FB]" : "border-midnight/10 bg-white hover:border-[#D8CBE4]"}`}
                  href={`/admin/newsletters/invitations?contact=${contact.id}`}
                  key={contact.id}
                >
                  <span className="block truncate font-semibold text-midnight">{contact.name}</span>
                  <span className="mt-1 block truncate text-xs text-ink/55">{contact.email}</span>
                  <span className="mt-1 block text-xs font-semibold text-sage-700">{statusLabel(contact.invitation_status)}</span>
                </Link>
              ))}
              {!contacts?.length ? <p className="text-sm leading-6 text-ink/64">Ingen potentielle arrangører endnu.</p> : null}
            </div>
          </section>
        </aside>

        <section className="grid gap-5">
          <AuthMessage message={message} variant={message?.includes("ikke") || message?.includes("kunne") ? "notice" : "success"} />

          <form action={saveFacilitatorInvitationTemplateAction}>
            <FacilitatorInvitationEditor
              initialBody={template?.body ?? defaultInvitationBody}
              initialButtonLabel={template?.button_label ?? defaultInvitationButtonLabel}
              initialButtonUrl={template?.button_url ?? defaultInvitationButtonUrl}
              initialPreheader={template?.preheader ?? defaultInvitationPreheader}
              initialSignoff={template?.signoff ?? defaultInvitationSignoff}
              initialSubject={template?.subject ?? defaultInvitationSubject}
              templateId={template?.id ?? null}
            />
            <div className="mt-5 flex flex-wrap items-end gap-3">
              <label className="grid gap-2 text-sm font-semibold text-midnight">
                Testmailadresse
                <input className="h-11 rounded-md border border-midnight/15 bg-white px-3" name="test_email" placeholder="test@soulevents.dk" type="email" />
              </label>
              <button className="inline-flex h-11 items-center rounded-md bg-midnight px-5 text-sm font-semibold text-white" type="submit">
                Gem standardskabelon
              </button>
              <button className="inline-flex h-11 items-center rounded-md border border-[#D8CBE4] bg-white px-5 text-sm font-semibold text-[#7A4EAB]" formAction={sendFacilitatorInvitationTestAction} type="submit">
                Send test af aktuel tekst
              </button>
            </div>
          </form>

          <section className="grid gap-5 lg:grid-cols-2">
            <form action={savePotentialFacilitatorContactAction} className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
              <input name="contact_id" type="hidden" value={selectedContact?.id ?? ""} />
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-sage-700">Modtager</p>
              <h2 className="mt-1 text-xl font-semibold text-midnight">{selectedContact ? "Rediger potentiel arrangør" : "Ny potentiel arrangør"}</h2>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-2 text-sm font-semibold text-midnight">
                  Navn
                  <input className="h-11 rounded-md border border-midnight/15 bg-white px-3" name="name" required defaultValue={selectedContact?.name ?? ""} />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-midnight">
                  E-mail
                  <input className="h-11 rounded-md border border-midnight/15 bg-white px-3" name="email" required type="email" defaultValue={selectedContact?.email ?? ""} />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-midnight">
                  Virksomhed
                  <input className="h-11 rounded-md border border-midnight/15 bg-white px-3" name="company" defaultValue={selectedContact?.company ?? ""} />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-midnight">
                  Kilde til kontakten
                  <textarea className="min-h-24 rounded-md border border-midnight/15 bg-white p-3 text-sm leading-6" name="contact_source" required defaultValue={selectedContact?.contact_source ?? ""} />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-midnight">
                  Grundlag for kontakt
                  <textarea className="min-h-28 rounded-md border border-midnight/15 bg-white p-3 text-sm leading-6" name="lawful_contact_basis" required defaultValue={selectedContact?.lawful_contact_basis ?? ""} />
                </label>
                <label className="flex gap-3 rounded-[18px] border border-[#D8CBE4] bg-[#F7F2FB] p-3 text-sm font-semibold text-midnight">
                  <input className="mt-1 size-4" name="lawful_contact_confirmed" type="checkbox" defaultChecked={Boolean(selectedContact?.lawful_contact_confirmed_at)} />
                  <span>Jeg bekræfter, at SoulEvents har lov til at kontakte denne person via e-mail.</span>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-midnight">
                  Svar eller noter
                  <textarea className="min-h-24 rounded-md border border-midnight/15 bg-white p-3 text-sm leading-6" name="response_notes" defaultValue={selectedContact?.response_notes ?? ""} />
                </label>
              </div>
              <button className="mt-4 inline-flex h-10 items-center rounded-md bg-midnight px-4 text-sm font-semibold text-white" type="submit">
                Gem kontakt
              </button>
            </form>

            <section className="grid gap-4">
              {selectedContact ? (
                <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-sage-700">Invitation</p>
                  <h2 className="mt-1 text-xl font-semibold text-midnight">{statusLabel(selectedContact.invitation_status)}</h2>
                  <div className="mt-3 rounded-[18px] bg-[#F4F0F7] p-3 text-sm leading-6 text-ink/70">
                    <p>Kontaktgrundlag bekræftet: {selectedContact.lawful_contact_confirmed_at ? formatDate(selectedContact.lawful_contact_confirmed_at) : "Nej"}</p>
                    <p>Invitation sendt: {formatDate(selectedContact.invitation_sent_at)}</p>
                    <p>Nej tak: {selectedContact.no_contact_at ? formatDate(selectedContact.no_contact_at) : "Nej"}</p>
                  </div>

                  {selectedContact.invitation_status !== "no_contact" ? (
                    <form action={sendPotentialFacilitatorInvitationAction} className="mt-4 grid gap-3">
                      <input name="contact_id" type="hidden" value={selectedContact.id} />
                      <label className="grid gap-2 text-sm font-semibold text-midnight">
                        Personlig indledning til denne modtager
                        <textarea className="min-h-24 rounded-md border border-midnight/15 bg-white p-3 text-sm leading-6" name="personal_intro" />
                      </label>
                      <label className="flex gap-3 rounded-[18px] border border-sage-700/20 bg-sage-50 p-3 text-sm font-semibold text-midnight">
                        <input className="mt-1 size-4" name="send_lawful_contact_confirmed" type="checkbox" />
                        <span>Jeg har kontrolleret, at SoulEvents lovligt må sende denne invitation.</span>
                      </label>
                      <button className="inline-flex h-10 w-fit items-center gap-2 rounded-md bg-midnight px-4 text-sm font-semibold text-white" type="submit">
                        <ShieldCheck className="size-4" aria-hidden="true" />
                        Send invitation
                      </button>
                    </form>
                  ) : null}

                  <form action={suppressPotentialFacilitatorContactAction} className="mt-5 grid gap-3 rounded-[18px] border border-red-200 bg-red-50 p-3">
                    <input name="contact_id" type="hidden" value={selectedContact.id} />
                    <label className="grid gap-2 text-sm font-semibold text-red-950">
                      Markér som “må ikke kontaktes igen”
                      <textarea className="min-h-20 rounded-md border border-red-200 bg-white p-3 text-sm leading-6" name="suppression_reason" placeholder="Årsag eller note" />
                    </label>
                    <button className="inline-flex h-10 w-fit items-center rounded-md border border-red-300 bg-white px-4 text-sm font-semibold text-red-800" type="submit">
                      Undertryk permanent
                    </button>
                  </form>
                </section>
              ) : null}
            </section>
          </section>
        </section>
      </section>
    </main>
  );
}
