import { requireRole } from "@/lib/auth/roles";
import { billableBookingStatuses } from "@/lib/commission/terms";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function csv(headers: string[], rows: unknown[][]) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\n");
}

function kroner(cents: number | null | undefined) {
  return ((cents ?? 0) / 100).toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function percentFromBps(bps: number | null | undefined) {
  return ((bps ?? 0) / 100).toLocaleString("da-DK", { maximumFractionDigits: 2 });
}

function response(name: string, content: string) {
  return new Response("\ufeff" + content, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

export async function GET(request: Request) {
  await requireRole("admin");
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "booking-lines";
  const supabase = createAdminClient();

  if (type === "monthly-report") {
    const { data } = await supabase
      .from("monthly_reports")
      .select("id, facilitator_id, period_start, period_end, total_bookings, total_seats, booking_value_cents, commission_cents, created_at, facilitator_profiles(company_name, profiles!facilitator_profiles_profile_id_fkey(full_name))")
      .order("period_start", { ascending: false });

    const rows = (data ?? []).map((report) => {
      const facilitator = first(report.facilitator_profiles);
      const profile = first(facilitator?.profiles);
      return [
        report.id,
        report.period_start,
        report.period_end,
        facilitator?.company_name || profile?.full_name || "Arrangør",
        report.total_bookings,
        report.total_seats,
        kroner(report.booking_value_cents),
        kroner(report.commission_cents),
        report.created_at,
      ];
    });

    return response(
      "soulevents-maanedsrapporter",
      csv(["Rapport-ID", "Periode start", "Periode slut", "Arrangør", "Tilmeldinger", "Pladser", "Bookingværdi", "Kommission", "Oprettet"], rows),
    );
  }

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, event_id, facilitator_id, status, created_at, seats, price_per_seat_cents, booking_value_cents, commission_cents, commission_rate_bps, commission_threshold_cents, commission_source, commission_currency, reporting_month, event_title_snapshot, event_starts_at_snapshot, facilitator_name_snapshot")
    .in("status", [...billableBookingStatuses])
    .order("reporting_month", { ascending: false });

  if (type === "facilitator-totals") {
    const totals = new Map<
      string,
      {
        bookingValueCents: number;
        commissionCents: number;
        facilitatorName: string;
        seats: number;
        totalBookings: number;
      }
    >();

    for (const booking of bookings ?? []) {
      const current = totals.get(booking.facilitator_id) ?? {
        bookingValueCents: 0,
        commissionCents: 0,
        facilitatorName: booking.facilitator_name_snapshot,
        seats: 0,
        totalBookings: 0,
      };
      current.bookingValueCents += booking.booking_value_cents ?? 0;
      current.commissionCents += booking.commission_cents ?? 0;
      current.seats += booking.seats ?? 0;
      current.totalBookings += 1;
      totals.set(booking.facilitator_id, current);
    }

    return response(
      "soulevents-arrangoer-totaler",
      csv(
        ["Arrangør-ID", "Arrangør", "Tilmeldinger", "Pladser", "Bookingværdi", "Kommission"],
        [...totals.entries()].map(([facilitatorId, total]) => [
          facilitatorId,
          total.facilitatorName,
          total.totalBookings,
          total.seats,
          kroner(total.bookingValueCents),
          kroner(total.commissionCents),
        ]),
      ),
    );
  }

  const rows = (bookings ?? []).map((booking) => [
    booking.id,
    booking.reporting_month,
    booking.status,
    booking.event_title_snapshot,
    booking.event_starts_at_snapshot,
    booking.facilitator_name_snapshot,
    booking.seats,
    kroner(booking.price_per_seat_cents),
    kroner(booking.booking_value_cents),
    kroner(booking.commission_threshold_cents),
    percentFromBps(booking.commission_rate_bps),
    kroner(booking.commission_cents),
    booking.commission_source,
    booking.commission_currency,
    booking.created_at,
  ]);

  return response(
    type === "invoice-basis" ? "soulevents-fakturagrundlag" : "soulevents-bookinglinjer",
    csv(
      [
        "Tilmelding-ID",
        "Rapporteringsmåned",
        "Status",
        "Event",
        "Eventdato",
        "Arrangør",
        "Pladser",
        "Pris pr. plads",
        "Bookingværdi",
        "Anvendt grænse",
        "Anvendt sats",
        "Kommission",
        "Vilkårstype",
        "Valuta",
        "Oprettet",
      ],
      rows,
    ),
  );
}
