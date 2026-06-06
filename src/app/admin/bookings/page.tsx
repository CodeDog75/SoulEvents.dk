import Link from "next/link";
import { ArrowLeft, Banknote, CalendarDays, ReceiptText, Ticket, UsersRound } from "lucide-react";
import { AdminBookingFilters } from "@/components/admin/bookings/admin-booking-filters";
import { AdminBookingTable } from "@/components/admin/bookings/admin-booking-table";
import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { BookingStatus } from "@/types/database";

export const dynamic = "force-dynamic";

type AdminBookingsPageProps = {
  searchParams: Promise<{
    facilitator?: string;
    status?: string;
    from?: string;
    to?: string;
  }>;
};

function formatMoney(cents: number) {
  return `${new Intl.NumberFormat("da-DK").format(cents / 100)} kr.`;
}

function validDate(value?: string) {
  if (!value) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

export default async function AdminBookingsPage({ searchParams }: AdminBookingsPageProps) {
  await requireRole("admin");
  const params = await searchParams;
  const selected = {
    facilitator: params.facilitator ?? "",
    status: params.status ?? "",
    from: validDate(params.from),
    to: validDate(params.to),
  };

  const supabase = await createClient();

  const { data: facilitators } = await supabase
    .from("facilitator_profiles")
    .select("id, company_name, profiles(full_name)")
    .order("company_name");

  let query = supabase
    .from("bookings")
    .select(
      "id, status, participant_name, participant_email, seats, event_title_snapshot, event_starts_at_snapshot, facilitator_name_snapshot, primary_category_snapshot, booking_value_cents, commission_cents, created_at",
    )
    .order("created_at", { ascending: false });

  if (selected.facilitator) {
    query = query.eq("facilitator_id", selected.facilitator);
  }

  if (selected.status) {
    query = query.eq("status", selected.status as BookingStatus);
  }

  if (selected.from) {
    query = query.gte("created_at", `${selected.from}T00:00:00.000Z`);
  }

  if (selected.to) {
    query = query.lte("created_at", `${selected.to}T23:59:59.999Z`);
  }

  const { data: bookings } = await query;
  const rows = (bookings ?? []) as Array<{
    seats: number;
    booking_value_cents: number;
    commission_cents: number;
    status: BookingStatus;
  }>;
  const totalBookings = rows.length;
  const totalSeats = rows.reduce((sum, booking) => sum + booking.seats, 0);
  const totalBookingValue = rows.reduce((sum, booking) => sum + booking.booking_value_cents, 0);
  const totalCommission = rows.reduce((sum, booking) => sum + booking.commission_cents, 0);
  const confirmedCount = rows.filter((booking) => booking.status === "confirmed").length;

  const stats = [
    { label: "Tilmeldinger", value: totalBookings, icon: UsersRound },
    { label: "Pladser", value: totalSeats, icon: Ticket },
    { label: "Bookingværdi", value: formatMoney(totalBookingValue), icon: Banknote },
    { label: "Kommission", value: formatMoney(totalCommission), icon: ReceiptText },
  ];

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-midnight text-white">
              <CalendarDays className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Administrator</p>
              <h1 className="text-xl font-semibold text-midnight">Tilmeldinger og statistik</h1>
            </div>
          </div>
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta"
            href="/admin"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Tilbage
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-4">
          {stats.map((stat) => (
            <article className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft" key={stat.label}>
              <stat.icon className="size-5 text-terracotta" aria-hidden="true" />
              <p className="mt-4 text-2xl font-semibold text-midnight">{stat.value}</p>
              <p className="mt-1 text-sm text-ink/64">{stat.label}</p>
            </article>
          ))}
        </div>

        <section className="rounded-md border border-sage-700/15 bg-sage-50 p-5">
          <h2 className="font-semibold text-midnight">Bekræftede tilmeldinger</h2>
          <p className="mt-1 text-sm text-ink/64">
            {confirmedCount} af {totalBookings} tilmeldinger i det aktuelle filter er bekræftet.
          </p>
        </section>

        <AdminBookingFilters facilitators={(facilitators ?? []) as never} selected={selected} />
        <AdminBookingTable bookings={(bookings ?? []) as never} />
      </section>
    </main>
  );
}
