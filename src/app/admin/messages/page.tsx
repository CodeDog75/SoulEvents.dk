/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { Archive, ArrowLeft, Inbox, Search, Send } from "lucide-react";
import { archiveFacilitatorAdminMessageAction, replyToFacilitatorAdminMessageAction } from "@/app/admin/facilitators/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { requireRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AdminMessagesPageProps = {
  searchParams: Promise<{ box?: string; q?: string; message?: string }>;
};

type Mailbox = "inbox" | "sent" | "archive";

const mailboxes: Array<{ label: string; value: Mailbox; icon: typeof Inbox }> = [
  { label: "Indbakke", value: "inbox", icon: Inbox },
  { label: "Sendte", value: "sent", icon: Send },
  { label: "Arkiv", value: "archive", icon: Archive },
];

function normalizeMailbox(value?: string): Mailbox {
  return value === "sent" || value === "archive" ? value : "inbox";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Tidspunkt mangler";
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function mailboxHref(box: Mailbox, queryText: string) {
  const params = new URLSearchParams();
  if (box !== "inbox") params.set("box", box);
  if (queryText.trim()) params.set("q", queryText.trim());
  const queryString = params.toString();
  return "/admin/messages" + (queryString ? "?" + queryString : "");
}

function messageTypeLabel(type: string) {
  if (type === "closure_request") return "Lukning";
  if (type === "admin_reply") return "Sendt svar";
  return "Besked";
}

export default async function AdminMessagesPage({ searchParams }: AdminMessagesPageProps) {
  const [{ box, q, message }] = await Promise.all([searchParams, requireRole("admin")]);
  const selectedBox = normalizeMailbox(box);
  const queryText = (q ?? "").trim().toLowerCase();
  const supabase = createAdminClient();

  let messagesQuery = supabase
    .from("facilitator_admin_messages")
    .select("id, facilitator_id, subject, message, type, status, created_at, read_at, facilitator_read_at, facilitator_profiles(company_name, host_reference_id, profiles(full_name, email))")
    .order("created_at", { ascending: false })
    .limit(queryText ? 300 : 100);

  if (selectedBox === "sent") {
    messagesQuery = messagesQuery.eq("type", "admin_reply");
  } else if (selectedBox === "archive") {
    messagesQuery = messagesQuery.in("type", ["message", "closure_request"]).eq("status", "handled");
  } else {
    messagesQuery = messagesQuery.in("type", ["message", "closure_request"]).in("status", ["unread", "read"]);
  }

  const [
    { data: rows },
    { count: inboxCount },
    { count: sentCount },
    { count: archiveCount },
  ] = await Promise.all([
    messagesQuery,
    supabase.from("facilitator_admin_messages").select("id", { count: "exact", head: true }).in("type", ["message", "closure_request"]).in("status", ["unread", "read"]),
    supabase.from("facilitator_admin_messages").select("id", { count: "exact", head: true }).eq("type", "admin_reply"),
    supabase.from("facilitator_admin_messages").select("id", { count: "exact", head: true }).in("type", ["message", "closure_request"]).eq("status", "handled"),
  ]);

  const counts: Record<Mailbox, number> = {
    inbox: inboxCount ?? 0,
    sent: sentCount ?? 0,
    archive: archiveCount ?? 0,
  };

  const messages = (rows ?? []).filter((item: any) => {
    if (!queryText) return true;
    const facilitator = Array.isArray(item.facilitator_profiles) ? item.facilitator_profiles[0] : item.facilitator_profiles;
    const profile = Array.isArray(facilitator?.profiles) ? facilitator.profiles[0] : facilitator?.profiles;
    return [
      item.subject,
      item.message,
      item.type,
      item.status,
      facilitator?.company_name,
      facilitator?.host_reference_id,
      profile?.full_name,
      profile?.email,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(queryText);
  });

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Administrator</p>
            <h1 className="text-xl font-semibold text-midnight">Beskeder med arrangører</h1>
          </div>
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta"
            href="/admin"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Admin
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <AuthMessage message={message} />

        <section className="rounded-[26px] border border-midnight/10 bg-white p-5 shadow-soft">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Mailindbakke</p>
              <h2 className="mt-2 font-serif text-3xl font-semibold text-midnight">Beskeder fra og til arrangører</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/64">
                Få overblik over nye henvendelser, sendte svar og arkiverede beskeder uden at blande dem ind i dashboardets forside.
              </p>
            </div>
            <form action="/admin/messages" className="grid gap-2 sm:min-w-80">
              {selectedBox !== "inbox" && <input name="box" type="hidden" value={selectedBox} />}
              <label className="text-sm font-semibold text-midnight" htmlFor="admin-message-search">
                Søg beskeder
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/45" aria-hidden="true" />
                <input
                  className="h-11 w-full rounded-md border border-midnight/15 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-sage-700"
                  defaultValue={q ?? ""}
                  id="admin-message-search"
                  name="q"
                  placeholder="Søg arrangør, emne, e-mail eller tekst"
                />
              </div>
            </form>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {mailboxes.map((item) => {
              const active = item.value === selectedBox;
              return (
                <Link
                  className={
                    active
                      ? "inline-flex items-center gap-2 rounded-full bg-midnight px-4 py-2 text-sm font-semibold text-white"
                      : "inline-flex items-center gap-2 rounded-full border border-midnight/10 bg-white px-4 py-2 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta"
                  }
                  href={mailboxHref(item.value, q ?? "")}
                  key={item.value}
                >
                  <item.icon className="size-4" aria-hidden="true" />
                  {item.label}
                  <span className={active ? "text-white/75" : "text-ink/45"}>{counts[item.value]}</span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded-md border border-midnight/10 bg-white shadow-soft">
          <div className="border-b border-midnight/10 px-5 py-4">
            <h2 className="font-semibold text-midnight">
              {selectedBox === "sent" ? "Sendte beskeder" : selectedBox === "archive" ? "Arkiverede beskeder" : "Indbakke"}
            </h2>
            <p className="mt-1 text-sm text-ink/64">
              {messages.length ? `${messages.length} besked${messages.length === 1 ? "" : "er"} vises.` : "Der er ingen beskeder i denne visning."}
            </p>
          </div>

          <div className="divide-y divide-midnight/10">
            {messages.map((item: any) => {
              const facilitator = Array.isArray(item.facilitator_profiles) ? item.facilitator_profiles[0] : item.facilitator_profiles;
              const profile = Array.isArray(facilitator?.profiles) ? facilitator.profiles[0] : facilitator?.profiles;
              const isIncoming = item.type !== "admin_reply";
              return (
                <article className="grid gap-4 bg-white p-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]" key={item.id}>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={item.type === "closure_request" ? "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800" : item.type === "admin_reply" ? "rounded-full bg-sage-50 px-3 py-1 text-xs font-semibold text-sage-700" : "rounded-full bg-[#F6EFFF] px-3 py-1 text-xs font-semibold text-[#7A4EAB]"}>
                        {messageTypeLabel(item.type)}
                      </span>
                      <span className="rounded-full bg-[#FAF6EF] px-3 py-1 text-xs font-semibold text-ink/55">
                        {item.status}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-midnight">{item.subject}</h3>
                    <p className="mt-1 text-sm text-ink/55">
                      {facilitator?.company_name || profile?.full_name || "Arrangør"}
                      {facilitator?.host_reference_id ? " · " + facilitator.host_reference_id : ""}
                      {profile?.email ? " · " + profile.email : ""}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-ink/50">
                      {item.type === "admin_reply" ? "Sendt " : "Modtaget "}
                      {formatDateTime(item.created_at)}
                    </p>
                    <p className="mt-3 whitespace-pre-line text-sm leading-6 text-ink/72">{item.message}</p>
                  </div>

                  {isIncoming && selectedBox !== "archive" ? (
                    <div className="rounded-[18px] border border-[#E5D4F7] bg-[#FAF7F2] p-3">
                      <form action={replyToFacilitatorAdminMessageAction}>
                        <input name="message_id" type="hidden" value={item.id} />
                        <input name="facilitator_id" type="hidden" value={item.facilitator_id ?? ""} />
                        <input name="subject" type="hidden" value={item.subject ?? "Besked fra arrangør"} />
                        <label className="grid gap-2 text-xs font-semibold text-ink/68">
                          Svar til arrangøren
                          <textarea
                            className="min-h-28 rounded-md border border-midnight/10 bg-white p-3 text-sm font-normal leading-6 text-ink outline-none transition focus:border-[#7A4EAB]"
                            maxLength={500}
                            name="message"
                            placeholder="Skriv et kort svar. Arrangøren ser det på sit dashboard."
                            required
                          />
                        </label>
                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                          <button className="inline-flex h-10 items-center justify-center rounded-full bg-[#7A4EAB] px-4 text-sm font-semibold text-white transition hover:bg-[#62408D]" type="submit">
                            Send svar
                          </button>
                        </div>
                      </form>
                      <form action={archiveFacilitatorAdminMessageAction} className="mt-3 flex justify-end">
                        <input name="message_id" type="hidden" value={item.id} />
                        <button className="inline-flex h-9 items-center justify-center rounded-full border border-midnight/10 bg-white px-4 text-sm font-semibold text-ink/65 transition hover:border-terracotta hover:text-terracotta" type="submit">
                          Arkivér
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="rounded-[18px] bg-[#FAF6EF] p-4 text-sm leading-6 text-ink/64">
                      {selectedBox === "archive"
                        ? "Beskeden er arkiveret og bevares som historik."
                        : "Dette er et sendt svar fra SoulEvents administration."}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
