import { NextRequest, NextResponse } from "next/server";
import { getFacilitatorAdminStatus, type FacilitatorAdminStatus } from "@/components/admin/facilitator-status-badge";
import { requireRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function appendToMap(map: Map<string, string[]>, key: string | null, value: string | null | undefined) {
  if (!key || !value) {
    return;
  }

  map.set(key, [...(map.get(key) ?? []), value]);
}

type OptionalFacilitatorFieldRow = {
  auto_approve_events?: boolean | null;
  featured_sort_order?: number | null;
  id: string;
  is_active_host?: boolean | null;
  is_experienced_host?: boolean | null;
  is_featured?: boolean | null;
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

const facilitatorSortValues = new Set<FacilitatorSort>([
  "activity_asc",
  "activity_desc",
  "events_asc",
  "events_desc",
  "last_login_asc",
  "last_login_desc",
  "name_asc",
  "name_desc",
  "newest",
  "oldest",
  "priority",
]);
const loginActivityFilterValues = new Set<LoginActivityFilter>(["all", "never", "within_30", "inactive_30", "inactive_90", "inactive_180"]);
const statusFilterValues = new Set<"all" | FacilitatorAdminStatus>(["all", "pending", "changes_requested", "active", "paused", "disabled"]);

function optionalFieldMap(rows: OptionalFacilitatorFieldRow[] | null | undefined, field: keyof Omit<OptionalFacilitatorFieldRow, "id">) {
  return new Map((rows ?? []).map((row) => [row.id, row[field]]));
}

function normalizeSort(value: string | null): FacilitatorSort {
  return facilitatorSortValues.has(value as FacilitatorSort) ? (value as FacilitatorSort) : "newest";
}

function normalizeLoginActivityFilter(value: string | null): LoginActivityFilter {
  return loginActivityFilterValues.has(value as LoginActivityFilter) ? (value as LoginActivityFilter) : "all";
}

function normalizeStatusFilter(value: string | null): "all" | FacilitatorAdminStatus {
  return statusFilterValues.has(value as "all" | FacilitatorAdminStatus) ? (value as "all" | FacilitatorAdminStatus) : "all";
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

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
}

function daysSince(value: string | null | undefined, now = new Date()) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

function matchesLoginActivityFilter(days: number | null, lastSignInAt: string | null | undefined, filter: LoginActivityFilter) {
  if (filter === "all") return true;
  if (lastSignInAt === undefined) return false;
  if (filter === "never") return !lastSignInAt;
  if (days === null) return false;
  if (filter === "within_30") return days <= 30;
  if (filter === "inactive_30") return days > 30;
  if (filter === "inactive_90") return days > 90;
  if (filter === "inactive_180") return days > 180;
  return true;
}

function lastLoginSortValue(row: { last_sign_in_at: string | null | undefined }) {
  return row.last_sign_in_at ? new Date(row.last_sign_in_at).getTime() : Number.NEGATIVE_INFINITY;
}

function displayName(row: { company_name: string; full_name: string }) {
  return row.company_name || row.full_name || "Uden navn";
}

function activityScore(row: { active_events: number; completed_events: number; total_bookings: number }) {
  return row.active_events * 3 + row.completed_events + row.total_bookings;
}

async function getAuthActivityByProfileId(supabase: ReturnType<typeof createAdminClient>, profileIds: string[]) {
  const wantedIds = new Set(profileIds.filter(Boolean));
  const activity = new Map<string, { lastSignInAt: string | null }>();
  if (wantedIds.size === 0) return { activity, isComplete: true };

  let page = 1;
  const perPage = 1000;

  while (page <= 10 && activity.size < wantedIds.size) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });

    if (error) {
      console.error("[admin-users-export] Auth login activity lookup failed", {
        message: error.message,
        page,
      });
      return { activity, isComplete: false };
    }

    for (const user of data.users ?? []) {
      if (wantedIds.has(user.id)) {
        activity.set(user.id, { lastSignInAt: user.last_sign_in_at ?? null });
      }
    }

    if ((data.users ?? []).length < perPage) break;
    page += 1;
  }

  return { activity, isComplete: activity.size >= wantedIds.size };
}

export async function GET(request: NextRequest) {
  await requireRole("admin");

  const queryText = normalizeSearchValue(request.nextUrl.searchParams.get("q"));
  const selectedStatus = normalizeStatusFilter(request.nextUrl.searchParams.get("status"));
  const selectedLoginActivity = normalizeLoginActivityFilter(request.nextUrl.searchParams.get("login_activity"));
  const selectedSort = normalizeSort(request.nextUrl.searchParams.get("sort"));
  const supabase = createAdminClient();
  const [
    { data: facilitators },
    { data: events },
    { data: bookings },
    { data: categoryRows },
    { data: tagRows },
    { data: featuredRows },
    { data: featuredSortRows },
    { data: autoApproveRows },
    { data: activeBadgeRows },
    { data: experiencedBadgeRows },
  ] = await Promise.all([
    supabase
      .from("facilitator_profiles")
      .select(
        "id, profile_id, host_reference_id, status, is_paused, is_disabled, company_name, short_description, long_description, address_line, city, postal_code, public_email, public_phone, website_url, created_at, profiles!facilitator_profiles_profile_id_fkey(role, full_name, email, phone)",
      )
      .order("created_at", { ascending: false }),
    supabase.from("events").select("id, facilitator_id, status, starts_at"),
    supabase.from("bookings").select("id, facilitator_id, status, events(starts_at, ends_at)"),
    supabase.from("facilitator_categories").select("facilitator_id, categories(name)"),
    supabase.from("facilitator_tags").select("facilitator_id, tags(name)"),
    supabase.from("facilitator_profiles").select("id, is_featured"),
    supabase.from("facilitator_profiles").select("id, featured_sort_order"),
    supabase.from("facilitator_profiles").select("id, auto_approve_events"),
    supabase.from("facilitator_profiles").select("id, is_active_host"),
    supabase.from("facilitator_profiles").select("id, is_experienced_host"),
  ]);

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const eventStats = new Map<string, { active: number; completed: number; drafts: number; total: number; latest: string | null }>();
  for (const event of events ?? []) {
    if (!event.facilitator_id) continue;
    const stats = eventStats.get(event.facilitator_id) ?? { active: 0, completed: 0, drafts: 0, total: 0, latest: null };
    stats.total += 1;
    if (["active", "sold_out"].includes(event.status ?? "") && event.starts_at && new Date(event.starts_at) >= today) stats.active += 1;
    if (event.status === "draft") stats.drafts += 1;
    if (event.status === "completed" || (event.starts_at && new Date(event.starts_at) < today && !["cancelled", "draft"].includes(event.status ?? ""))) stats.completed += 1;
    if (event.starts_at && (!stats.latest || new Date(event.starts_at) > new Date(stats.latest))) stats.latest = event.starts_at;
    eventStats.set(event.facilitator_id, stats);
  }

  const bookingStats = new Map<string, { pending: number; total: number }>();
  for (const booking of (bookings ?? []) as Array<{
    events?: { ends_at?: string | null; starts_at?: string | null } | Array<{ ends_at?: string | null; starts_at?: string | null }> | null;
    facilitator_id?: string | null;
    status?: string | null;
  }>) {
    if (!booking.facilitator_id) continue;
    const stats = bookingStats.get(booking.facilitator_id) ?? { pending: 0, total: 0 };
    if (booking.status !== "cancelled") stats.total += 1;
    const event = first(booking.events);
    const eventEndsAt = event?.ends_at ?? event?.starts_at;
    if (booking.status === "pending" && eventEndsAt && new Date(eventEndsAt) >= now) stats.pending += 1;
    bookingStats.set(booking.facilitator_id, stats);
  }

  const categoriesByFacilitator = new Map<string, string[]>();
  for (const row of categoryRows ?? []) {
    appendToMap(categoriesByFacilitator, row.facilitator_id, first(row.categories)?.name);
  }

  const tagsByFacilitator = new Map<string, string[]>();
  for (const row of tagRows ?? []) {
    appendToMap(tagsByFacilitator, row.facilitator_id, first(row.tags)?.name);
  }

  const featuredByFacilitator = optionalFieldMap(featuredRows as OptionalFacilitatorFieldRow[] | null, "is_featured");
  const featuredSortByFacilitator = optionalFieldMap(featuredSortRows as OptionalFacilitatorFieldRow[] | null, "featured_sort_order");
  const autoApproveByFacilitator = optionalFieldMap(autoApproveRows as OptionalFacilitatorFieldRow[] | null, "auto_approve_events");
  const activeBadgeByFacilitator = optionalFieldMap(activeBadgeRows as OptionalFacilitatorFieldRow[] | null, "is_active_host");
  const experiencedBadgeByFacilitator = optionalFieldMap(experiencedBadgeRows as OptionalFacilitatorFieldRow[] | null, "is_experienced_host");
  const authActivityLookup = await getAuthActivityByProfileId(
    supabase,
    (facilitators ?? []).map((facilitator) => facilitator.profile_id).filter(Boolean),
  );

  const rows = (facilitators ?? []).map((facilitator) => {
    const profile = first(facilitator.profiles);
    const categories = categoriesByFacilitator.get(facilitator.id) ?? [];
    const tags = tagsByFacilitator.get(facilitator.id) ?? [];
    const eventsForFacilitator = eventStats.get(facilitator.id) ?? { active: 0, completed: 0, drafts: 0, total: 0, latest: null };
    const bookingsForFacilitator = bookingStats.get(facilitator.id) ?? { pending: 0, total: 0 };
    const lastSignInAt = authActivityLookup.isComplete
      ? (authActivityLookup.activity.get(facilitator.profile_id)?.lastSignInAt ?? null)
      : undefined;

    return {
      active_events: eventsForFacilitator.active,
      address: [facilitator.address_line, facilitator.postal_code, facilitator.city].filter(Boolean).join(", "),
      admin_status: profile?.role === "admin" ? "admin" : "facilitator",
      auto_approve_events: Boolean(autoApproveByFacilitator.get(facilitator.id)),
      badges: [
        activeBadgeByFacilitator.get(facilitator.id) ? "Aktiv Arrangør" : "",
        experiencedBadgeByFacilitator.get(facilitator.id) ? "Erfaren Arrangør" : "",
      ].filter(Boolean).join(", "),
      categories: categories.join(", "),
      city: facilitator.city ?? "",
      company_name: facilitator.company_name ?? "",
      completed_events: eventsForFacilitator.completed,
      created_at: facilitator.created_at,
      draft_events: eventsForFacilitator.drafts,
      email: profile?.email ?? "",
      featured_sort_order: featuredSortByFacilitator.get(facilitator.id) ?? 0,
      full_name: profile?.full_name ?? "",
      host_reference_id: facilitator.host_reference_id ?? "",
      is_featured: Boolean(featuredByFacilitator.get(facilitator.id)),
      latest_event_at: eventsForFacilitator.latest ?? "",
      is_disabled: Boolean(facilitator.is_disabled),
      is_paused: Boolean(facilitator.is_paused),
      last_sign_in_at: lastSignInAt,
      days_since_last_login: daysSince(lastSignInAt, now),
      pending_bookings: bookingsForFacilitator.pending,
      phone: profile?.phone ?? "",
      postal_code: facilitator.postal_code ?? "",
      public_email: facilitator.public_email ?? "",
      public_phone: facilitator.public_phone ?? "",
      status: facilitator.status,
      tags: tags.join(", "),
      total_bookings: bookingsForFacilitator.total,
      total_events: eventsForFacilitator.total,
      website_url: facilitator.website_url ?? "",
    };
  }).filter((row) => {
    if (selectedStatus !== "all" && getFacilitatorAdminStatus(row) !== selectedStatus) return false;
    if (!matchesLoginActivityFilter(row.days_since_last_login, row.last_sign_in_at, selectedLoginActivity)) return false;
    if (!queryText) return true;
    return normalizeSearchValue(Object.values(row).join(" ")).includes(queryText);
  }).sort((firstRow, secondRow) => {
    if (selectedSort === "oldest") return new Date(firstRow.created_at).getTime() - new Date(secondRow.created_at).getTime();
    if (selectedSort === "name_asc") return displayName(firstRow).localeCompare(displayName(secondRow), "da");
    if (selectedSort === "name_desc") return displayName(secondRow).localeCompare(displayName(firstRow), "da");
    if (selectedSort === "activity_desc") return activityScore(secondRow) - activityScore(firstRow);
    if (selectedSort === "activity_asc") return activityScore(firstRow) - activityScore(secondRow);
    if (selectedSort === "events_desc") return secondRow.total_events - firstRow.total_events;
    if (selectedSort === "events_asc") return firstRow.total_events - secondRow.total_events;
    if (selectedSort === "last_login_desc") return lastLoginSortValue(secondRow) - lastLoginSortValue(firstRow);
    if (selectedSort === "last_login_asc") return lastLoginSortValue(firstRow) - lastLoginSortValue(secondRow);
    if (selectedSort === "priority") return new Date(secondRow.latest_event_at || secondRow.created_at).getTime() - new Date(firstRow.latest_event_at || firstRow.created_at).getTime();
    return new Date(secondRow.created_at).getTime() - new Date(firstRow.created_at).getTime();
  });

  const headers = [
    "Medlemsnummer",
    "Arrangørnavn",
    "Kontaktperson",
    "E-mail",
    "Telefon",
    "Adresse",
    "Postnummer",
    "By",
    "Status",
    "Adminstatus",
    "Fremhævet",
    "Fremhævet prioritet",
    "Auto-godkendelse",
    "Badges",
    "Kategorier",
    "Tags",
    "Aktive events",
    "Events i alt",
    "Afholdte events",
    "Kladder",
    "Tilmeldinger i alt",
    "Afventer bekræftelse",
    "Seneste eventdato",
    "Seneste login",
    "Dage siden seneste login",
    "Login i alt",
    "Login sidste 90 dage",
    "Oprettet",
    "Website",
  ];
  const lines = [
    headers.map(csvCell).join(";"),
    ...rows.map((row) =>
      [
        row.host_reference_id,
        row.company_name,
        row.full_name,
        row.email,
        row.phone || row.public_phone,
        row.address,
        row.postal_code,
        row.city,
        row.status,
        row.admin_status,
        row.is_featured ? "ja" : "nej",
        row.featured_sort_order,
        row.auto_approve_events ? "ja" : "nej",
        row.badges,
        row.categories,
        row.tags,
        row.active_events,
        row.total_events,
        row.completed_events,
        row.draft_events,
        row.total_bookings,
        row.pending_bookings,
        row.latest_event_at,
        row.last_sign_in_at === undefined ? "Loginaktivitet ikke registreret" : (row.last_sign_in_at ?? "Aldrig logget ind"),
        row.days_since_last_login ?? "",
        "Ikke registreret",
        "Ikke registreret",
        row.created_at,
        row.website_url,
      ].map(csvCell).join(";"),
    ),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Disposition": 'attachment; filename="soulevents-arrangoerer.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
