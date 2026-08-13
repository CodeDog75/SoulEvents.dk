/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { AdminActionMenuScope } from "@/components/admin/action-menu";
import { AdminEventCard } from "@/components/admin/admin-event-card";
import { AuthMessage } from "@/components/auth/auth-message";
import { requireRole } from "@/lib/auth/roles";
import { formatDanishEventDateTime } from "@/lib/events/date-format";
import { publicEventPath, publicFacilitatorPath } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import type { EventStatus } from "@/types/database";

export const dynamic = "force-dynamic";

type AdminEventsPageProps = {
  searchParams: Promise<{ review?: string; status?: string; q?: string; message?: string }>;
};

const reviewFilters = [
  { label: "Nye", value: "unreviewed" },
  { label: "Kontrollerede", value: "reviewed" },
  { label: "Alle reviewstatusser", value: "all" },
] as const;

type ReviewFilter = (typeof reviewFilters)[number]["value"];

const eventViewFilters = [
  { label: "Offentlige", value: "public" },
  { label: "Afpublicerede", value: "unpublished" },
  { label: "Kommende", value: "upcoming" },
  { label: "Afholdte", value: "completed" },
] as const;

type EventViewFilter = (typeof eventViewFilters)[number]["value"];
type EventFilter = ReviewFilter | EventViewFilter;

const statuses: Array<{ label: string; value: "all" | EventStatus }> = [
  { label: "Alle tekniske statusser", value: "all" },
  { label: "Legacy: afventer", value: "pending_review" },
  { label: "Publiceret", value: "active" },
  { label: "Udsolgt", value: "sold_out" },
  { label: "Kladde", value: "draft" },
  { label: "Skjult", value: "rejected" },
  { label: "Afholdt", value: "completed" },
  { label: "Arkiveret", value: "archived" },
];

function normalizeStatus(status?: string) {
  return statuses.some((item) => item.value === status) ? (status as "all" | EventStatus) : "all";
}

function normalizeReviewFilter(review?: string): EventFilter {
  return [...reviewFilters, ...eventViewFilters].some((item) => item.value === review) ? (review as EventFilter) : "unreviewed";
}

function formatDateTime(value: string | null | undefined) {
  return formatDanishEventDateTime(value);
}

function eventListHref({
  queryText,
  review,
  status,
}: {
  queryText: string;
  review: EventFilter;
  status: "all" | EventStatus;
}) {
  const params = new URLSearchParams();
  if (review !== "unreviewed") params.set("review", review);
  if (status !== "all") params.set("status", status);
  if (queryText.trim()) params.set("q", queryText.trim());
  const queryString = params.toString();
  return "/admin/events" + (queryString ? "?" + queryString : "");
}

export default async function AdminEventsPage({ searchParams }: AdminEventsPageProps) {
  const [{ review, status, q, message }] = await Promise.all([searchParams, requireRole("admin")]);
  const selectedReview = normalizeReviewFilter(review);
  const selectedStatus = normalizeStatus(status);
  const queryText = (q ?? "").trim().toLowerCase();
  const now = new Date();
  const supabase = await createClient();

  let query = supabase
    .from("events")
    .select("id, slug, title, status, starts_at, ends_at, created_at, updated_at, published_at, reviewed_at, reviewed_by, city, event_format, price_cents, cover_image_path, bookings(status), facilitator_profiles(id, slug, status, company_name, profile_image_path, profiles!facilitator_profiles_profile_id_fkey(full_name, email)), regions(name), event_categories(categories(name))")
    .order(selectedReview === "unreviewed" || selectedReview === "public" || selectedReview === "upcoming" ? "published_at" : "updated_at", {
      ascending: false,
      nullsFirst: false,
    })
    .limit(queryText ? 300 : 80);

  if (selectedStatus !== "all") {
    query = query.eq("status", selectedStatus);
  }

  if (selectedReview === "unreviewed") {
    query = query.in("status", ["active", "sold_out"]).is("reviewed_at", null);
  } else if (selectedReview === "reviewed") {
    query = query.in("status", ["active", "sold_out"]).not("reviewed_at", "is", null);
  } else if (selectedReview === "public") {
    query = query.in("status", ["active", "sold_out"]);
  } else if (selectedReview === "unpublished") {
    query = query.in("status", ["pending_review", "rejected", "archived", "cancelled"]);
  } else if (selectedReview === "upcoming") {
    query = query.in("status", ["active", "sold_out"]).gte("starts_at", now.toISOString());
  } else if (selectedReview === "completed") {
    query = query.eq("status", "completed");
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
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  const { data: authUserResult } = await supabase.auth.getUser();
  const lastSignInAt = authUserResult.user?.last_sign_in_at ?? null;
  const [
    { count: newSinceLastLogin },
    { count: newToday },
    { count: newThisWeek },
    { count: unreviewedTotal },
    { count: publicTotal },
  ] = await Promise.all([
    lastSignInAt
      ? supabase.from("events").select("id", { count: "exact", head: true }).in("status", ["active", "sold_out"]).gte("published_at", lastSignInAt)
      : Promise.resolve({ count: 0 }),
    supabase.from("events").select("id", { count: "exact", head: true }).in("status", ["active", "sold_out"]).gte("published_at", startOfToday.toISOString()),
    supabase.from("events").select("id", { count: "exact", head: true }).in("status", ["active", "sold_out"]).gte("published_at", startOfWeek.toISOString()),
    supabase.from("events").select("id", { count: "exact", head: true }).in("status", ["active", "sold_out"]).is("reviewed_at", null),
    supabase.from("events").select("id", { count: "exact", head: true }).in("status", ["active", "sold_out"]),
  ]);
  const eventStats = [
    { label: "Nye siden sidste login", value: newSinceLastLogin ?? 0 },
    { label: "Nye i dag", value: newToday ?? 0 },
    { label: "Nye denne uge", value: newThisWeek ?? 0 },
    { label: "Ikke kontrollerede i alt", value: unreviewedTotal ?? 0 },
    { label: "Offentlige events i alt", value: publicTotal ?? 0 },
  ];

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

        <section className="mt-5 rounded-[24px] border border-[#E8DDF0] bg-[#FBF8FD] p-5 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Nye events til gennemgang</p>
              <h2 className="mt-1 font-serif text-2xl font-semibold text-midnight">Redaktionelt overblik</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/68">
                Events offentliggøres med det samme. Her ser du de nye publicerede events, der endnu ikke er gennemgået af admin.
              </p>
            </div>
            <Link
              className="inline-flex h-10 items-center justify-center rounded-button bg-[#7A5D91] px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-[#6E5285]"
              href="/admin/events"
            >
              Åbn nye events
            </Link>
          </div>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {eventStats.map((stat) => (
              <div className="rounded-[18px] border border-white/80 bg-white p-4 shadow-soft" key={stat.label}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink/52">{stat.label}</dt>
                <dd className="mt-2 text-2xl font-semibold text-midnight">{new Intl.NumberFormat("da-DK").format(stat.value)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="mt-5 grid gap-3 rounded-md border border-midnight/10 bg-white p-4 shadow-soft lg:grid-cols-[1fr_auto] lg:items-center">
          <form className="flex min-w-0 gap-2" action="/admin/events">
            <input name="review" type="hidden" value={selectedReview} />
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

          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-24 text-xs font-bold uppercase tracking-wide text-ink/45">Review</span>
              {reviewFilters.map((item) => {
                const active = item.value === selectedReview;
                return (
                  <Link
                    className={
                      active
                        ? "rounded-full bg-[#7A5D91] px-3 py-2 text-sm font-semibold text-white"
                        : "rounded-full border border-midnight/10 bg-white px-3 py-2 text-sm font-semibold text-midnight transition hover:border-[#7A5D91] hover:text-[#7A5D91]"
                    }
                    href={eventListHref({ queryText: q ?? "", review: item.value, status: selectedStatus })}
                    key={item.value}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-24 text-xs font-bold uppercase tracking-wide text-ink/45">Eventvisning</span>
              {eventViewFilters.map((item) => {
                const active = item.value === selectedReview;
                return (
                  <Link
                    className={
                      active
                        ? "rounded-full bg-[#7A5D91] px-3 py-2 text-sm font-semibold text-white"
                        : "rounded-full border border-midnight/10 bg-white px-3 py-2 text-sm font-semibold text-midnight transition hover:border-[#7A5D91] hover:text-[#7A5D91]"
                    }
                    href={eventListHref({ queryText: q ?? "", review: item.value, status: selectedStatus })}
                    key={item.value}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-24 text-xs font-bold uppercase tracking-wide text-ink/45">Teknisk status</span>
              {statuses.map((item) => {
                const active = item.value === selectedStatus;
                return (
                  <Link
                    className={
                      active
                        ? "rounded-full bg-midnight px-3 py-2 text-sm font-semibold text-white"
                        : "rounded-full border border-midnight/10 bg-white px-3 py-2 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta"
                    }
                    href={eventListHref({ queryText: q ?? "", review: selectedReview, status: item.value })}
                    key={item.value}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <section className="mt-6 overflow-hidden rounded-md border border-midnight/10 bg-white shadow-soft">
          <div className="border-b border-midnight/10 px-5 py-4">
            <h2 className="text-lg font-semibold text-midnight">Events</h2>
            <p className="mt-1 text-sm text-ink/64">Kontrollér nye publicerede events og håndter skjulte eller arkiverede events.</p>
          </div>

          {events.length === 0 ? (
            <div className="p-8 text-center text-sm text-ink/64">Ingen events matcher filteret.</div>
          ) : (
            <AdminActionMenuScope key={selectedReview + "|" + selectedStatus + "|" + queryText + "|" + events.map((event: any) => event.id).join(",")}>
            <div className="grid gap-3 bg-[#fbfaf7] p-3 sm:p-4">
              {events.map((event: any) => {
	                const facilitator = Array.isArray(event.facilitator_profiles) ? event.facilitator_profiles[0] : event.facilitator_profiles;
	                const profile = Array.isArray(facilitator?.profiles) ? facilitator.profiles[0] : facilitator?.profiles;
	                const facilitatorApproved = facilitator?.status === "approved";
	                const facilitatorImageUrl = facilitator?.profile_image_path
	                  ? supabase.storage.from("media").getPublicUrl(facilitator.profile_image_path).data.publicUrl
	                  : null;
	                const eventImageUrl = event.cover_image_path
	                  ? supabase.storage.from("media").getPublicUrl(event.cover_image_path).data.publicUrl
	                  : null;
	                const activeBookingCount =
	                  event.bookings?.filter((booking: { status?: string | null }) => ["pending", "confirmed"].includes(booking.status ?? "")).length ?? 0;
	                const region = Array.isArray(event.regions) ? event.regions[0] : event.regions;
	                const latestNotificationLog = latestNotificationLogByEventId.get(event.id);
                const notificationActor = Array.isArray(latestNotificationLog?.profiles)
                  ? latestNotificationLog.profiles[0]
                  : latestNotificationLog?.profiles;
                const categories =
                  event.event_categories
                    ?.map((row: any) => (Array.isArray(row.categories) ? row.categories[0] : row.categories)?.name)
                    .filter(Boolean) ?? [];
                const latestNotificationLine = latestNotificationLog
                  ? "Seneste ændringsmail: " +
                    formatDateTime(latestNotificationLog.created_at) +
                    " · " +
                    (latestNotificationLog.recipient_count ?? 0) +
                    " " +
                    ((latestNotificationLog.recipient_count ?? 0) === 1 ? "modtager" : "modtagere") +
                    (notificationActor?.full_name ? " · sendt af " + notificationActor.full_name : "")
                  : null;

                return (
                  <AdminEventCard
                    activeBookingCount={activeBookingCount}
                    categories={categories}
                    cityOrRegion={event.city || region?.name || event.event_format || "Ikke angivet"}
                    event={{
                      created_at: event.created_at,
                      ends_at: event.ends_at,
                      id: event.id,
                      price_cents: event.price_cents,
                      published_at: event.published_at,
                      reviewed_at: event.reviewed_at,
                      slug: event.slug,
                      starts_at: event.starts_at,
                      status: event.status,
                      title: event.title,
                      updated_at: event.updated_at,
                    }}
                    eventImageUrl={eventImageUrl}
                    facilitator={{
                      email: profile?.email || null,
                      id: facilitator?.id || null,
                      imageUrl: facilitatorImageUrl,
                      isApproved: facilitatorApproved,
                      name: facilitator?.company_name || profile?.full_name || "Arrangør",
                      profileHref: facilitator?.id
                        ? publicFacilitatorPath(facilitator.slug || facilitator.id) + "?admin_return=/admin/events"
                        : null,
                    }}
                    key={event.id}
                    latestNotificationLine={latestNotificationLine}
                    publicEventHref={publicEventPath(event.slug || event.id) + "?admin_return=/admin/events"}
                  />
                );
              })}
            </div>
            </AdminActionMenuScope>
          )}
        </section>
      </section>
    </main>
  );
}
