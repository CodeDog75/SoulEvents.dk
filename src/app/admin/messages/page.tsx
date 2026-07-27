/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import Image from "next/image";
import { Archive, ArrowLeft, Inbox, Search, Send } from "lucide-react";
import {
  archiveFacilitatorAdminMessageAction,
  sendAdminMessageToFacilitatorAction,
} from "@/app/admin/facilitators/actions";
import { AdminClearConversationAction, AdminMessageRemoveAction } from "@/components/admin/admin-message-actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { requireRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AdminMessagesPageProps = {
  searchParams: Promise<{ body?: string; box?: string; facilitator?: string; message?: string; q?: string; return_to?: string; subject?: string }>;
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

function normalizeSearchValue(value: string | number | boolean | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}@.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function mailboxHref(box: Mailbox, queryText: string) {
  const params = new URLSearchParams();
  if (box !== "inbox") params.set("box", box);
  if (queryText.trim()) params.set("q", queryText.trim());
  const queryString = params.toString();
  return "/admin/messages" + (queryString ? "?" + queryString : "");
}

function selectedFacilitatorHref(facilitatorId: string, queryText?: string) {
  const params = new URLSearchParams({ facilitator: facilitatorId });
  if (queryText?.trim()) params.set("q", queryText.trim());
  return "/admin/messages?" + params.toString();
}

function messageTypeLabel(type: string) {
  if (type === "closure_request") return "Lukning";
  if (type === "admin_reply") return "Sendt";
  return "Besked";
}

function mailboxFilter(item: any, box: Mailbox) {
  if (box === "sent") {
    return item.type === "admin_reply";
  }

  if (box === "archive") {
    return ["message", "closure_request"].includes(item.type) && item.status === "handled";
  }

  return ["message", "closure_request"].includes(item.type) && ["unread", "read"].includes(item.status);
}

function matchesSearch(item: any, queryText: string) {
  if (!queryText) return true;

  const facilitator = item.facilitator_profiles;
  const profile = item.profiles;
  const searchableText = [
    item.subject,
    item.message,
    item.type,
    item.status,
    facilitator?.company_name,
    facilitator?.host_reference_id,
    facilitator?.city,
    facilitator?.id,
    facilitator?.profile_id,
    profile?.full_name,
    profile?.email,
  ]
    .filter(Boolean)
    .join(" ");
  return normalizeSearchValue(searchableText).includes(queryText);
}

function facilitatorName(facilitator: any, profile?: any) {
  return facilitator?.company_name || profile?.full_name || "Arrangør";
}

function avatarUrl(supabase: ReturnType<typeof createAdminClient>, facilitator: any) {
  return facilitator?.profile_image_path
    ? supabase.storage.from("media").getPublicUrl(facilitator.profile_image_path).data.publicUrl
    : null;
}

function messagePreview(message: string | null | undefined) {
  const text = (message ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "Ingen beskedtekst";
  return text.length > 90 ? text.slice(0, 90) + "..." : text;
}

function messageTone(item: any) {
  if (item.type === "closure_request") return "bg-red-100 text-red-800";
  if (item.type === "admin_reply") return "bg-sage-50 text-sage-700";
  return "bg-[#F6EFFF] text-[#7A4EAB]";
}

async function searchFacilitatorIds(supabase: ReturnType<typeof createAdminClient>, queryText: string) {
  if (!queryText) return [] as string[];

  const sanitizedQuery = queryText.replace(/[(),]/g, " ").trim();
  if (!sanitizedQuery) return [] as string[];

  const likeQuery = "%" + sanitizedQuery + "%";
  const [profileResult, facilitatorResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id")
      .or(`full_name.ilike.${likeQuery},email.ilike.${likeQuery}`)
      .limit(20),
    supabase
      .from("facilitator_profiles")
      .select("id")
      .or(`company_name.ilike.${likeQuery},city.ilike.${likeQuery},host_reference_id.ilike.${likeQuery}`)
      .limit(20),
  ]);

  const profileIds = (profileResult.data ?? []).map((profile: any) => profile.id).filter(Boolean);
  const profileFacilitatorResult = profileIds.length
    ? await supabase.from("facilitator_profiles").select("id").in("profile_id", profileIds).limit(20)
    : { data: [] as any[] };
  const exactIds = isUuid(queryText) ? [queryText] : [];

  return [
    ...new Set([
      ...(facilitatorResult.data ?? []).map((facilitator: any) => facilitator.id),
      ...(profileFacilitatorResult.data ?? []).map((facilitator: any) => facilitator.id),
      ...exactIds,
    ].filter(Boolean)),
  ];
}

export default async function AdminMessagesPage({ searchParams }: AdminMessagesPageProps) {
  const [{ body, box, facilitator, message, q, return_to: returnTo, subject }] = await Promise.all([searchParams, requireRole("admin")]);
  const selectedBox = normalizeMailbox(box);
  const selectedFacilitatorId = facilitator ?? "";
  const rawQueryText = (q ?? "").trim();
  const queryText = normalizeSearchValue(rawQueryText);
  const safeReturnTo = returnTo?.startsWith("/admin/users") ? returnTo : "";
  const prefilledBody = (body ?? "").slice(0, 500);
  const prefilledSubject = (subject ?? "").slice(0, 120);
  const supabase = createAdminClient();

  const [{ data: messageRows, error: messagesError }, searchIds] = await Promise.all([
    supabase
      .from("facilitator_admin_messages")
      .select("id, facilitator_id, profile_id, subject, message, type, status, created_at, read_at")
      .is("admin_hidden_at", null)
      .order("created_at", { ascending: false }),
    searchFacilitatorIds(supabase, queryText),
  ]);

  const rows = (messageRows ?? []) as any[];
  const facilitatorIds = [...new Set([...rows.map((item) => item.facilitator_id), selectedFacilitatorId, ...searchIds].filter(Boolean))];
  const directProfileIds = rows.map((item) => item.profile_id).filter(Boolean);

  const { data: facilitators } = facilitatorIds.length
    ? await supabase
        .from("facilitator_profiles")
        .select("id, profile_id, company_name, host_reference_id, city, profile_image_path")
        .in("id", facilitatorIds)
    : { data: [] as any[] };

  const facilitatorById = new Map((facilitators ?? []).map((facilitator: any) => [facilitator.id, facilitator]));
  const profileIds = [
    ...new Set([
      ...directProfileIds,
      ...(facilitators ?? []).map((facilitator: any) => facilitator.profile_id).filter(Boolean),
    ]),
  ];
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", profileIds)
    : { data: [] as any[] };
  const profileById = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));
  const enrichedRows = rows.map((item) => {
    const currentFacilitator = facilitatorById.get(item.facilitator_id) ?? null;
    return {
      ...item,
      facilitator_profiles: currentFacilitator,
      profiles: profileById.get(currentFacilitator?.profile_id ?? item.profile_id) ?? null,
    };
  });
  const selectedFacilitator = selectedFacilitatorId ? facilitatorById.get(selectedFacilitatorId) : null;
  const selectedProfile = selectedFacilitator ? profileById.get(selectedFacilitator.profile_id) : null;
  const searchResults = rawQueryText
    ? (facilitators ?? [])
        .filter((item: any) => {
          const profile = profileById.get(item.profile_id);
          const searchableText = [
            item.company_name,
            item.host_reference_id,
            item.city,
            item.id,
            item.profile_id,
            profile?.full_name,
            profile?.email,
          ]
            .filter(Boolean)
            .join(" ");
          return normalizeSearchValue(searchableText).includes(queryText);
        })
        .slice(0, 10)
    : [];
  const rowsByMailbox: Record<Mailbox, any[]> = {
    inbox: enrichedRows.filter((item) => mailboxFilter(item, "inbox")).filter((item) => matchesSearch(item, queryText)),
    sent: enrichedRows.filter((item) => mailboxFilter(item, "sent")).filter((item) => matchesSearch(item, queryText)),
    archive: enrichedRows.filter((item) => mailboxFilter(item, "archive")).filter((item) => matchesSearch(item, queryText)),
  };
  const counts: Record<Mailbox, number> = {
    inbox: rowsByMailbox.inbox.length,
    sent: rowsByMailbox.sent.length,
    archive: rowsByMailbox.archive.length,
  };
  const messages = rowsByMailbox[selectedBox];
  const conversationMap = new Map<string, { facilitator: any; hasUnread: boolean; latest: any; messages: any[]; profile: any }>();

  for (const item of enrichedRows) {
    if (!item.facilitator_id) continue;
    const currentFacilitator = item.facilitator_profiles ?? facilitatorById.get(item.facilitator_id);
    const currentProfile = profileById.get(currentFacilitator?.profile_id ?? item.profile_id) ?? null;
    const existing = conversationMap.get(item.facilitator_id);
    if (!existing) {
      conversationMap.set(item.facilitator_id, {
        facilitator: currentFacilitator,
        hasUnread: item.type !== "admin_reply" && item.status === "unread",
        latest: item,
        messages: [item],
        profile: currentProfile,
      });
    } else {
      existing.hasUnread = existing.hasUnread || (item.type !== "admin_reply" && item.status === "unread");
      existing.messages.push(item);
    }
  }

  const conversations = Array.from(conversationMap.values()).sort((first, second) => {
    if (first.hasUnread !== second.hasUnread) return first.hasUnread ? -1 : 1;
    return new Date(second.latest.created_at ?? 0).getTime() - new Date(first.latest.created_at ?? 0).getTime();
  });
  const selectedConversationMessages = selectedFacilitatorId
    ? enrichedRows.filter((item) => item.facilitator_id === selectedFacilitatorId)
    : [];
  const errorMessage = messagesError?.message;
  const selectedConversationReturnTo = selectedFacilitatorId
    ? selectedFacilitatorHref(selectedFacilitatorId, rawQueryText)
    : "/admin/messages";

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
        <AuthMessage message={errorMessage ? "Beskeder kunne ikke hentes: " + errorMessage : undefined} variant="error" />

        <section className="grid min-h-[640px] overflow-hidden rounded-[26px] border border-midnight/10 bg-white shadow-soft lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="border-b border-midnight/10 bg-[#FAF7F2] p-4 lg:border-b-0 lg:border-r">
            <form action="/admin/messages" className="grid gap-2">
              <label className="text-sm font-semibold text-midnight" htmlFor="admin-facilitator-search">
                Søg efter arrangør
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/45" aria-hidden="true" />
                <input
                  className="h-11 w-full rounded-md border border-midnight/15 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-sage-700"
                  defaultValue={q ?? ""}
                  id="admin-facilitator-search"
                  name="q"
                  placeholder="Navn, e-mail, by, ID..."
                />
              </div>
            </form>

            {rawQueryText ? (
              <section className="mt-5">
                <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[#7A4EAB]">Søgeresultater</h2>
                <div className="mt-2 grid gap-2">
                  {searchResults.length > 0 ? (
                    searchResults.map((item: any) => {
                      const profile = profileById.get(item.profile_id);
                      const imageUrl = avatarUrl(supabase, item);
                      return (
                        <Link
                          className="flex gap-3 rounded-[16px] border border-midnight/10 bg-white p-3 transition hover:border-[#7A4EAB]"
                          href={selectedFacilitatorHref(item.id, rawQueryText)}
                          key={item.id}
                        >
                          <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-[#F0E9E0] text-sm font-bold text-[#7A4EAB]">
                            {imageUrl ? (
                              <Image alt="" className="size-full object-cover" height={48} src={imageUrl} unoptimized width={48} />
                            ) : (
                              facilitatorName(item, profile).slice(0, 1)
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-midnight">{facilitatorName(item, profile)}</span>
                            <span className="mt-0.5 block truncate text-xs text-ink/55">{profile?.email ?? "E-mail mangler"}</span>
                            <span className="mt-0.5 block truncate text-xs text-ink/45">
                              {[item.city, item.host_reference_id].filter(Boolean).join(" · ") || item.id}
                            </span>
                          </span>
                        </Link>
                      );
                    })
                  ) : (
                    <p className="rounded-[16px] bg-white p-3 text-sm text-ink/60">Ingen arrangører matcher søgningen.</p>
                  )}
                </div>
              </section>
            ) : null}

            <section className="mt-5">
              <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[#7A4EAB]">Seneste samtaler</h2>
              <div className="mt-2 grid gap-2">
                {conversations.length > 0 ? (
                  conversations.map((conversation) => {
                    const facilitatorId = conversation.facilitator?.id ?? conversation.latest.facilitator_id;
                    const active = facilitatorId === selectedFacilitatorId;
                    const imageUrl = avatarUrl(supabase, conversation.facilitator);
                    return (
                      <Link
                        className={
                          active
                            ? "flex gap-3 rounded-[16px] border border-[#7A4EAB] bg-white p-3 shadow-soft"
                            : "flex gap-3 rounded-[16px] border border-midnight/10 bg-white p-3 transition hover:border-[#7A4EAB]"
                        }
                        href={selectedFacilitatorHref(facilitatorId, rawQueryText)}
                        key={facilitatorId}
                      >
                        <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-[#F0E9E0] text-sm font-bold text-[#7A4EAB]">
                          {imageUrl ? (
                            <Image alt="" className="size-full object-cover" height={48} src={imageUrl} unoptimized width={48} />
                          ) : (
                            facilitatorName(conversation.facilitator, conversation.profile).slice(0, 1)
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-midnight">
                              {facilitatorName(conversation.facilitator, conversation.profile)}
                            </span>
                            {conversation.hasUnread ? <span className="size-2 shrink-0 rounded-full bg-[#B56F8A]" /> : null}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-ink/55">{messagePreview(conversation.latest.message)}</span>
                          <span className="mt-0.5 block text-xs text-ink/40">{formatDateTime(conversation.latest.created_at)}</span>
                        </span>
                      </Link>
                    );
                  })
                ) : (
                  <p className="rounded-[16px] bg-white p-3 text-sm text-ink/60">Der er endnu ingen samtaler.</p>
                )}
              </div>
            </section>

            <section className="mt-5">
              <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[#7A4EAB]">Filtre</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {mailboxes.map((item) => {
                  const active = item.value === selectedBox;
                  return (
                    <Link
                      className={
                        active
                          ? "inline-flex items-center gap-2 rounded-full bg-midnight px-3 py-1.5 text-xs font-semibold text-white"
                          : "inline-flex items-center gap-2 rounded-full border border-midnight/10 bg-white px-3 py-1.5 text-xs font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta"
                      }
                      href={mailboxHref(item.value, q ?? "")}
                      key={item.value}
                    >
                      <item.icon className="size-3.5" aria-hidden="true" />
                      {item.label}
                      <span className={active ? "text-white/75" : "text-ink/45"}>{counts[item.value]}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          </aside>

          <section className="grid min-h-[640px] grid-rows-[auto_1fr_auto] bg-white">
            {selectedFacilitator ? (
              <>
                <header className="border-b border-midnight/10 p-5">
                  <Link className="mb-4 inline-flex text-sm font-semibold text-[#7A4EAB] lg:hidden" href="/admin/messages">
                    Tilbage til beskeder
                  </Link>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Samtale</p>
                      <h2 className="mt-1 font-serif text-3xl font-semibold text-midnight">
                        {facilitatorName(selectedFacilitator, selectedProfile)}
                      </h2>
                      <p className="mt-1 text-sm text-ink/55">
                        {[selectedProfile?.email, selectedFacilitator.city, selectedFacilitator.host_reference_id].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {safeReturnTo ? (
                      <Link className="inline-flex text-sm font-semibold text-sage-700 hover:text-terracotta" href={safeReturnTo}>
                        Tilbage til arrangøroversigten
                      </Link>
                    ) : null}
                    {selectedConversationMessages.length > 0 ? (
                      <AdminClearConversationAction facilitatorId={selectedFacilitatorId} returnTo="/admin/messages" />
                    ) : null}
                  </div>
                </header>

                <div className="space-y-3 overflow-y-auto p-5">
                  {selectedConversationMessages.length > 0 ? (
                    selectedConversationMessages.map((item: any) => {
                      const isAdminMessage = item.type === "admin_reply";
                      return (
                        <article
                          className={
                            isAdminMessage
                              ? "ml-auto max-w-3xl rounded-[20px] border border-sage-700/10 bg-sage-50 p-4"
                              : "max-w-3xl rounded-[20px] border border-[#E5D4F7] bg-[#FAF7F2] p-4"
                          }
                          key={item.id}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={"rounded-full px-3 py-1 text-xs font-semibold " + messageTone(item)}>
                              {messageTypeLabel(item.type)}
                            </span>
                            <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-ink/55">
                              {item.status}
                            </span>
                          </div>
                          <h3 className="mt-3 text-base font-semibold text-midnight">{item.subject}</h3>
                          <p className="mt-1 text-xs font-semibold text-ink/50">
                            {isAdminMessage ? "Sendt " : "Modtaget "}
                            {formatDateTime(item.created_at)}
                          </p>
                          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-ink/72">{item.message}</p>
                          <div className="mt-3 flex flex-wrap items-start gap-2">
                            {!isAdminMessage && item.status !== "handled" ? (
                              <form action={archiveFacilitatorAdminMessageAction}>
                                <input name="message_id" type="hidden" value={item.id} />
                                <button className="inline-flex h-9 items-center justify-center rounded-full border border-midnight/10 bg-white px-4 text-sm font-semibold text-ink/65 transition hover:border-terracotta hover:text-terracotta" type="submit">
                                  Arkivér
                                </button>
                              </form>
                            ) : null}
                            <AdminMessageRemoveAction messageId={item.id} returnTo={selectedConversationReturnTo} />
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-midnight/15 bg-[#FAF7F2] p-6">
                      <h3 className="text-lg font-semibold text-midnight">Ingen tidligere beskeder</h3>
                      <p className="mt-2 text-sm leading-6 text-ink/64">Skriv den første besked til arrangøren nedenfor.</p>
                    </div>
                  )}
                </div>

                <form action={sendAdminMessageToFacilitatorAction} className="grid gap-3 border-t border-midnight/10 bg-[#FAF7F2] p-4">
                  <input name="facilitator_id" type="hidden" value={selectedFacilitatorId} />
                  <input name="return_to" type="hidden" value={"/admin/messages?facilitator=" + selectedFacilitatorId} />
                  <label className="grid gap-2 text-xs font-semibold text-ink/68">
                    Emne
                    <input
                      className="h-10 rounded-md border border-midnight/10 bg-white px-3 text-sm font-normal text-ink outline-none transition focus:border-[#7A4EAB]"
                      maxLength={120}
                      name="subject"
                      required
                      defaultValue={prefilledSubject || "Besked fra SoulEvents administration"}
                    />
                  </label>
                  <label className="grid gap-2 text-xs font-semibold text-ink/68">
                    Besked
                    <textarea
                      className="min-h-28 rounded-md border border-midnight/10 bg-white p-3 text-sm font-normal leading-6 text-ink outline-none transition focus:border-[#7A4EAB]"
                      maxLength={500}
                      name="message"
                      placeholder="Skriv en kort besked til arrangøren."
                      required
                      defaultValue={prefilledBody}
                    />
                  </label>
                  <div className="flex justify-end">
                    <button className="inline-flex h-10 items-center justify-center rounded-full bg-[#7A4EAB] px-4 text-sm font-semibold text-white transition hover:bg-[#62408D]" type="submit">
                      Send besked
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="grid place-items-center p-8 text-center">
                <div className="max-w-md">
                  <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Vælg en samtale</p>
                  <h2 className="mt-2 font-serif text-3xl font-semibold text-midnight">Søg eller vælg en arrangør</h2>
                  <p className="mt-3 text-sm leading-6 text-ink/64">
                    Brug søgningen til at starte en ny samtale, eller vælg en eksisterende samtale i venstre side.
                  </p>
                </div>
              </div>
            )}
          </section>
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
            {messages.slice(0, 20).map((item: any) => {
              const currentFacilitator = item.facilitator_profiles;
              const currentProfile = item.profiles;
              return (
                <Link
                  className="grid gap-2 bg-white p-4 transition hover:bg-[#FAF7F2] sm:grid-cols-[1fr_auto]"
                  href={selectedFacilitatorHref(item.facilitator_id ?? "", rawQueryText)}
                  key={item.id}
                >
                  <span>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={"rounded-full px-3 py-1 text-xs font-semibold " + messageTone(item)}>
                        {messageTypeLabel(item.type)}
                      </span>
                      <span className="rounded-full bg-[#FAF6EF] px-3 py-1 text-xs font-semibold text-ink/55">
                        {item.status}
                      </span>
                    </span>
                    <span className="mt-2 block font-semibold text-midnight">{item.subject}</span>
                    <span className="mt-1 block text-sm text-ink/55">
                      {facilitatorName(currentFacilitator, currentProfile)}
                      {currentFacilitator?.host_reference_id ? " · " + currentFacilitator.host_reference_id : ""}
                      {currentProfile?.email ? " · " + currentProfile.email : ""}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-ink/50">{formatDateTime(item.created_at)}</span>
                </Link>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
