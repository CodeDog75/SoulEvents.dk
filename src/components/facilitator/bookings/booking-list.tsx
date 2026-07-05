import { Check, Slash, XCircle } from "lucide-react";
import { updateBookingStatusAction } from "@/app/facilitator/bookings/actions";
import type { BookingStatus } from "@/types/database";

type BookingRow = {
  id: string;
  event_id: string;
  status: BookingStatus;
  participant_name: string;
  participant_email: string;
  participant_phone: string | null;
  seats: number;
  message: string | null;
  event_title_snapshot: string;
  event_starts_at_snapshot: string;
  booking_value_cents: number;
  created_at: string;
};

type BookingListProps = {
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

function StatusAction({
  bookingId,
  status,
  children,
}: {
  bookingId: string;
  status: BookingStatus;
  children: React.ReactNode;
}) {
  return (
    <form action={updateBookingStatusAction}>
      <input name="booking_id" type="hidden" value={bookingId} />
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

export function BookingList({ bookings }: BookingListProps) {
  if (bookings.length === 0) {
    return (
      <section className="rounded-md border border-midnight/10 bg-white p-8 text-center shadow-soft">
        <h2 className="text-lg font-semibold text-midnight">Ingen tilmeldinger endnu</h2>
        <p className="mt-2 text-sm text-ink/64">Når besøgende tilmelder sig dine events, vises de her.</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-md border border-midnight/10 bg-white shadow-soft">
      <div className="border-b border-midnight/10 px-5 py-4">
        <h2 className="text-lg font-semibold text-midnight">Tilmeldinger</h2>
        <p className="mt-1 text-sm text-ink/64">Svar på nye tilmeldinger og send automatisk mail til deltageren.</p>
      </div>

      <div className="divide-y divide-midnight/10">
        {bookings.map((booking) => (
          <article className="grid gap-5 p-5 lg:grid-cols-[1fr_auto]" key={booking.id}>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink/60">
                <span className="rounded-md bg-sage-50 px-2.5 py-1 text-sage-700">
                  {statusLabels[booking.status]}
                </span>
                <span>{new Intl.DateTimeFormat("da-DK").format(new Date(booking.created_at))}</span>
              </div>

              <h3 className="mt-3 text-lg font-semibold text-midnight">{booking.event_title_snapshot}</h3>
              <p className="mt-1 text-sm text-ink/64">
                {new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(
                  new Date(booking.event_starts_at_snapshot),
                )}
              </p>

              <div className="mt-4 grid gap-2 text-sm text-ink/72 md:grid-cols-2">
                <p>
                  <span className="font-semibold text-midnight">Deltager:</span> {booking.participant_name}
                </p>
                <p>
                  <span className="font-semibold text-midnight">E-mail:</span> {booking.participant_email}
                </p>
                <p>
                  <span className="font-semibold text-midnight">Telefon:</span>{" "}
                  {booking.participant_phone || "Ikke angivet"}
                </p>
                <p>
                  <span className="font-semibold text-midnight">Pladser:</span> {booking.seats}
                </p>
                <p>
                  <span className="font-semibold text-midnight">Bookingværdi:</span>{" "}
                  {formatMoney(booking.booking_value_cents)}
                </p>
              </div>

              {booking.message && (
                <p className="mt-4 max-w-3xl rounded-md bg-sage-50 p-3 text-sm leading-6 text-ink/70">
                  {booking.message}
                </p>
              )}
            </div>

            <div className="flex flex-wrap content-start gap-2 lg:justify-end">
              {booking.status !== "confirmed" && (
                <StatusAction bookingId={booking.id} status="confirmed">
                  <Check className="size-4" aria-hidden="true" />
                  Bekræft
                </StatusAction>
              )}
              {booking.status !== "sold_out" && (
                <StatusAction bookingId={booking.id} status="sold_out">
                  <Slash className="size-4" aria-hidden="true" />
                  Udsolgt
                </StatusAction>
              )}
              {booking.status !== "cancelled" && (
                <StatusAction bookingId={booking.id} status="cancelled">
                  <XCircle className="size-4" aria-hidden="true" />
                  Aflys
                </StatusAction>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
