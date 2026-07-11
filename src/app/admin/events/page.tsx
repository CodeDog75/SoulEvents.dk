/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { ArrowLeft, Archive, Check, Clock3, Eye, Search, Slash } from "lucide-react";
import { updateAdminEventStatusAction } from "@/app/admin/events/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { EventStatus } from "@/types/database";

export const dynamic = "force-dynamic";

type AdminEventsPageProps = {
  searchParams: Promise<{ status?: string; q?: string; message?: string }>;
};

const statuses: Array<{ label: string; value: "all" | EventStatus }> = [
  { label: "Alle", value: "all" },
  { label: "Afventer", value: "pending_review" },
  { label: "Publiceret", value: "active" },
  { label: "Udsolgt", value: "sold_out" },
  { label: "Kladde", value: "draft" },
  { label: "Afvist", value: "rejected" },
  { label: "Afholdt", value: "completed" },
  { label: "Arkiveret", value: "archived" },
];

const statusLabels: Record<string, string> = {
  draft: "Kladde",
  pending_review: "Afventer godkendelse",
  active: "Publiceret",
  rejected: "Afvist",
  sold_out: "Udsolgt",
  cancelled: "Aflyst",
  completed: "Afholdt",
  archived: "Arkiveret",
};

const statusClasses: Record<string, string> = {
  draft: "bg-midnight/10 text-midnight",
  pending_review: "bg-terracotta/10 text-terracotta",
  active: "bg-sage-50 text-sage-700",
  rejected: "bg-rose/10 text-rose",
  sold_out: "bg-midnight/10 text-midnight",
  cancelled: "bg-rose/10 text-rose",
  completed: "bg-sand text-midnight",
  archived: "bg-midnight/10 text-midnight",
};

function normalizeStatus(status?: string) {
  return statuses.some((item) => item.value === status) ? (status as "all" | EventStatus) : "pending_review";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Tidspunkt mangler";
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function eventStatusHref(status: "all" | EventStatus, queryText: string) {
  const params = new URLSearchParams();
  if (status !== "pending_review") params.set("status", status);
  if (queryText.trim()) params.set("q", queryText.trim());
  const queryString = params.toString();
  return "/admin/events" + (queryString ? "?" + queryString : "");
}

function EventStatusButton({ eventId, status, children }: { eventId: string; status: EventStatus; children: React.ReactNode }) {
  return (
    <form action={updateAdminEventStatusAction}>
      <input name="event_id" type="hidden" value={eventId} />
      <input name="status" type="hidden" value={status} />
      <button
        className="inline-flex h-9 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
        type="submit"
      >
        {children}
      </button>
    </form>
  );
}

export default async function AdminEventsPage({ searchParams }: AdminEventsPageProps) {
  const [{ status, q, message }] = await Promise.all([searchParams, requireRole("admin")]);
  const selectedStatus = normalizeStatus(status);
  const queryText = (q ?? "").trim().toLowerCase();
  const supabase = await createClient();

  let query = supabase
    .from("events")
    .select("id, title, status, starts_at, created_at, updated_at, city, event_format, facilitator_profiles(status, company_name, profiles(full_name, email)), regions(name), event_categories(categories(name))")
    .order("created_at", { ascending: false })
    .limit(queryText ? 300 : 80);

  if (selectedStatus !== "all") {
    query = query.eq("status", selectedStatus);
  }

  const { data: rows } = await query;
  const eventIds = (rows ?? []).map((event: any) => event.id).filter(Boolean);
  const { data: notificationLogs } = eventIds.length
    ? await (supabase as any)
        .from("event_update_notification_logs")
        .select("event_id, created_at, recipient_count, profiles(full_name)")
        .in("event_id", eventIds)
        .order("created_at", { ascending: false })
    : { data: [] };
  const latestNotificationLogByEventId = new Map<string, any>();

  for (const log of notificationLogs ?? []) {
    if (!latestNotificationLogByEventId.has(log.event_id)) {
      latestNotificationLogByEventId.set(log.event_id, log);
    }
  }

  const events = (rows ?? []).filter((event: any) => {
    if (!queryText) return true;
    const facilitator = Array.isArray(event.facilitator_profiles) ? event.facilitator_profiles[0] : event.facilitator_profiles;
    const profile = Array.isArray(facilitator?.profiles) ? facilitator.profiles[0] : facilitator?.profiles;
    const categories =
      event.event_categories
        ?.map((row: any) => (Array.isArray(row.categories) ? row.categories[0] : row.categories)?.name)
        .filter(Boolean)
        .join(" ") ?? "";
    return [event.title, event.city, facilitator?.company_name, profile?.full_name, profile?.email, categories]
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
            <h1 className="text-xl font-semibold text-midnight">Eventmoderation</h1>
          </div>
          <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta" href="/admin">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Dashboard
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <AuthMessage message={message} />

        <div className="mt-5 grid gap-3 rounded-md border border-midnight/10 bg-white p-4 shadow-soft lg:grid-cols-[1fr_auto] lg:items-center">
          <form className="flex min-w-0 gap-2" action="/admin/events">
            <input name="status" type="hidden" value={selectedStatus} />
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/45" aria-hidden="true" />
              <input
                className="h-11 w-full rounded-md border border-midnight/15 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-sage-700"
                defaultValue={q ?? ""}
                name="q"
                placeholder="Søg eventtitel, arrangør/kaldenavn, by, kategori eller e-mail"
              />
            </label>
            <button className="h-11 rounded-md bg-midnight px-4 text-sm font-semibold text-white" type="submit">
              Søg
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            {statuses.map((item) => {
              const active = item.value === selectedStatus;
              return (
                <Link
                  className={
                    active
                      ? "rounded-md bg-midnight px-3 py-2 text-sm font-semibold text-white"
                      : "rounded-md border border-midnight/10 bg-white px-3 py-2 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta"
                  }
                  href={eventStatusHref(item.value, q ?? "")}
                  key={item.value}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <section className="mt-6 overflow-hidden rounded-md border border-midnight/10 bg-white shadow-soft">
          <div className="border-b border-midnight/10 px-5 py-4">
            <h2 className="text-lg font-semibold text-midnight">Events</h2>
            <p className="mt-1 text-sm text-ink/64">Godkend, afvis, skjul eller arkiver events.</p>
          </div>

          {events.length === 0 ? (
            <div className="p-8 text-center text-sm text-ink/64">Ingen events matcher filteret.</div>
          ) : (
            <div className="divide-y divide-midnight/10">
              {events.map((event: any) => {
                const facilitator = Array.isArray(event.facilitator_profiles) ? event.facilitator_profiles[0] : event.facilitator_profiles;
                const profile = Array.isArray(facilitator?.profiles) ? facilitator.profiles[0] : facilitator?.profiles;
                const facilitatorApproved = facilitator?.status === "approved";
                const latestNotificationLog = latestNotificationLogByEventId.get(event.id);
                const notificationActor = Array.isArray(latestNotificationLog?.profiles)
                  ? latestNotificationLog.profiles[0]
                  : latestNotificationLog?.profiles;
                const categories =
                  event.event_categories
                    ?.map((row: any) => (Array.isArray(row.categories) ? row.categories[0] : row.categories)?.name)
                    .filter(Boolean) ?? [];

                return (
                  <article className="grid gap-5 p-5 lg:grid-cols-[1fr_auto]" key={event.id}>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={"rounded-md px-2.5 py-1 text-xs font-semibold " + (statusClasses[event.status] ?? "bg-midnight/10 text-midnight")}>
                          {statusLabels[event.status] ?? event.status}
                        </span>
                        <span className="text-xs text-ink/52">
                          Oprettet {formatDateTime(event.created_at)}
                        </span>
                        <span className="text-xs text-ink/52">
                          Senest ændret {formatDateTime(event.updated_at)}
                        </span>
                      </div>

                      <h3 className="mt-3 text-lg font-semibold text-midnight">{event.title}</h3>
                      <p className="mt-1 text-sm text-ink/64">
                        {facilitator?.company_name || profile?.full_name || "Arrangør"} · {profile?.email || "Ingen e-mail"}
                      </p>
                      {!facilitatorApproved && event.status !== "active" ? (
                        <p className="mt-2 text-sm font-semibold text-[#8A6A2E]">
                          Arrangøren skal godkendes, før eventet kan godkendes.
                        </p>
                      ) : null}
                      <p className="mt-2 text-sm text-ink/72">
                        Eventdato: {formatDateTime(event.starts_at)}
                        {event.city ? " · " + event.city : ""}
                        {event.event_format ? " · " + event.event_format : ""}
                      </p>
                      {latestNotificationLog ? (
                        <p className="mt-2 text-xs font-semibold text-[#6E5A86]">
                          Seneste ændringsmail: {formatDateTime(latestNotificationLog.created_at)} · {latestNotificationLog.recipient_count ?? 0}{" "}
                          {(latestNotificationLog.recipient_count ?? 0) === 1 ? "modtager" : "modtagere"}
                          {notificationActor?.full_name ? " · sendt af " + notificationActor.full_name : ""}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {categories.map((category: string) => (
                          <span className="rounded-md bg-sage-50 px-2.5 py-1 text-xs font-semibold text-sage-700" key={category}>
                            {category}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap content-start gap-2 lg:justify-end">
                      <Link className="inline-flex h-9 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta" href={"/events/" + event.id + "?admin_return=/admin/events"}>
                        <Eye className="size-4" aria-hidden="true" />
                        Vis
                      </Link>
                      {event.status !== "active" && facilitatorApproved && (
                        <EventStatusButton eventId={event.id} status="active">
                          <Check className="size-4" aria-hidden="true" />
                          Godkend
                        </EventStatusButton>
                      )}
                      {event.status !== "active" && !facilitatorApproved && (
                        <button
                          className="inline-flex h-9 cursor-not-allowed items-center gap-2 rounded-md border border-[#E8D6A8] bg-[#FFF8E8] px-3 text-sm font-semibold text-[#8A6A2E]"
                          disabled
                          title="Arrangøren skal godkendes først"
                          type="button"
                        >
                          <Clock3 className="size-4" aria-hidden="true" />
                          Arrangør afventer
                        </button>
                      )}
                      {event.status !== "pending_review" && (
                        <EventStatusButton eventId={event.id} status="pending_review">
                          <Clock3 className="size-4" aria-hidden="true" />
                          Afventer
                        </EventStatusButton>
                      )}
                      {event.status !== "rejected" && (
                        <EventStatusButton eventId={event.id} status="rejected">
                          <Slash className="size-4" aria-hidden="true" />
                          Afvis
                        </EventStatusButton>
                      )}
                      {event.status !== "archived" && (
                        <EventStatusButton eventId={event.id} status="archived">
                          <Archive className="size-4" aria-hidden="true" />
                          Arkiver
                        </EventStatusButton>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
