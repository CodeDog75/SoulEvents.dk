import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { UserRoleTable } from "@/components/admin/users/user-role-table";
import { AuthMessage } from "@/components/auth/auth-message";
import { requireRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AdminUsersPageProps = {
  searchParams: Promise<{
    message?: string;
    q?: string;
  }>;
};

type FacilitatorRow = {
  address_line: string | null;
  city: string | null;
  company_name: string | null;
  created_at: string;
  host_reference_id: string | null;
  id: string;
  long_description: string | null;
  postal_code: string | null;
  profile_id: string;
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
  status: "approved" | "disabled" | "pending";
  website_url: string | null;
};

type EventRow = {
  created_at: string | null;
  facilitator_id: string | null;
  id: string;
  starts_at: string | null;
  status: string | null;
};

type BookingRow = {
  facilitator_id: string | null;
  id: string;
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
  status?: string | null;
  website_url?: string | null;
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
  return String(value ?? "").trim().toLowerCase();
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
  const exactFields = [...primaryFields, ...contactFields, ...locationFields, facilitator.host_reference_id];
  const badgeFields = [...facilitator.facilitator_categories, ...facilitator.facilitator_tags];

  if (exactFields.some((value) => normalizeSearchValue(value) === queryText)) return 1000;
  if (startsWithQuery(primaryFields, queryText)) return 900;
  if (primaryFields.some((value) => normalizeSearchValue(value).split(/\s+/).some((word) => word.startsWith(queryText)))) return 850;
  if (startsWithQuery([facilitator.host_reference_id, facilitator.email, facilitator.phone, facilitator.city, facilitator.postal_code], queryText)) return 760;
  if (startsWithQuery(badgeFields, queryText)) return 700;
  if (includesQuery(primaryFields, queryText)) return 650;
  if (includesQuery([...contactFields, ...locationFields, facilitator.host_reference_id], queryText)) return 550;
  if (includesQuery(badgeFields, queryText)) return 450;
  if (
    includesQuery(
      [
        facilitator.role,
        facilitator.status,
        facilitator.short_description,
        facilitator.long_description,
        facilitator.website_url,
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

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const [{ message, q }, profile] = await Promise.all([searchParams, requireRole("admin")]);
  const queryText = (q ?? "").trim().toLowerCase();
  const supabase = createAdminClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
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
        "id, profile_id, host_reference_id, status, company_name, short_description, long_description, address_line, city, postal_code, public_email, public_phone, website_url, created_at, profiles(id, role, full_name, email, phone, created_at)",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("events")
      .select("id, facilitator_id, status, starts_at, created_at"),
    supabase
      .from("bookings")
      .select("id, facilitator_id, status"),
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
  for (const booking of ((bookings ?? []) as BookingRow[])) {
    if (!booking.facilitator_id) continue;
    const stats = bookingStatsByFacilitator.get(booking.facilitator_id) ?? { pendingBookings: 0, totalBookings: 0 };
    if (booking.status !== "cancelled") stats.totalBookings += 1;
    if (booking.status === "pending") stats.pendingBookings += 1;
    bookingStatsByFacilitator.set(booking.facilitator_id, stats);
  }

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

  const enrichedFacilitators = ((facilitators ?? []) as FacilitatorRow[]).map((facilitator) => {
    const user = first(facilitator.profiles);
    const eventStats = eventStatsByFacilitator.get(facilitator.id) ?? {
      activeEvents: 0,
      completedEvents: 0,
      draftEvents: 0,
      eventCount: 0,
      latestEventAt: null,
    };
    const bookingStats = bookingStatsByFacilitator.get(facilitator.id) ?? { pendingBookings: 0, totalBookings: 0 };
    const categories = categoriesByFacilitator.get(facilitator.id) ?? [];
    const tags = tagsByFacilitator.get(facilitator.id) ?? [];

    return {
      active_events: eventStats.activeEvents,
      address_line: facilitator.address_line,
      auto_approve_events: Boolean(autoApproveByFacilitator.get(facilitator.id)),
      city: facilitator.city,
      company_name: facilitator.company_name,
      completed_events: eventStats.completedEvents,
      created_at: facilitator.created_at,
      draft_events: eventStats.draftEvents,
      email: user?.email ?? "",
      event_count: eventStats.eventCount,
      facilitator_categories: categories,
      facilitator_tags: tags,
      featured_sort_order: Number(featuredSortByFacilitator.get(facilitator.id) ?? 0),
      full_name: user?.full_name ?? "",
      host_reference_id: facilitator.host_reference_id,
      id: facilitator.id,
      is_active_host: Boolean(activeBadgeByFacilitator.get(facilitator.id)),
      is_experienced_host: Boolean(experiencedBadgeByFacilitator.get(facilitator.id)),
      is_featured: Boolean(featuredByFacilitator.get(facilitator.id)),
      latest_event_at: eventStats.latestEventAt,
      long_description: facilitator.long_description,
      pending_bookings: bookingStats.pendingBookings,
      phone: user?.phone ?? null,
      postal_code: facilitator.postal_code,
      profile_id: facilitator.profile_id,
      public_email: facilitator.public_email,
      public_phone: facilitator.public_phone,
      role: user?.role ?? "facilitator",
      short_description: facilitator.short_description,
      status: facilitator.status,
      total_bookings: bookingStats.totalBookings,
      website_url: facilitator.website_url,
    };
  });

  const visibleFacilitators = enrichedFacilitators
    .map((facilitator) => ({ facilitator, score: searchScore(facilitator, queryText) }))
    .filter(({ score }) => !queryText || score >= 0)
    .sort((firstItem, secondItem) => {
      if (queryText && firstItem.score !== secondItem.score) return secondItem.score - firstItem.score;
      if (firstItem.facilitator.is_featured !== secondItem.facilitator.is_featured) return firstItem.facilitator.is_featured ? -1 : 1;
      return (firstItem.facilitator.featured_sort_order ?? 0) - (secondItem.facilitator.featured_sort_order ?? 0);
    })
    .map(({ facilitator }) => facilitator);
  const currentUsersHref = "/admin/users" + (q ? "?q=" + encodeURIComponent(q) : "");

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Administrator</p>
            <h1 className="text-xl font-semibold text-midnight">Arrangører og admin</h1>
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
          <form action="/admin/users" className="grid gap-2">
            <label className="text-sm font-semibold text-midnight" htmlFor="admin-user-search">
              Søg arrangør eller admin
            </label>
            <div className="flex min-w-0 gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/45" aria-hidden="true" />
                <input
                  className="h-11 w-full rounded-md border border-midnight/15 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-sage-700"
                  defaultValue={q ?? ""}
                  id="admin-user-search"
                  name="q"
                  placeholder="Søg navn, e-mail, telefon, adresse, by, medlemsnummer, status, tags eller profiltekst"
                />
              </div>
              <button className="h-11 rounded-md bg-midnight px-4 text-sm font-semibold text-white" type="submit">
                Søg
              </button>
            </div>
          </form>
        </section>

        <UserRoleTable
          currentProfileId={profile.id}
          exportHref={"/admin/users/export" + (q ? "?q=" + encodeURIComponent(q) : "")}
          facilitators={visibleFacilitators}
          returnHref={currentUsersHref}
        />
      </section>
    </main>
  );
}
