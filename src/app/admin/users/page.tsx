import Link from "next/link";
import { ArrowLeft, CalendarDays, Eye, Ticket } from "lucide-react";
import { getFacilitatorAdminStatus, type FacilitatorAdminStatus } from "@/components/admin/facilitator-status-badge";
import { AdminUserSearchForm } from "@/components/admin/users/admin-user-search-form";
import { UserRoleTable } from "@/components/admin/users/user-role-table";
import { AuthMessage } from "@/components/auth/auth-message";
import { requireRole } from "@/lib/auth/roles";
import { publicEventPath } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventStatus, FacilitatorStatus } from "@/types/database";

export const dynamic = "force-dynamic";

type AdminUsersPageProps = {
  searchParams: Promise<{
    highlight?: string;
    message?: string;
    event_page?: string;
    login_activity?: string;
    page?: string;
    paused_facilitator?: string;
    q?: string;
    sort?: string;
    status?: string;
    type?: string;
  }>;
};

type FacilitatorRow = {
  address_line: string | null;
  city: string | null;
  company_name: string | null;
  created_at: string;
  host_reference_id: string | null;
  id: string;
  is_disabled: boolean | null;
  is_paused: boolean | null;
  long_description: string | null;
  postal_code: string | null;
  profile_id: string;
  profile_image_path?: string | null;
  slug?: string | null;
  profiles?: {
    created_at?: string | null;
    email?: string | null;
    full_name?: string | null;
    id?: string | null;
    phone?: string | null;
    role?: "admin" | "facilitator" | null;
  } | Array<{
    created_at?: string | null;
    email?: string | null;
    full_name?: string | null;
    id?: string | null;
    phone?: string | null;
    role?: "admin" | "facilitator" | null;
  }> | null;
  public_email: string | null;
  public_phone: string | null;
  short_description: string | null;
  specialties?: string | null;
  status: FacilitatorStatus;
  website_url: string | null;
};

type ProfileRow = {
  created_at?: string | null;
  email?: string | null;
  full_name?: string | null;
  id?: string | null;
  phone?: string | null;
  role?: "admin" | "facilitator" | null;
};

type EventRow = {
  address_line?: string | null;
  city?: string | null;
  created_at: string | null;
  event_reference_id?: string | null;
  facilitator_id: string | null;
  id: string;
  slug?: string | null;
  starts_at: string | null;
  status: string | null;
  title?: string | null;
  updated_at?: string | null;
  facilitator_profiles?:
    | {
        company_name?: string | null;
        profiles?:
          | {
              email?: string | null;
              full_name?: string | null;
            }
          | Array<{
              email?: string | null;
              full_name?: string | null;
            }>
          | null;
      }
    | Array<{
        company_name?: string | null;
        profiles?:
          | {
              email?: string | null;
              full_name?: string | null;
            }
          | Array<{
              email?: string | null;
              full_name?: string | null;
            }>
          | null;
      }>
    | null;
};

type BookingRow = {
  facilitator_id: string | null;
  id: string;
  participant_email?: string | null;
  events?: { ends_at?: string | null; starts_at?: string | null } | Array<{ ends_at?: string | null; starts_at?: string | null }> | null;
  status: string | null;
};

type CategoryRelationRow = {
  facilitator_id: string | null;
  categories?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

type TagRelationRow = {
  facilitator_id: string | null;
  tags?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

type OptionalFacilitatorFieldRow = {
  auto_approve_events?: boolean | null;
  featured_sort_order?: number | null;
  id: string;
  is_active_host?: boolean | null;
  is_experienced_host?: boolean | null;
  is_featured?: boolean | null;
};

type EnrichedFacilitatorRow = {
  active_events: number;
  address_line?: string | null;
  auto_approve_events?: boolean | null;
  city?: string | null;
  can_delete: boolean;
  delete_blockers: string[];
  delete_preserves_user_identity: boolean;
  company_name?: string | null;
  completed_events: number;
  created_at: string;
  draft_events: number;
  email: string;
  event_count: number;
  facilitator_categories: string[];
  facilitator_tags: string[];
  featured_sort_order: number;
  full_name: string;
  host_reference_id?: string | null;
  id: string;
  is_active_host: boolean;
  is_disabled: boolean;
  is_experienced_host: boolean;
  is_featured: boolean;
  is_paused: boolean;
  latest_event_at: string | null;
  last_sign_in_at?: string | null;
  days_since_last_login?: number | null;
  long_description?: string | null;
  pending_bookings: number;
  participant_booking_count: number;
  phone: string | null;
  postal_code?: string | null;
  profile_id: string;
  profile_image_url?: string | null;
  public_email?: string | null;
  public_phone?: string | null;
  role: "admin" | "facilitator";
  short_description?: string | null;
  specialties?: string | null;
  status: FacilitatorStatus;
  total_bookings: number;
  website_url?: string | null;
};

type FacilitatorSort =
  | "activity_asc"
  | "activity_desc"
  | "events_asc"
  | "events_desc"
  | "last_login_asc"
  | "last_login_desc"
  | "name_asc"
  | "name_desc"
  | "newest"
  | "oldest"
  | "priority";
type LoginActivityFilter = "all" | "never" | "within_30" | "inactive_30" | "inactive_90" | "inactive_180";
type SearchResultType = "events" | "facilitators";

const facilitatorsPerPage = 25;
const eventsPerPage = 25;

const facilitatorStatusFilters: Array<{ label: string; value: "all" | FacilitatorAdminStatus }> = [
  { label: "Alle", value: "all" },
  { label: "Afventer godkendelse", value: "pending" },
  { label: "Kræver ændringer", value: "changes_requested" },
  { label: "Aktive", value: "active" },
  { label: "På pause", value: "paused" },
  { label: "Deaktiverede", value: "disabled" },
];

const facilitatorSortOptions: Array<{ label: string; value: FacilitatorSort }> = [
  { label: "Nyeste først", value: "newest" },
  { label: "Ældste først", value: "oldest" },
  { label: "Navn A-Å", value: "name_asc" },
  { label: "Navn Å-A", value: "name_desc" },
  { label: "Mest aktive", value: "activity_desc" },
  { label: "Mindst aktive", value: "activity_asc" },
  { label: "Flest events", value: "events_desc" },
  { label: "Færrest events", value: "events_asc" },
  { label: "Seneste aktivitet", value: "priority" },
  { label: "Senest logget ind", value: "last_login_desc" },
  { label: "Længst tid siden login", value: "last_login_asc" },
];

const loginActivityFilters: Array<{ label: string; value: LoginActivityFilter }> = [
  { label: "Alle loginaktiviteter", value: "all" },
  { label: "Logget ind inden for 30 dage", value: "within_30" },
  { label: "Ikke logget ind i 30 dage", value: "inactive_30" },
  { label: "Ikke logget ind i 90 dage", value: "inactive_90" },
  { label: "Ikke logget ind i 180 dage", value: "inactive_180" },
  { label: "Aldrig logget ind", value: "never" },
];

type SearchableFacilitator = {
  address_line?: string | null;
  auto_approve_events?: boolean | null;
  city?: string | null;
  company_name?: string | null;
  email?: string | null;
  facilitator_categories: string[];
  facilitator_tags: string[];
  full_name?: string | null;
  host_reference_id?: string | null;
  id?: string | null;
  is_active_host?: boolean | null;
  is_experienced_host?: boolean | null;
  is_featured?: boolean | null;
  long_description?: string | null;
  phone?: string | null;
  postal_code?: string | null;
  public_email?: string | null;
  public_phone?: string | null;
  role?: string | null;
  short_description?: string | null;
  specialties?: string | null;
  status?: string | null;
  website_url?: string | null;
};

type SupabaseListResult = {
  data: unknown[] | null;
  error: { code?: string | null; message?: string | null } | null;
};

type FacilitatorProfilesQuery = {
  select: (columns: string) => {
    order: (column: string, options: { ascending: boolean }) => Promise<SupabaseListResult>;
  };
};

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function appendToMap(map: Map<string, string[]>, key: string | null, value: string | null | undefined) {
  if (!key || !value) {
    return;
  }

  map.set(key, [...(map.get(key) ?? []), value]);
}

function optionalFieldMap(rows: OptionalFacilitatorFieldRow[] | null | undefined, field: keyof Omit<OptionalFacilitatorFieldRow, "id">) {
  return new Map((rows ?? []).map((row) => [row.id, row[field]]));
}

function normalizeSearchValue(value: string | number | boolean | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesQuery(values: Array<string | number | boolean | null | undefined>, queryText: string) {
  return values.some((value) => normalizeSearchValue(value).includes(queryText));
}

function startsWithQuery(values: Array<string | number | boolean | null | undefined>, queryText: string) {
  return values.some((value) => normalizeSearchValue(value).startsWith(queryText));
}

function searchScore(facilitator: SearchableFacilitator, queryText: string) {
  if (!queryText) return 0;

  const primaryFields = [facilitator.company_name, facilitator.full_name];
  const contactFields = [facilitator.email, facilitator.phone, facilitator.public_email, facilitator.public_phone];
  const locationFields = [facilitator.city, facilitator.postal_code, facilitator.address_line];
  const exactFields = [...primaryFields, ...contactFields, ...locationFields, facilitator.host_reference_id, facilitator.id];
  const specialtyFields = splitSpecialties(facilitator.specialties);
  const badgeFields = [...facilitator.facilitator_categories, ...facilitator.facilitator_tags];

  if (exactFields.some((value) => normalizeSearchValue(value) === queryText)) return 1000;
  if (startsWithQuery(primaryFields, queryText)) return 900;
  if (primaryFields.some((value) => normalizeSearchValue(value).split(/\s+/).some((word) => word.startsWith(queryText)))) return 850;
  if (startsWithQuery([facilitator.id, facilitator.host_reference_id, facilitator.email, facilitator.phone, facilitator.city, facilitator.postal_code], queryText)) return 760;
  if (startsWithQuery([...badgeFields, ...specialtyFields], queryText)) return 700;
  if (includesQuery(primaryFields, queryText)) return 650;
  if (includesQuery([...contactFields, ...locationFields, facilitator.host_reference_id, facilitator.id], queryText)) return 550;
  if (includesQuery([...badgeFields, ...specialtyFields], queryText)) return 450;
  if (
    includesQuery(
      [
        facilitator.role,
        facilitator.status,
        facilitator.short_description,
        facilitator.long_description,
        facilitator.website_url,
        ...specialtyFields,
        facilitator.is_featured ? "fremhævet" : "",
        facilitator.auto_approve_events ? "auto-godkendelse" : "",
        facilitator.is_active_host ? "aktiv arrangør" : "",
        facilitator.is_experienced_host ? "erfaren arrangør" : "",
      ],
      queryText,
    )
  ) {
    return 200;
  }

  return -1;
}

function isMissingVisibilityColumnError(error: { code?: string | null; message?: string | null } | null | undefined) {
  const message = error?.message ?? "";
  return error?.code === "42703" || error?.code === "PGRST204" || message.includes("is_paused") || message.includes("is_disabled");
}

function normalizeFacilitatorStatusFilter(value?: string): "all" | FacilitatorAdminStatus {
  return facilitatorStatusFilters.some((item) => item.value === value) ? (value as "all" | FacilitatorAdminStatus) : "all";
}

function normalizeFacilitatorSort(value?: string): FacilitatorSort {
  return facilitatorSortOptions.some((item) => item.value === value) ? (value as FacilitatorSort) : "newest";
}

function normalizeLoginActivityFilter(value?: string): LoginActivityFilter {
  return loginActivityFilters.some((item) => item.value === value) ? (value as LoginActivityFilter) : "all";
}

function normalizeSearchResultType(value?: string): SearchResultType {
  return value === "events" ? "events" : "facilitators";
}

function normalizePage(value?: string) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function facilitatorDisplayName(facilitator: EnrichedFacilitatorRow) {
  return facilitator.company_name || facilitator.full_name || "Uden navn";
}

function facilitatorActivityDate(facilitator: EnrichedFacilitatorRow) {
  return new Date(facilitator.latest_event_at ?? facilitator.created_at).getTime();
}

function facilitatorActivityScore(facilitator: EnrichedFacilitatorRow) {
  return facilitator.active_events * 3 + facilitator.completed_events + facilitator.total_bookings;
}

function daysSince(value: string | null | undefined, now = new Date()) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

function lastLoginSortValue(facilitator: EnrichedFacilitatorRow) {
  return facilitator.last_sign_in_at ? new Date(facilitator.last_sign_in_at).getTime() : Number.NEGATIVE_INFINITY;
}

function matchesLoginActivityFilter(facilitator: EnrichedFacilitatorRow, filter: LoginActivityFilter) {
  if (filter === "all") return true;
  if (facilitator.last_sign_in_at === undefined) return false;
  if (filter === "never") return !facilitator.last_sign_in_at;

  const days = facilitator.days_since_last_login;
  if (days === null || days === undefined) return false;
  if (filter === "within_30") return days <= 30;
  if (filter === "inactive_30") return days > 30;
  if (filter === "inactive_90") return days > 90;
  if (filter === "inactive_180") return days > 180;
  return true;
}

type AuthUserActivity = {
  id: string;
  last_sign_in_at?: string | null;
};

async function getAuthActivityByProfileId(supabase: ReturnType<typeof createAdminClient>, profileIds: string[]) {
  const wantedIds = new Set(profileIds.filter(Boolean));
  const activity = new Map<string, { lastSignInAt: string | null }>();
  if (wantedIds.size === 0) return { activity, isComplete: true };

  let page = 1;
  const perPage = 1000;

  while (page <= 10 && activity.size < wantedIds.size) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });

    if (error) {
      console.error("[admin-users] Auth login activity lookup failed", {
        message: error.message,
        page,
      });
      return { activity, isComplete: false };
    }

    const users = (data.users ?? []) as AuthUserActivity[];
    for (const user of users) {
      if (wantedIds.has(user.id)) {
        activity.set(user.id, { lastSignInAt: user.last_sign_in_at ?? null });
      }
    }

    if (users.length < perPage) break;
    page += 1;
  }

  return { activity, isComplete: activity.size >= wantedIds.size };
}

function splitSpecialties(input: string | null | undefined) {
  return (input ?? "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function filteredUsersHref(params: {
  eventPage?: number;
  loginActivity?: LoginActivityFilter;
  page?: number;
  q?: string;
  sort: FacilitatorSort;
  status: "all" | FacilitatorAdminStatus;
  type?: SearchResultType;
}) {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set("q", params.q);
  if (params.status !== "all") searchParams.set("status", params.status);
  if (params.loginActivity && params.loginActivity !== "all") searchParams.set("login_activity", params.loginActivity);
  if (params.sort !== "newest") searchParams.set("sort", params.sort);
  if (params.type && (params.q || params.type !== "facilitators")) searchParams.set("type", params.type);
  if (params.page && params.page > 1) searchParams.set("page", String(params.page));
  if (params.eventPage && params.eventPage > 1) searchParams.set("event_page", String(params.eventPage));
  const query = searchParams.toString();
  return "/admin/users" + (query ? "?" + query : "");
}

const facilitatorSelectWithProfiles =
  "id, slug, profile_id, host_reference_id, status, is_paused, is_disabled, company_name, profile_image_path, short_description, long_description, specialties, address_line, city, postal_code, public_email, public_phone, website_url, created_at, profiles!facilitator_profiles_profile_id_fkey(id, role, full_name, email, phone, created_at)";

const facilitatorSelectWithoutProfiles =
  "id, slug, profile_id, host_reference_id, status, is_paused, is_disabled, company_name, profile_image_path, short_description, long_description, specialties, address_line, city, postal_code, public_email, public_phone, website_url, created_at";

const legacyFacilitatorSelectWithoutProfiles =
  "id, profile_id, host_reference_id, status, company_name, profile_image_path, short_description, long_description, specialties, address_line, city, postal_code, public_email, public_phone, website_url, created_at";

const eventStatusLabels: Record<EventStatus, string> = {
  active: "Aktivt",
  archived: "Arkiveret",
  cancelled: "Aflyst",
  completed: "Afsluttet",
  draft: "Kladde",
  pending_review: "Afventer godkendelse",
  rejected: "Skjult",
  sold_out: "Udsolgt",
};

const eventStatusClasses: Record<EventStatus, string> = {
  active: "bg-sage-50 text-sage-700",
  archived: "bg-midnight/10 text-midnight",
  cancelled: "bg-rose/10 text-rose",
  completed: "bg-sand text-midnight",
  draft: "bg-midnight/10 text-midnight",
  pending_review: "bg-terracotta/10 text-terracotta",
  rejected: "bg-rose/10 text-rose",
  sold_out: "bg-midnight/10 text-midnight",
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Tidspunkt mangler";
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function eventStatusLabel(status: string | null | undefined) {
  return eventStatusLabels[status as EventStatus] ?? status ?? "Status mangler";
}

function eventStatusClass(status: string | null | undefined) {
  return eventStatusClasses[status as EventStatus] ?? "bg-midnight/10 text-midnight";
}

function SearchResultTabs({
  activeType,
  eventCount,
  facilitatorCount,
  eventHref,
  facilitatorHref,
}: {
  activeType: SearchResultType;
  eventCount: number;
  facilitatorCount: number;
  eventHref: string;
  facilitatorHref: string;
}) {
  const tabClass = (type: SearchResultType) =>
    "inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-4 text-sm font-semibold transition sm:flex-none " +
    (activeType === type
      ? "bg-midnight text-white shadow-soft"
      : "border border-midnight/10 bg-white text-ink/64 hover:border-sage-700 hover:text-sage-700");

  return (
    <nav aria-label="Søgeresultater" className="flex flex-col gap-2 rounded-[24px] border border-midnight/10 bg-[#F4F0F7] p-2 sm:flex-row sm:items-center sm:justify-start">
      <Link className={tabClass("facilitators")} href={facilitatorHref}>
        Arrangører ({facilitatorCount})
      </Link>
      <Link className={tabClass("events")} href={eventHref}>
        Events ({eventCount})
      </Link>
    </nav>
  );
}

function Pagination({
  currentPage,
  getHref,
  label,
  totalItems,
  totalPages,
}: {
  currentPage: number;
  getHref: (page: number) => string;
  label: string;
  totalItems: number;
  totalPages: number;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav aria-label={label} className="flex flex-col gap-3 border-t border-midnight/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-ink/64">
        Side {currentPage} af {totalPages} · {totalItems} resultater
      </p>
      <div className="flex gap-2">
        {currentPage > 1 ? (
          <Link className="inline-flex h-10 items-center justify-center rounded-full border border-midnight/15 bg-white px-4 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700" href={getHref(currentPage - 1)}>
            Forrige
          </Link>
        ) : null}
        {currentPage < totalPages ? (
          <Link className="inline-flex h-10 items-center justify-center rounded-full border border-midnight/15 bg-white px-4 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700" href={getHref(currentPage + 1)}>
            Næste
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

function EventSearchResults({
  currentPage,
  events,
  getPageHref,
  hasFacilitatorFilters,
  query,
  returnHref,
  totalCount,
  totalPages,
}: {
  currentPage: number;
  events: EventRow[];
  getPageHref: (page: number) => string;
  hasFacilitatorFilters: boolean;
  query: string;
  returnHref: string;
  totalCount: number;
  totalPages: number;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-midnight/10 bg-white shadow-soft">
      <div className="border-b border-midnight/10 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-midnight">Events</h2>
            <p className="mt-1 text-sm text-ink/64">
              {totalCount ? `${totalCount} event${totalCount === 1 ? "" : "s"} matcher søgningen.` : "Ingen events matcher søgningen."}
            </p>
            {hasFacilitatorFilters ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6E5A86]">
                Eventresultaterne matcher kun tekstsøgningen. Arrangørfiltre som status, sortering og loginaktivitet bruges ikke på events.
              </p>
            ) : null}
          </div>
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
            href={`/admin/events?q=${encodeURIComponent(query)}`}
          >
            <CalendarDays className="size-4" aria-hidden="true" />
            Åbn eventmoderation
          </Link>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="p-6 text-sm text-ink/64">Prøv eventtitel, arrangørnavn, by eller event-id.</div>
      ) : (
        <div className="divide-y divide-midnight/10">
          {events.map((event) => {
            const facilitator = first(event.facilitator_profiles);
            const profile = first(facilitator?.profiles);
            const facilitatorName = facilitator?.company_name || profile?.full_name || "Arrangør mangler";
            const location = [event.address_line, event.city].filter(Boolean).join(", ");

            return (
              <article className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto]" key={event.id}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={"rounded-md px-2.5 py-1 text-xs font-semibold " + eventStatusClass(event.status)}>
                      {eventStatusLabel(event.status)}
                    </span>
                    {event.event_reference_id ? <span className="rounded-md bg-midnight/5 px-2.5 py-1 text-xs font-semibold text-ink/64">{event.event_reference_id}</span> : null}
                  </div>
                  <h3 className="mt-3 break-words text-lg font-semibold text-midnight">{event.title || "Event uden titel"}</h3>
                  <p className="mt-1 text-sm text-ink/64">
                    {facilitatorName}
                    {location ? " · " + location : ""}
                  </p>
                  <p className="mt-2 text-sm text-ink/72">
                    {event.starts_at ? "Afholdes " + formatDateTime(event.starts_at) : "Dato mangler"}
                    {event.updated_at ? " · Senest ændret " + formatDateTime(event.updated_at) : ""}
                  </p>
                </div>

                <div className="flex flex-wrap content-start gap-2 lg:justify-end">
                  <Link
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta"
                    href={publicEventPath(event.slug || event.id) + `?admin_return=${encodeURIComponent(returnHref)}`}
                  >
                    <Eye className="size-4" aria-hidden="true" />
                    Se event
                  </Link>
                  <Link
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
                    href={`/admin/events?status=${encodeURIComponent(event.status ?? "all")}&q=${encodeURIComponent(event.event_reference_id || event.title || query)}`}
                  >
                    <CalendarDays className="size-4" aria-hidden="true" />
                    Eventværktøjer
                  </Link>
                  {event.facilitator_id ? (
                    <Link
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
                      href={`/admin/bookings?facilitator=${event.facilitator_id}`}
                    >
                      <Ticket className="size-4" aria-hidden="true" />
                      Se tilmeldinger
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Pagination
        currentPage={currentPage}
        getHref={getPageHref}
        label="Eventsider"
        totalItems={totalCount}
        totalPages={totalPages}
      />
    </section>
  );
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const [
    {
      event_page: eventPageParam,
      highlight,
      login_activity: loginActivity,
      message,
      page: pageParam,
      paused_facilitator: pausedFacilitatorId,
      q,
      sort,
      status,
      type,
    },
    profile,
  ] = await Promise.all([searchParams, requireRole("admin")]);
  const queryText = normalizeSearchValue(q);
  const selectedStatus = normalizeFacilitatorStatusFilter(status);
  const selectedLoginActivity = normalizeLoginActivityFilter(loginActivity);
  const selectedSort = normalizeFacilitatorSort(sort);
  const requestedResultType = normalizeSearchResultType(type);
  const requestedFacilitatorPage = normalizePage(pageParam);
  const requestedEventPage = normalizePage(eventPageParam);
  const supabase = createAdminClient();
  const facilitatorProfilesQuery = supabase.from("facilitator_profiles") as unknown as FacilitatorProfilesQuery;
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  let facilitatorResult = await facilitatorProfilesQuery
    .select(facilitatorSelectWithProfiles)
    .order("created_at", { ascending: false });

  if (facilitatorResult.error) {
    const fallbackSelect = isMissingVisibilityColumnError(facilitatorResult.error) ? legacyFacilitatorSelectWithoutProfiles : facilitatorSelectWithoutProfiles;
    const fallbackResult = await facilitatorProfilesQuery
      .select(fallbackSelect)
      .order("created_at", { ascending: false });
    facilitatorResult = {
      data: fallbackResult.data as unknown[] | null,
      error: fallbackResult.error,
    };
  }

  let facilitators = (facilitatorResult.data ?? []) as FacilitatorRow[];

  if (facilitators.length > 0 && facilitators.some((facilitator) => !facilitator.profiles)) {
    const profileIds = Array.from(new Set(facilitators.map((facilitator) => facilitator.profile_id).filter(Boolean)));
    const { data: profileRows } = profileIds.length
      ? await supabase.from("profiles").select("id, role, full_name, email, phone, created_at").in("id", profileIds)
      : { data: [] as ProfileRow[] };
    const profilesById = new Map(((profileRows ?? []) as ProfileRow[]).map((row) => [row.id, row]));
    facilitators = facilitators.map((facilitator) => ({
      ...facilitator,
      profiles: profilesById.get(facilitator.profile_id) ?? null,
    }));
  }

  const authActivityLookup = await getAuthActivityByProfileId(
    supabase,
    facilitators.map((facilitator) => facilitator.profile_id),
  );

  const [
    { data: events },
    { data: bookings },
    { data: reports },
    { data: invoices },
    { data: financialRecords },
    { data: coOrganizerRows },
    { data: notificationLogs },
    { data: categoryRows },
    { data: tagRows },
    { data: featuredRows },
    { data: featuredSortRows },
    { data: autoApproveRows },
    { data: activeBadgeRows },
    { data: experiencedBadgeRows },
  ] = await Promise.all([
    supabase
      .from("events")
      .select("id, facilitator_id, status, starts_at, created_at"),
    supabase
      .from("bookings")
      .select("id, facilitator_id, participant_email, status, events(starts_at, ends_at)"),
    supabase.from("monthly_reports").select("id, facilitator_id"),
    supabase.from("invoice_drafts").select("id, facilitator_id"),
    supabase.from("event_financial_records").select("id, primary_facilitator_id"),
    supabase.from("event_co_organizers").select("id, primary_organizer_profile_id, co_organizer_profile_id"),
    supabase.from("event_update_notification_logs").select("id, facilitator_id"),
    supabase
      .from("facilitator_categories")
      .select("facilitator_id, categories(name)"),
    supabase
      .from("facilitator_tags")
      .select("facilitator_id, tags(name)"),
    supabase.from("facilitator_profiles").select("id, is_featured"),
    supabase.from("facilitator_profiles").select("id, featured_sort_order"),
    supabase.from("facilitator_profiles").select("id, auto_approve_events"),
    supabase.from("facilitator_profiles").select("id, is_active_host"),
    supabase.from("facilitator_profiles").select("id, is_experienced_host"),
  ]);
  const eventStatsByFacilitator = new Map<string, {
    activeEvents: number;
    completedEvents: number;
    draftEvents: number;
    eventCount: number;
    latestEventAt: string | null;
  }>();
  for (const event of ((events ?? []) as EventRow[])) {
    if (!event.facilitator_id) continue;
    const stats = eventStatsByFacilitator.get(event.facilitator_id) ?? {
      activeEvents: 0,
      completedEvents: 0,
      draftEvents: 0,
      eventCount: 0,
      latestEventAt: null,
    };
    stats.eventCount += 1;
    if (["active", "sold_out"].includes(event.status ?? "") && event.starts_at && new Date(event.starts_at) >= today) stats.activeEvents += 1;
    if (event.status === "draft") stats.draftEvents += 1;
    if (event.status === "completed" || (event.starts_at && new Date(event.starts_at) < today && !["cancelled", "draft"].includes(event.status ?? ""))) {
      stats.completedEvents += 1;
    }
    const latestCandidate = event.starts_at ?? event.created_at;
    if (latestCandidate && (!stats.latestEventAt || new Date(latestCandidate) > new Date(stats.latestEventAt))) {
      stats.latestEventAt = latestCandidate;
    }
    eventStatsByFacilitator.set(event.facilitator_id, stats);
  }

  const bookingStatsByFacilitator = new Map<string, { pendingBookings: number; totalBookings: number }>();
  const participantBookingCountsByEmail = new Map<string, number>();
  for (const booking of ((bookings ?? []) as BookingRow[])) {
    if (booking.facilitator_id) {
      const stats = bookingStatsByFacilitator.get(booking.facilitator_id) ?? { pendingBookings: 0, totalBookings: 0 };
      if (booking.status !== "cancelled") stats.totalBookings += 1;
      const event = Array.isArray(booking.events) ? booking.events[0] : booking.events;
      const eventEndsAt = event?.ends_at ?? event?.starts_at;
      if (booking.status === "pending" && eventEndsAt && new Date(eventEndsAt) >= now) stats.pendingBookings += 1;
      bookingStatsByFacilitator.set(booking.facilitator_id, stats);
    }
    const participantEmail = booking.participant_email?.trim().toLowerCase();
    if (participantEmail) {
      participantBookingCountsByEmail.set(participantEmail, (participantBookingCountsByEmail.get(participantEmail) ?? 0) + 1);
    }
  }

  const countByFacilitator = (rows: Array<{ facilitator_id?: string | null }> | null | undefined) => {
    const counts = new Map<string, number>();
    for (const row of rows ?? []) {
      if (!row.facilitator_id) continue;
      counts.set(row.facilitator_id, (counts.get(row.facilitator_id) ?? 0) + 1);
    }
    return counts;
  };

  const reportCountsByFacilitator = countByFacilitator(reports as Array<{ facilitator_id?: string | null }> | null);
  const invoiceCountsByFacilitator = countByFacilitator(invoices as Array<{ facilitator_id?: string | null }> | null);
  const financialRecordCountsByFacilitator = new Map<string, number>();
  for (const record of (financialRecords ?? []) as Array<{ primary_facilitator_id?: string | null }>) {
    if (record.primary_facilitator_id) {
      financialRecordCountsByFacilitator.set(record.primary_facilitator_id, (financialRecordCountsByFacilitator.get(record.primary_facilitator_id) ?? 0) + 1);
    }
  }
  const coOrganizerCountsByFacilitator = new Map<string, number>();
  for (const relation of (coOrganizerRows ?? []) as Array<{ co_organizer_profile_id?: string | null; primary_organizer_profile_id?: string | null }>) {
    for (const id of [relation.primary_organizer_profile_id, relation.co_organizer_profile_id]) {
      if (id) coOrganizerCountsByFacilitator.set(id, (coOrganizerCountsByFacilitator.get(id) ?? 0) + 1);
    }
  }
  const notificationLogCountsByFacilitator = countByFacilitator(notificationLogs as Array<{ facilitator_id?: string | null }> | null);

  const categoriesByFacilitator = new Map<string, string[]>();
  for (const row of ((categoryRows ?? []) as CategoryRelationRow[])) {
    appendToMap(categoriesByFacilitator, row.facilitator_id, first(row.categories)?.name);
  }

  const tagsByFacilitator = new Map<string, string[]>();
  for (const row of ((tagRows ?? []) as TagRelationRow[])) {
    appendToMap(tagsByFacilitator, row.facilitator_id, first(row.tags)?.name);
  }

  const featuredByFacilitator = optionalFieldMap(featuredRows as OptionalFacilitatorFieldRow[] | null, "is_featured");
  const featuredSortByFacilitator = optionalFieldMap(featuredSortRows as OptionalFacilitatorFieldRow[] | null, "featured_sort_order");
  const autoApproveByFacilitator = optionalFieldMap(autoApproveRows as OptionalFacilitatorFieldRow[] | null, "auto_approve_events");
  const activeBadgeByFacilitator = optionalFieldMap(activeBadgeRows as OptionalFacilitatorFieldRow[] | null, "is_active_host");
  const experiencedBadgeByFacilitator = optionalFieldMap(experiencedBadgeRows as OptionalFacilitatorFieldRow[] | null, "is_experienced_host");

  const enrichedFacilitators: EnrichedFacilitatorRow[] = facilitators.map((facilitator) => {
    const user = first(facilitator.profiles);
    const eventStats = eventStatsByFacilitator.get(facilitator.id) ?? {
      activeEvents: 0,
      completedEvents: 0,
      draftEvents: 0,
      eventCount: 0,
      latestEventAt: null,
    };
    const bookingStats = bookingStatsByFacilitator.get(facilitator.id) ?? { pendingBookings: 0, totalBookings: 0 };
    const nonDraftEvents = eventStats.eventCount - eventStats.draftEvents;
    const monthlyReportCount = reportCountsByFacilitator.get(facilitator.id) ?? 0;
    const invoiceCount = invoiceCountsByFacilitator.get(facilitator.id) ?? 0;
    const financialRecordCount = financialRecordCountsByFacilitator.get(facilitator.id) ?? 0;
    const coOrganizerCount = coOrganizerCountsByFacilitator.get(facilitator.id) ?? 0;
    const participantBookingCount = user?.email ? (participantBookingCountsByEmail.get(user.email.trim().toLowerCase()) ?? 0) : 0;
    const notificationLogCount = notificationLogCountsByFacilitator.get(facilitator.id) ?? 0;
    const deletePreservesUserIdentity = (user?.role ?? "facilitator") !== "facilitator" || participantBookingCount > 0;
    const deleteBlockers = [
      nonDraftEvents > 0 ? `${nonDraftEvents} ${nonDraftEvents === 1 ? "event" : "events"}` : null,
      bookingStats.totalBookings > 0 ? `${bookingStats.totalBookings} ${bookingStats.totalBookings === 1 ? "tilmelding" : "tilmeldinger"}` : null,
      monthlyReportCount > 0 ? `${monthlyReportCount} ${monthlyReportCount === 1 ? "månedsrapport" : "månedsrapporter"}` : null,
      invoiceCount > 0 ? `${invoiceCount} ${invoiceCount === 1 ? "fakturakladde" : "fakturakladder"}` : null,
      financialRecordCount > 0 ? `${financialRecordCount} ${financialRecordCount === 1 ? "økonomisk snapshot" : "økonomiske snapshots"}` : null,
      coOrganizerCount > 0 ? `${coOrganizerCount} ${coOrganizerCount === 1 ? "medarrangørrelation" : "medarrangørrelationer"}` : null,
      notificationLogCount > 0 ? `${notificationLogCount} ${notificationLogCount === 1 ? "eventbesked-log" : "eventbesked-logs"}` : null,
    ].filter((item): item is string => Boolean(item));
    const historyCount =
      nonDraftEvents +
      bookingStats.totalBookings +
      monthlyReportCount +
      invoiceCount +
      financialRecordCount +
      coOrganizerCount +
      notificationLogCount;
    const categories = categoriesByFacilitator.get(facilitator.id) ?? [];
    const tags = tagsByFacilitator.get(facilitator.id) ?? [];
    const lastSignInAt = authActivityLookup.isComplete
      ? (authActivityLookup.activity.get(facilitator.profile_id)?.lastSignInAt ?? null)
      : undefined;

    return {
      active_events: eventStats.activeEvents,
      address_line: facilitator.address_line,
      auto_approve_events: Boolean(autoApproveByFacilitator.get(facilitator.id)),
      city: facilitator.city,
      can_delete: historyCount === 0,
      company_name: facilitator.company_name,
      completed_events: eventStats.completedEvents,
      created_at: facilitator.created_at,
      delete_blockers: deleteBlockers,
      delete_preserves_user_identity: deletePreservesUserIdentity,
      draft_events: eventStats.draftEvents,
      email: user?.email ?? "",
      event_count: eventStats.eventCount,
      facilitator_categories: categories,
      facilitator_tags: tags,
      featured_sort_order: Number(featuredSortByFacilitator.get(facilitator.id) ?? 0),
      full_name: user?.full_name ?? "",
      host_reference_id: facilitator.host_reference_id,
      id: facilitator.id,
      is_disabled: Boolean(facilitator.is_disabled),
      is_paused: Boolean(facilitator.is_paused),
      is_active_host: Boolean(activeBadgeByFacilitator.get(facilitator.id)),
      is_experienced_host: Boolean(experiencedBadgeByFacilitator.get(facilitator.id)),
      is_featured: Boolean(featuredByFacilitator.get(facilitator.id)),
      latest_event_at: eventStats.latestEventAt,
      last_sign_in_at: lastSignInAt,
      days_since_last_login: daysSince(lastSignInAt, now),
      long_description: facilitator.long_description,
      pending_bookings: bookingStats.pendingBookings,
      participant_booking_count: participantBookingCount,
      phone: user?.phone ?? null,
      postal_code: facilitator.postal_code,
      profile_id: facilitator.profile_id,
      profile_image_url: facilitator.profile_image_path ? supabase.storage.from("media").getPublicUrl(facilitator.profile_image_path).data.publicUrl : null,
      public_email: facilitator.public_email,
      public_phone: facilitator.public_phone,
      role: user?.role ?? "facilitator",
      short_description: facilitator.short_description,
      slug: facilitator.slug,
      specialties: facilitator.specialties,
      status: facilitator.status,
      total_bookings: bookingStats.totalBookings,
      website_url: facilitator.website_url,
    };
  });

  const matchingFacilitators = enrichedFacilitators
    .filter((facilitator) => selectedStatus === "all" || getFacilitatorAdminStatus(facilitator) === selectedStatus)
    .filter((facilitator) => matchesLoginActivityFilter(facilitator, selectedLoginActivity))
    .map((facilitator) => ({ facilitator, score: searchScore(facilitator, queryText) }))
    .filter(({ score }) => !queryText || score >= 0)
    .sort((firstItem, secondItem) => {
      if (queryText && firstItem.score !== secondItem.score) return secondItem.score - firstItem.score;
      if (selectedSort === "oldest") return new Date(firstItem.facilitator.created_at).getTime() - new Date(secondItem.facilitator.created_at).getTime();
      if (selectedSort === "name_asc") return facilitatorDisplayName(firstItem.facilitator).localeCompare(facilitatorDisplayName(secondItem.facilitator), "da");
      if (selectedSort === "name_desc") return facilitatorDisplayName(secondItem.facilitator).localeCompare(facilitatorDisplayName(firstItem.facilitator), "da");
      if (selectedSort === "activity_desc") return facilitatorActivityScore(secondItem.facilitator) - facilitatorActivityScore(firstItem.facilitator);
      if (selectedSort === "activity_asc") return facilitatorActivityScore(firstItem.facilitator) - facilitatorActivityScore(secondItem.facilitator);
      if (selectedSort === "events_desc") return secondItem.facilitator.event_count - firstItem.facilitator.event_count;
      if (selectedSort === "events_asc") return firstItem.facilitator.event_count - secondItem.facilitator.event_count;
      if (selectedSort === "last_login_desc") return lastLoginSortValue(secondItem.facilitator) - lastLoginSortValue(firstItem.facilitator);
      if (selectedSort === "last_login_asc") return lastLoginSortValue(firstItem.facilitator) - lastLoginSortValue(secondItem.facilitator);
      if (selectedSort === "priority") return facilitatorActivityDate(secondItem.facilitator) - facilitatorActivityDate(firstItem.facilitator);
      return new Date(secondItem.facilitator.created_at).getTime() - new Date(firstItem.facilitator.created_at).getTime();
    })
    .map(({ facilitator }) => facilitator);

  const { data: eventSearchRows } = q
    ? await supabase
        .from("events")
        .select(
          "id, slug, title, status, starts_at, created_at, updated_at, address_line, city, event_reference_id, facilitator_id, facilitator_profiles(company_name, profiles!facilitator_profiles_profile_id_fkey(full_name, email))",
        )
        .order("updated_at", { ascending: false })
        .limit(300)
    : { data: [] as EventRow[] };
  const eventSearchResults = ((eventSearchRows ?? []) as EventRow[]).filter((event) => {
    if (!queryText) return false;
    const facilitator = first(event.facilitator_profiles);
    const profile = first(facilitator?.profiles);

    return includesQuery(
      [
        event.title,
        event.event_reference_id,
        event.address_line,
        event.city,
        facilitator?.company_name,
        profile?.full_name,
        profile?.email,
      ],
      queryText,
    );
  });
  const hasFacilitatorSpecificFilters = selectedStatus !== "all" || selectedLoginActivity !== "all" || selectedSort !== "newest";
  const activeResultType: SearchResultType = q && requestedResultType === "events" ? "events" : "facilitators";
  const facilitatorTotalPages = Math.max(1, Math.ceil(matchingFacilitators.length / facilitatorsPerPage));
  const eventTotalPages = Math.max(1, Math.ceil(eventSearchResults.length / eventsPerPage));
  const facilitatorPage = Math.min(requestedFacilitatorPage, facilitatorTotalPages);
  const eventPage = Math.min(requestedEventPage, eventTotalPages);
  const visibleFacilitators = matchingFacilitators.slice((facilitatorPage - 1) * facilitatorsPerPage, facilitatorPage * facilitatorsPerPage);
  const visibleEvents = eventSearchResults.slice((eventPage - 1) * eventsPerPage, eventPage * eventsPerPage);
  const currentUsersHref = filteredUsersHref({
    eventPage: activeResultType === "events" ? eventPage : undefined,
    loginActivity: selectedLoginActivity,
    page: activeResultType === "facilitators" ? facilitatorPage : undefined,
    q,
    sort: selectedSort,
    status: selectedStatus,
    type: q ? activeResultType : undefined,
  });
  const clearedSearchHref = filteredUsersHref({
    loginActivity: selectedLoginActivity,
    sort: selectedSort,
    status: selectedStatus,
  });
  const facilitatorTabHref = filteredUsersHref({ loginActivity: selectedLoginActivity, q, sort: selectedSort, status: selectedStatus, type: "facilitators" });
  const eventTabHref = filteredUsersHref({ loginActivity: selectedLoginActivity, q, sort: selectedSort, status: selectedStatus, type: "events" });
  const facilitatorPageHref = (page: number) =>
    filteredUsersHref({ eventPage, loginActivity: selectedLoginActivity, page, q, sort: selectedSort, status: selectedStatus, type: q ? "facilitators" : undefined });
  const eventPageHref = (page: number) =>
    filteredUsersHref({ eventPage: page, loginActivity: selectedLoginActivity, page: facilitatorPage, q, sort: selectedSort, status: selectedStatus, type: "events" });

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Administrator</p>
            <h1 className="text-xl font-semibold text-midnight">Arrangørcenter</h1>
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

        <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
          <AdminUserSearchForm
            activeResultType={activeResultType}
            clearHref={clearedSearchHref}
            key={q ?? ""}
            query={q ?? ""}
            selectedLoginActivity={selectedLoginActivity}
            selectedSort={selectedSort}
            selectedStatus={selectedStatus}
          />
          {activeResultType === "facilitators" ? (
            <>
              <form action="/admin/users" className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
                {q ? <input name="q" type="hidden" value={q} /> : null}
                {q ? <input name="type" type="hidden" value="facilitators" /> : null}
                <label className="grid gap-2 text-sm font-semibold text-midnight">
                  Status
                  <select
                    className="h-11 rounded-md border border-midnight/15 bg-white px-3 text-sm outline-none transition focus:border-sage-700"
                    defaultValue={selectedStatus}
                    name="status"
                  >
                    {facilitatorStatusFilters.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-midnight">
                  Loginaktivitet
                  <select
                    className="h-11 rounded-md border border-midnight/15 bg-white px-3 text-sm outline-none transition focus:border-sage-700"
                    defaultValue={selectedLoginActivity}
                    name="login_activity"
                  >
                    {loginActivityFilters.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-midnight">
                  Sortering
                  <select
                    className="h-11 rounded-md border border-midnight/15 bg-white px-3 text-sm outline-none transition focus:border-sage-700"
                    defaultValue={selectedSort}
                    name="sort"
                  >
                    {facilitatorSortOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="h-11 rounded-md bg-midnight px-4 text-sm font-semibold text-white" type="submit">
                  Anvend
                </button>
              </form>
              <p className="mt-3 text-xs leading-5 text-ink/56">
                Aktivitet beregnes som aktive events vægtet højest, derefter afholdte events og tilmeldinger. Loginaktivitet hentes fra Supabase Auths seneste login-tidspunkt. Der findes ikke et pålideligt samlet loginantal endnu.
              </p>
            </>
          ) : (
            <div className="mt-5 rounded-[18px] border border-[#D8CBE4] bg-[#F4F0F7] px-4 py-3 text-sm leading-6 text-[#6E5A86]">
              Eventfanen bruger kun tekstsøgningen i denne visning. Loginaktivitet, arrangørstatus og arrangørsortering gælder kun fanen Arrangører.
            </div>
          )}
        </section>

        {q ? (
          <SearchResultTabs
            activeType={activeResultType}
            eventCount={eventSearchResults.length}
            eventHref={eventTabHref}
            facilitatorCount={matchingFacilitators.length}
            facilitatorHref={facilitatorTabHref}
          />
        ) : null}

        {activeResultType === "events" ? (
          <EventSearchResults
            currentPage={eventPage}
            events={visibleEvents}
            getPageHref={eventPageHref}
            hasFacilitatorFilters={hasFacilitatorSpecificFilters}
            query={q ?? ""}
            returnHref={currentUsersHref}
            totalCount={eventSearchResults.length}
            totalPages={eventTotalPages}
          />
        ) : (
          <UserRoleTable
            currentProfileId={profile.id}
            exportHref={filteredUsersHref({
              loginActivity: selectedLoginActivity,
              q,
              sort: selectedSort,
              status: selectedStatus,
            }).replace("/admin/users", "/admin/users/export")}
            facilitators={visibleFacilitators}
            highlightedFacilitatorId={highlight ?? null}
            pausedFacilitatorId={pausedFacilitatorId ?? null}
            returnHref={currentUsersHref}
          />
        )}

        {activeResultType === "facilitators" ? (
          <Pagination
            currentPage={facilitatorPage}
            getHref={facilitatorPageHref}
            label="Arrangørsider"
            totalItems={matchingFacilitators.length}
            totalPages={facilitatorTotalPages}
          />
        ) : null}
      </section>
    </main>
  );
}
