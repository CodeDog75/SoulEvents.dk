import type { BookingStatus } from "@/types/database";

type BookingRow = {
  id: string;
  status: BookingStatus;
  participant_name: string;
  participant_email: string;
  seats: number;
  event_title_snapshot: string;
  event_starts_at_snapshot: string;
  facilitator_name_snapshot: string;
  primary_category_snapshot: string | null;
  booking_value_cents: number;
  commission_cents: number;
  created_at: string;
};

type AdminBookingTableProps = {
  bookings: BookingRow[];
};

const statusLabels: Record<BookingStatus, string> = {
  pending: "Afventer",
  confirmed: "Bekræftet",
  sold_out: "Udsolgt",
  cancelled: "Aflyst",
  completed: "Afholdt",
  invoiced: "Faktureret",
  paid: "Betalt",
};

function formatMoney(cents: number) {
  return `${new Intl.NumberFormat("da-DK").format(cents / 100)} kr.`;
}

export function AdminBookingTable({ bookings }: AdminBookingTableProps) {
  if (bookings.length === 0) {
    return (
      <section className="rounded-md border border-midnight/10 bg-white p-8 text-center shadow-soft">
        <h2 className="text-lg font-semibold text-midnight">Ingen tilmeldinger matcher filtrene</h2>
        <p className="mt-2 text-sm text-ink/64">Prøv at fjerne et filter eller vælge en bredere periode.</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-md border border-midnight/10 bg-white shadow-soft">
      <div className="border-b border-midnight/10 px-5 py-4">
        <h2 className="text-lg font-semibold text-midnight">Tilmeldinger</h2>
        <p className="mt-1 text-sm text-ink/64">Seneste tilmeldinger med økonomi og kommission.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1040px] w-full border-collapse text-left text-sm">
          <thead className="bg-sage-50 text-xs uppercase tracking-wide text-ink/60">
            <tr>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Facilitator</th>
              <th className="px-4 py-3">Deltager</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Pladser</th>
              <th className="px-4 py-3 text-right">Bookingværdi</th>
              <th className="px-4 py-3 text-right">Kommission</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-midnight/10">
            {bookings.map((booking) => (
              <tr key={booking.id}>
                <td className="px-4 py-4 align-top">
                  <p className="font-semibold text-midnight">{booking.event_title_snapshot}</p>
                  <p className="mt-1 text-xs text-ink/56">
                    {new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(
                      new Date(booking.event_starts_at_snapshot),
                    )}
                  </p>
                  {booking.primary_category_snapshot && (
                    <p className="mt-1 text-xs text-sage-700">{booking.primary_category_snapshot}</p>
                  )}
                </td>
                <td className="px-4 py-4 align-top text-ink/72">{booking.facilitator_name_snapshot}</td>
                <td className="px-4 py-4 align-top">
                  <p className="font-medium text-midnight">{booking.participant_name}</p>
                  <p className="mt-1 text-xs text-ink/56">{booking.participant_email}</p>
                </td>
                <td className="px-4 py-4 align-top">
                  <span className="rounded-md bg-sage-50 px-2.5 py-1 text-xs font-semibold text-sage-700">
                    {statusLabels[booking.status]}
                  </span>
                </td>
                <td className="px-4 py-4 text-right align-top text-ink/72">{booking.seats}</td>
                <td className="px-4 py-4 text-right align-top font-semibold text-midnight">
                  {formatMoney(booking.booking_value_cents)}
                </td>
                <td className="px-4 py-4 text-right align-top font-semibold text-terracotta">
                  {formatMoney(booking.commission_cents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
