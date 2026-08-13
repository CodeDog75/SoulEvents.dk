/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireRole } from "@/lib/auth/roles";
import { formatDanishEventDateTime } from "@/lib/events/date-format";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function namesFromRows(rows: any[] | null | undefined, relationName: string) {
  return (rows ?? [])
    .map((row) => first(row?.[relationName])?.name)
    .filter(Boolean)
    .join(", ");
}

function kroner(cents: number | null | undefined) {
  return ((cents ?? 0) / 100).toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateValue(value: string | null | undefined) {
  return value ? formatDanishEventDateTime(value, "") : "";
}

function boolValue(value: boolean | null | undefined) {
  return value ? "Ja" : "Nej";
}

function cell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return "<td>" + text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;") + "</td>";
}

function row(values: unknown[]) {
  return "<tr>" + values.map(cell).join("") + "</tr>";
}

function section(title: string, headers: string[], rows: unknown[][]) {
  return `
    <h2>${title}</h2>
    <table border="1">
      <thead>${row(headers)}</thead>
      <tbody>${rows.map(row).join("")}</tbody>
    </table>
    <br />
  `;
}

function numberByKey(rows: any[] | null | undefined, key: string) {
  const map = new Map<string, number>();
  for (const item of rows ?? []) {
    const id = item?.[key];
    if (!id) continue;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

function sumByKey(rows: any[] | null | undefined, key: string, valueKey: string) {
  const map = new Map<string, number>();
  for (const item of rows ?? []) {
    const id = item?.[key];
    if (!id) continue;
    map.set(id, (map.get(id) ?? 0) + (Number(item?.[valueKey]) || 0));
  }
  return map;
}

export async function GET(request: Request) {
  await requireRole("admin");

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const fromIso = from ? new Date(from + "T00:00:00.000Z").toISOString() : null;
  const toIso = to ? new Date(to + "T23:59:59.999Z").toISOString() : null;

  const supabase = createAdminClient();

  let eventsQuery = supabase
    .from("events")
    .select(
      "id, event_reference_id, facilitator_id, title, status, created_at, starts_at, ends_at, city, country, price_cents, capacity, event_format, event_categories(categories(name)), event_main_categories(main_categories(name)), event_subcategories(subcategories(name)), event_tags(tags(name))",
    )
    .order("starts_at", { ascending: false });

  let bookingsQuery = supabase
    .from("bookings")
    .select("id, event_id, facilitator_id, status, created_at, seats, price_per_seat_cents, booking_value_cents, event_title_snapshot, event_starts_at_snapshot")
    .order("created_at", { ascending: false });

  let viewsQuery = supabase.from("facilitator_profile_views").select("facilitator_id, viewed_at");

  if (fromIso) {
    eventsQuery = eventsQuery.gte("starts_at", fromIso);
    bookingsQuery = bookingsQuery.gte("created_at", fromIso);
    viewsQuery = viewsQuery.gte("viewed_at", fromIso);
  }
  if (toIso) {
    eventsQuery = eventsQuery.lte("starts_at", toIso);
    bookingsQuery = bookingsQuery.lte("created_at", toIso);
    viewsQuery = viewsQuery.lte("viewed_at", toIso);
  }

  const [
    { data: facilitators },
    { data: events },
    { data: bookings },
    { data: reminders },
    viewsResult,
  ] = await Promise.all([
    supabase
      .from("facilitator_profiles")
      .select(
        "id, host_reference_id, status, company_name, public_email, public_phone, website_url, facebook_url, instagram_url, address_line, postal_code, city, country, created_at, offers_services, service_description, specialties, profiles!facilitator_profiles_profile_id_fkey(full_name, email, phone), regions(name), facilitator_categories(categories(name)), facilitator_tags(tags(name))",
      )
      .order("created_at", { ascending: false }),
    eventsQuery,
    bookingsQuery,
    supabase.from("facilitator_event_reminders").select("facilitator_id, status"),
    viewsQuery,
  ]);

  const views = viewsResult.error ? [] : (viewsResult.data ?? []);
  const eventsByFacilitator = numberByKey(events, "facilitator_id");
  const bookingsByFacilitator = numberByKey(bookings, "facilitator_id");
  const seatsByFacilitator = sumByKey(bookings, "facilitator_id", "seats");
  const bookingValueByFacilitator = sumByKey(bookings, "facilitator_id", "booking_value_cents");
  const viewsByFacilitator = numberByKey(views, "facilitator_id");
  const remindersByFacilitator = new Map<string, number>();
  for (const reminder of reminders ?? []) {
    if (reminder.status !== "active") continue;
    remindersByFacilitator.set(reminder.facilitator_id, (remindersByFacilitator.get(reminder.facilitator_id) ?? 0) + 1);
  }

  const statusCount = (facilitatorId: string, status: string) => (events ?? []).filter((event: any) => event.facilitator_id === facilitatorId && event.status === status).length;

  const eventBookings = numberByKey(bookings, "event_id");
  const eventSeats = sumByKey(bookings, "event_id", "seats");
  const eventBookingValue = sumByKey(bookings, "event_id", "booking_value_cents");
  const facilitatorNameById = new Map<string, string>();
  const facilitatorRefById = new Map<string, string>();

  const facilitatorRows = (facilitators ?? []).map((facilitator: any) => {
    const profile = first(facilitator.profiles);
    const name = facilitator.company_name || profile?.full_name || "";
    facilitatorNameById.set(facilitator.id, name);
    facilitatorRefById.set(facilitator.id, facilitator.host_reference_id || "");

    return [
      facilitator.host_reference_id,
      facilitator.status,
      name,
      profile?.full_name,
      profile?.email,
      profile?.phone,
      facilitator.public_email,
      facilitator.public_phone,
      facilitator.website_url,
      facilitator.facebook_url,
      facilitator.instagram_url,
      facilitator.address_line,
      facilitator.postal_code,
      facilitator.city,
      first(facilitator.regions)?.name,
      facilitator.country,
      namesFromRows(facilitator.facilitator_categories, "categories"),
      namesFromRows(facilitator.facilitator_tags, "tags"),
      boolValue(facilitator.offers_services),
      facilitator.specialties,
      facilitator.service_description,
      dateValue(facilitator.created_at),
      viewsByFacilitator.get(facilitator.id) ?? 0,
      remindersByFacilitator.get(facilitator.id) ?? 0,
      eventsByFacilitator.get(facilitator.id) ?? 0,
      statusCount(facilitator.id, "draft"),
      statusCount(facilitator.id, "active"),
      statusCount(facilitator.id, "completed"),
      statusCount(facilitator.id, "cancelled"),
      bookingsByFacilitator.get(facilitator.id) ?? 0,
      seatsByFacilitator.get(facilitator.id) ?? 0,
      kroner(bookingValueByFacilitator.get(facilitator.id) ?? 0),
    ];
  });

  const eventRows = (events ?? []).map((event: any) => [
    event.event_reference_id,
    event.title,
    event.status,
    facilitatorRefById.get(event.facilitator_id) ?? "",
    facilitatorNameById.get(event.facilitator_id) ?? "",
    dateValue(event.created_at),
    dateValue(event.starts_at),
    dateValue(event.ends_at),
    event.event_format,
    event.city,
    event.country,
    namesFromRows(event.event_main_categories, "main_categories"),
    namesFromRows(event.event_subcategories, "subcategories"),
    namesFromRows(event.event_categories, "categories"),
    namesFromRows(event.event_tags, "tags"),
    kroner(event.price_cents),
    event.capacity,
    eventBookings.get(event.id) ?? 0,
    eventSeats.get(event.id) ?? 0,
    kroner(eventBookingValue.get(event.id) ?? 0),
  ]);

  const bookingRows = (bookings ?? []).map((booking: any) => [
    booking.id,
    booking.status,
    dateValue(booking.created_at),
    booking.event_title_snapshot,
    dateValue(booking.event_starts_at_snapshot),
    facilitatorRefById.get(booking.facilitator_id) ?? "",
    facilitatorNameById.get(booking.facilitator_id) ?? "",
    booking.seats,
    kroner(booking.price_per_seat_cents),
    kroner(booking.booking_value_cents),
  ]);

  const periodText = from || to ? `${from || "start"} - ${to || "nu"}` : "Alle data";
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; color: #2F2437; }
    h1 { color: #2F2437; }
    h2 { color: #7A5D91; margin-top: 28px; }
    table { border-collapse: collapse; margin-bottom: 20px; }
    th, td { padding: 7px 9px; vertical-align: top; }
    thead td { background: #F4F0F7; font-weight: bold; }
  </style>
</head>
<body>
  <h1>SoulEvents statistikeksport</h1>
  <p>Periode: ${periodText}</p>
  ${section("Arrangører", [
    "Arrangør-ID", "Status", "Vist navn/virksomhed", "Rigtigt navn", "Login e-mail", "Privat telefon", "Offentlig e-mail", "Offentlig telefon", "Hjemmeside", "Facebook", "Instagram", "Adresse", "Postnummer", "By", "Område", "Land", "Kategorier", "Tags", "Tilbyder ydelser", "Mit speciale", "Ydelsesbeskrivelse", "Oprettet", "Profilvisninger", "Påmindelses-mails", "Events i perioden", "Kladder", "Aktive", "Afholdte", "Aflyste", "Tilmeldinger", "Pladser", "Bookingværdi"
  ], facilitatorRows)}
  ${section("Events", [
    "Event-ID", "Titel", "Status", "Arrangør-ID", "Arrangør", "Oprettet", "Start", "Slut", "Format", "By", "Land", "Hovedkategorier", "Underkategorier", "Kategorier", "Tags", "Deltagerpris", "Kapacitet", "Tilmeldinger", "Pladser", "Bookingværdi"
  ], eventRows)}
  ${section("Tilmeldingsgrundlag", [
    "Tilmelding-ID", "Status", "Oprettet", "Event", "Eventdato", "Arrangør-ID", "Arrangør", "Pladser", "Pris pr. plads", "Bookingværdi"
  ], bookingRows)}
</body>
</html>`;

  const fileDate = new Date().toISOString().slice(0, 10);
  return new Response(html, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="soulevents-statistik-${fileDate}.xls"`,
      "Cache-Control": "no-store",
    },
  });
}
