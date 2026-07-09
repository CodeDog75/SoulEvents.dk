import { NextRequest, NextResponse } from "next/server";
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

function optionalFieldMap(rows: OptionalFacilitatorFieldRow[] | null | undefined, field: keyof Omit<OptionalFacilitatorFieldRow, "id">) {
  return new Map((rows ?? []).map((row) => [row.id, row[field]]));
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
}

export async function GET(request: NextRequest) {
  await requireRole("admin");

  const queryText = (request.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
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
        "id, profile_id, host_reference_id, status, company_name, short_description, long_description, address_line, city, postal_code, public_email, public_phone, website_url, created_at, profiles(role, full_name, email, phone)",
      )
      .order("created_at", { ascending: false }),
    supabase.from("events").select("id, facilitator_id, status, starts_at"),
    supabase.from("bookings").select("id, facilitator_id, status"),
    supabase.from("facilitator_categories").select("facilitator_id, categories(name)"),
    supabase.from("facilitator_tags").select("facilitator_id, tags(name)"),
    supabase.from("facilitator_profiles").select("id, is_featured"),
    supabase.from("facilitator_profiles").select("id, featured_sort_order"),
    supabase.from("facilitator_profiles").select("id, auto_approve_events"),
    supabase.from("facilitator_profiles").select("id, is_active_host"),
    supabase.from("facilitator_profiles").select("id, is_experienced_host"),
  ]);

  const today = new Date();
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
  for (const booking of bookings ?? []) {
    if (!booking.facilitator_id) continue;
    const stats = bookingStats.get(booking.facilitator_id) ?? { pending: 0, total: 0 };
    if (booking.status !== "cancelled") stats.total += 1;
    if (booking.status === "pending") stats.pending += 1;
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

  const rows = (facilitators ?? []).map((facilitator) => {
    const profile = first(facilitator.profiles);
    const categories = categoriesByFacilitator.get(facilitator.id) ?? [];
    const tags = tagsByFacilitator.get(facilitator.id) ?? [];
    const eventsForFacilitator = eventStats.get(facilitator.id) ?? { active: 0, completed: 0, drafts: 0, total: 0, latest: null };
    const bookingsForFacilitator = bookingStats.get(facilitator.id) ?? { pending: 0, total: 0 };

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
    if (!queryText) return true;
    return Object.values(row).join(" ").toLowerCase().includes(queryText);
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
