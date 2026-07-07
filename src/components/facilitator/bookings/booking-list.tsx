import Link from "next/link";
import { CalendarDays, Check, Slash, XCircle } from "lucide-react";
import { markEventSoldOutAction, updateBookingStatusAction } from "@/app/facilitator/bookings/actions";
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
  eventOptions: EventOption[];
  selectedEventId: string | null;
};

type EventOption = {
  id: string;
  title: string;
  starts_at: string;
  status: string;
  capacity: number;
  bookings?: Array<{
    id: string;
    status: BookingStatus;
    seats: number;
  }>;
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

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function getEventBookingStats(event: EventOption) {
  const bookings = event.bookings ?? [];
  const activeBookings = bookings.filter((booking) => ["pending", "confirmed"].includes(booking.status));
  const totalSeats = activeBookings.reduce((sum, booking) => sum + booking.seats, 0);
  const pendingSeats = bookings
    .filter((booking) => booking.status === "pending")
    .reduce((sum, booking) => sum + booking.seats, 0);
  const confirmedSeats = bookings
    .filter((booking) => booking.status === "confirmed")
    .reduce((sum, booking) => sum + booking.seats, 0);

  return {
    bookingCount: activeBookings.length,
    confirmedSeats,
    pendingSeats,
    totalSeats,
  };
}

function bookingLabel(count: number) {
  return count === 1 ? "1 booking" : `${count} bookinger`;
}

function StatusAction({
  bookingId,
  currentEventId,
  status,
  children,
}: {
  bookingId: string;
  currentEventId: string;
  status: BookingStatus;
  children: React.ReactNode;
}) {
  return (
    <form action={updateBookingStatusAction}>
      <input name="booking_id" type="hidden" value={bookingId} />
      <input name="current_event_id" type="hidden" value={currentEventId} />
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

function EventSelector({
  eventOptions,
  selectedEvent,
}: {
  eventOptions: EventOption[];
  selectedEvent: EventOption | null;
}) {
  if (eventOptions.length === 0) {
    return (
      <section className="rounded-md border border-midnight/10 bg-white p-8 text-center shadow-soft">
        <h2 className="text-lg font-semibold text-midnight">Ingen aktive events at vælge</h2>
        <p className="mt-2 text-sm text-ink/64">Når du har aktive kommende events, kan du administrere deres tilmeldinger her.</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-md border border-midnight/10 bg-white shadow-soft">
      <div className="border-b border-midnight/10 px-5 py-4">
        <h2 className="text-lg font-semibold text-midnight">Vælg event</h2>
        <p className="mt-1 text-sm text-ink/64">Start med at vælge det event, du vil se tilmeldinger for.</p>
      </div>
      <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
        {eventOptions.map((event) => {
          const stats = getEventBookingStats(event);
          const isSelected = selectedEvent?.id === event.id;

          return (
            <Link
              className={
                "rounded-md border p-4 transition hover:border-sage-700 " +
                (isSelected ? "border-sage-700 bg-sage-50 shadow-soft" : "border-midnight/10 bg-white")
              }
              href={"/facilitator/bookings?event=" + event.id}
              key={event.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold leading-snug text-midnight">{event.title}</h3>
                  <p className="mt-2 inline-flex items-center gap-2 text-sm text-ink/64">
                    <CalendarDays className="size-4 text-sage-700" aria-hidden="true" />
                    {formatEventDate(event.starts_at)}
                  </p>
                </div>
                <span className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-sage-700">
                  {event.status === "sold_out" ? "Udsolgt" : "Aktiv"}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-ink/64">
                <span className="rounded-md bg-white px-2.5 py-1">{stats.totalSeats} tilmeldte</span>
                <span className="rounded-md bg-white px-2.5 py-1">{bookingLabel(stats.bookingCount)}</span>
                <span className="rounded-md bg-white px-2.5 py-1">{stats.pendingSeats} afventer</span>
                <span className="rounded-md bg-white px-2.5 py-1">
                  {stats.confirmedSeats}/{event.capacity} bekræftede pladser
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function BookingList({ bookings, eventOptions, selectedEventId }: BookingListProps) {
  const selectedEvent = eventOptions.find((event) => event.id === selectedEventId) ?? null;

  return (
    <div className="grid gap-6">
      <EventSelector eventOptions={eventOptions} selectedEvent={selectedEvent} />

      {!selectedEvent ? (
        eventOptions.length > 0 ? (
          <section className="rounded-md border border-midnight/10 bg-white p-8 text-center shadow-soft">
            <h2 className="text-lg font-semibold text-midnight">Vælg et event først</h2>
            <p className="mt-2 text-sm text-ink/64">Når du har valgt et event ovenfor, vises kun tilmeldinger til det event.</p>
          </section>
        ) : null
      ) : (
    <section className="overflow-hidden rounded-md border border-midnight/10 bg-white shadow-soft">
      <div className="border-b border-midnight/10 px-5 py-4">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="text-lg font-semibold text-midnight">Tilmeldinger til {selectedEvent.title}</h2>
            <p className="mt-1 text-sm text-ink/64">
              {formatEventDate(selectedEvent.starts_at)} · Svar på nye tilmeldinger og send automatisk mail til deltageren.
            </p>
          </div>
          {selectedEvent.status === "sold_out" ? (
            <span className="inline-flex h-9 items-center justify-center rounded-md bg-sage-50 px-3 text-sm font-semibold text-sage-700">
              Eventet er udsolgt
            </span>
          ) : (
            <form action={markEventSoldOutAction}>
              <input name="event_id" type="hidden" value={selectedEvent.id} />
              <button
                className="inline-flex h-9 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
                type="submit"
              >
                <Slash className="size-4" aria-hidden="true" />
                Markér event som udsolgt
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="divide-y divide-midnight/10">
        {bookings.length === 0 ? (
          <div className="p-8 text-center">
            <h3 className="text-base font-semibold text-midnight">Ingen tilmeldinger til dette event endnu</h3>
            <p className="mt-2 text-sm text-ink/64">Når deltagere tilmelder sig det valgte event, vises de her.</p>
          </div>
        ) : bookings.map((booking) => (
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
              {booking.status === "pending" && (
                <StatusAction bookingId={booking.id} currentEventId={selectedEvent.id} status="confirmed">
                  <Check className="size-4" aria-hidden="true" />
                  Bekræft
                </StatusAction>
              )}
              {["pending", "confirmed"].includes(booking.status) && (
                <StatusAction bookingId={booking.id} currentEventId={selectedEvent.id} status="cancelled">
                  <XCircle className="size-4" aria-hidden="true" />
                  Aflys
                </StatusAction>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
      )}
    </div>
  );
}
