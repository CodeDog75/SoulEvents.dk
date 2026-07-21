"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, ChevronDown, Copy, Mail, MessageSquare, Phone, Search, Slash, Ticket, UserRound } from "lucide-react";
import {
  markEventSoldOutAction,
  updateBookingManualPaymentAction,
  updateBookingSeatsAction,
  updateBookingStatusAction,
} from "@/app/facilitator/bookings/actions";
import { CapacityBadge } from "@/components/events/capacity-badge";
import { CancelBookingAction } from "@/components/facilitator/bookings/cancel-booking-action";
import { ParticipantListMenu } from "@/components/facilitator/bookings/participant-list-menu";
import { PaymentReminderAction } from "@/components/facilitator/bookings/payment-reminder-action";
import { formatPaymentDate, parsePaymentInstructionsSnapshot } from "@/lib/payment-instructions";
import type { BookingStatus, Json } from "@/types/database";

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
  booking_number: number | null;
  booking_reference: string | null;
  booking_value_cents: number;
  payment_reference: string | null;
  payment_instructions_snapshot: Json | null;
  payment_due_at: string | null;
  payment_snapshot_created_at: string | null;
  payment_reminder_sent_at: string | null;
  manually_marked_paid_at: string | null;
  manually_marked_paid_by: string | null;
  manual_payment_note: string | null;
  created_at: string;
};

type BookingListProps = {
  bookings: BookingRow[];
  eventOptions: EventOption[];
  initialExpandedBookingId?: string | null;
  selectedEventId: string | null;
};

type EventOption = {
  address_line?: string | null;
  city?: string | null;
  id: string;
  title: string;
  starts_at: string;
  status: string;
  capacity?: number | null;
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
  cancelled: "Annulleret",
  completed: "Afholdt",
  invoiced: "Faktureret",
  paid: "Betalt",
};

const statusBadgeClasses: Record<BookingStatus, string> = {
  pending: "bg-[#F1E2BD] text-[#6E5528]",
  confirmed: "bg-[#DDE8D7] text-[#4F6F48]",
  sold_out: "bg-midnight/10 text-midnight",
  cancelled: "bg-rose/10 text-rose",
  completed: "bg-sand text-midnight",
  invoiced: "bg-midnight/10 text-midnight",
  paid: "bg-sage-50 text-sage-700",
};

const bookingCardClasses: Partial<Record<BookingStatus, string>> = {
  pending: "border-[#E6D4A8] bg-[#FBF5E8]",
  confirmed: "border-[#C9DAC1] bg-[#F1F5EE]",
  cancelled: "border-[#E5DDEA] bg-[#FAF7F2]",
};

function formatMoney(cents: number) {
  return `${new Intl.NumberFormat("da-DK").format(cents / 100)} kr.`;
}

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatShortDateTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function CopyReferenceButton({ reference }: { reference: string }) {
  const [copied, setCopied] = useState(false);

  async function copyReference() {
    if (!navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(reference);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-midnight/12 bg-white px-2.5 text-xs font-semibold text-midnight transition hover:border-lavender hover:text-lavender"
      onClick={() => {
        void copyReference();
      }}
      type="button"
    >
      <Copy className="size-3.5" aria-hidden="true" />
      {copied ? "Kopieret" : "Kopiér"}
    </button>
  );
}

function paymentStatusLabel(booking: BookingRow): "Afventer" | "Betalt" | "Ikke relevant" {
  if (booking.booking_value_cents <= 0) {
    return "Ikke relevant";
  }

  return booking.manually_marked_paid_at ? "Betalt" : "Afventer";
}

function canSendPaymentReminder(booking: BookingRow, paymentSnapshot: ReturnType<typeof parsePaymentInstructionsSnapshot>) {
  if (booking.status !== "confirmed") {
    return "Kun bekræftede tilmeldinger kan få en betalingspåmindelse.";
  }

  if (booking.booking_value_cents <= 0) {
    return "Gratis tilmeldinger har ikke betalingspåmindelser.";
  }

  if (booking.manually_marked_paid_at) {
    return "Tilmeldingen er allerede markeret som betalt.";
  }

  if (!paymentSnapshot || paymentSnapshot.source === "none") {
    return "Der findes ikke betalingsoplysninger fra bekræftelsen.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booking.participant_email)) {
    return "Deltageren mangler en gyldig e-mailadresse.";
  }

  if (booking.payment_reminder_sent_at) {
    const latestReminderAt = new Date(booking.payment_reminder_sent_at);
    if (Date.now() - latestReminderAt.getTime() < 24 * 60 * 60 * 1000) {
      return "Der er allerede sendt en påmindelse inden for 24 timer.";
    }
  }

  return null;
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
    availableSeats: typeof event.capacity === "number" ? Math.max(event.capacity - totalSeats, 0) : null,
    confirmedSeats,
    pendingSeats,
    totalSeats,
  };
}

function bookingLabel(count: number) {
  return count === 1 ? "1 booking" : `${count} bookinger`;
}

type BookingFilter = "all" | "confirmed" | "pending" | "paid" | "unpaid" | "cancelled";
type BookingSort = "newest" | "oldest" | "name_asc" | "name_desc" | "unpaid_first" | "paid_first" | "value_desc" | "value_asc";

const bookingFilters: Array<{ label: string; value: BookingFilter }> = [
  { label: "Alle", value: "all" },
  { label: "Bekræftet", value: "confirmed" },
  { label: "Afventer", value: "pending" },
  { label: "Betalt", value: "paid" },
  { label: "Mangler betaling", value: "unpaid" },
  { label: "Annulleret", value: "cancelled" },
];

const bookingSortOptions: Array<{ label: string; value: BookingSort }> = [
  { label: "Nyeste først", value: "newest" },
  { label: "Ældste først", value: "oldest" },
  { label: "Navn A-Å", value: "name_asc" },
  { label: "Navn Å-A", value: "name_desc" },
  { label: "Mangler betaling først", value: "unpaid_first" },
  { label: "Betalt først", value: "paid_first" },
  { label: "Bookingværdi høj/lav", value: "value_desc" },
  { label: "Bookingværdi lav/høj", value: "value_asc" },
];

function matchesBookingFilter(booking: BookingRow, filter: BookingFilter) {
  const isPaidBooking = booking.booking_value_cents > 0;
  const isMarkedPaid = Boolean(booking.manually_marked_paid_at);

  if (filter === "all") return true;
  if (filter === "confirmed") return booking.status === "confirmed";
  if (filter === "pending") return booking.status === "pending";
  if (filter === "cancelled") return booking.status === "cancelled";
  if (filter === "paid") return isPaidBooking && isMarkedPaid;
  if (filter === "unpaid") return isPaidBooking && booking.status === "confirmed" && !isMarkedPaid;

  return true;
}

function paymentSortValue(booking: BookingRow) {
  if (booking.booking_value_cents <= 0) return 2;
  return booking.manually_marked_paid_at ? 1 : 0;
}

function sortBookings(bookings: BookingRow[], sort: BookingSort) {
  return [...bookings].sort((a, b) => {
    if (sort === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sort === "name_asc") return a.participant_name.localeCompare(b.participant_name, "da");
    if (sort === "name_desc") return b.participant_name.localeCompare(a.participant_name, "da");
    if (sort === "unpaid_first") return paymentSortValue(a) - paymentSortValue(b);
    if (sort === "paid_first") return paymentSortValue(b) - paymentSortValue(a);
    if (sort === "value_desc") return b.booking_value_cents - a.booking_value_cents;
    if (sort === "value_asc") return a.booking_value_cents - b.booking_value_cents;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function StatusAction({
  bookingId,
  currentEventId,
  status,
  children,
  variant = "secondary",
}: {
  bookingId: string;
  currentEventId: string;
  status: BookingStatus;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <form action={updateBookingStatusAction} className="w-full sm:w-auto">
      <input name="booking_id" type="hidden" value={bookingId} />
      <input name="current_event_id" type="hidden" value={currentEventId} />
      <input name="status" type="hidden" value={status} />
      <button
        className={
          "inline-flex h-9 w-full items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition sm:w-auto " +
          (variant === "primary"
            ? "bg-sage-700 text-white hover:bg-olive"
            : "border border-midnight/15 bg-white text-midnight hover:border-sage-700 hover:text-sage-700")
        }
        type="submit"
      >
        {children}
      </button>
    </form>
  );
}

function BookingArticle({
  booking,
  currentEventId,
  isExpanded,
  onToggle,
  showActions = true,
}: {
  booking: BookingRow;
  currentEventId: string;
  isExpanded: boolean;
  onToggle: () => void;
  showActions?: boolean;
}) {
  const cardClass = bookingCardClasses[booking.status] ?? "border-midnight/10 bg-white";
  const paymentSnapshot = parsePaymentInstructionsSnapshot(booking.payment_instructions_snapshot);
  const isPaidEventBooking = booking.booking_value_cents > 0;
  const isManuallyMarkedPaid = Boolean(booking.manually_marked_paid_at);
  const isCancelledBooking = booking.status === "cancelled";
  const reminderDisabledReason = canSendPaymentReminder(booking, paymentSnapshot);
  const paymentLabel = isPaidEventBooking ? (isManuallyMarkedPaid ? "Betalt" : "Afventer betaling") : "Gratis";

  return (
    <article className={"border-l-4 transition " + cardClass} id={`booking-${booking.id}`} key={booking.id}>
      <button
        aria-expanded={isExpanded}
        className="grid w-full gap-4 p-4 text-left transition hover:bg-white/45 md:grid-cols-[minmax(0,1.35fr)_repeat(5,minmax(7rem,auto))_auto] md:items-center"
        onClick={onToggle}
        type="button"
      >
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-base font-semibold text-midnight">
            <UserRound className="size-4 shrink-0 text-lavender" aria-hidden="true" />
            {booking.booking_number ? (
              <span className="shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold text-lavender shadow-soft">#{booking.booking_number}</span>
            ) : null}
            <span className="truncate">{booking.participant_name}</span>
          </p>
          <p className="mt-1 truncate text-sm text-ink/62">{booking.participant_email}</p>
        </div>
        <div className="flex flex-wrap gap-2 md:contents">
          <span className="rounded-md bg-white/75 px-3 py-2 text-sm font-semibold text-midnight shadow-soft md:text-center">
            {booking.seats} {booking.seats === 1 ? "plads" : "pladser"}
          </span>
          <span className="rounded-md bg-white/75 px-3 py-2 text-sm font-semibold text-midnight shadow-soft md:text-center">
            {formatMoney(booking.booking_value_cents)}
          </span>
          <span className="rounded-md bg-white/75 px-3 py-2 text-sm font-semibold text-midnight shadow-soft md:text-center">
            {formatShortDateTime(booking.created_at)}
          </span>
          <span className={"rounded-md px-3 py-2 text-sm font-semibold md:text-center " + statusBadgeClasses[booking.status]}>
            {statusLabels[booking.status]}
          </span>
          <span
            className={
              "rounded-md px-3 py-2 text-sm font-semibold md:text-center " +
              (isPaidEventBooking
                ? isManuallyMarkedPaid
                  ? statusBadgeClasses.paid
                  : "bg-[#FFF8E8] text-[#6E5528]"
                : "bg-sage-50 text-sage-700")
            }
          >
            {paymentLabel}
          </span>
        </div>
        <ChevronDown
          className={"size-5 justify-self-end text-lavender transition " + (isExpanded ? "rotate-180" : "")}
          aria-hidden="true"
        />
      </button>

      {isExpanded ? (
        <div className="grid gap-5 border-t border-midnight/10 p-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold leading-snug text-midnight">{booking.event_title_snapshot}</h3>
            <div className="mt-4 grid gap-2 text-sm text-ink/72 md:grid-cols-2 xl:grid-cols-3">
              <p className="min-w-0 rounded-md bg-white/70 px-3 py-2">
                <span className="block text-xs font-semibold uppercase tracking-wide text-ink/48">Bookingreference</span>
                <span className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                  <span className="font-semibold text-midnight [overflow-wrap:anywhere]">{booking.booking_reference || booking.payment_reference || "Ikke oprettet"}</span>
                  {booking.booking_reference ? <CopyReferenceButton reference={booking.booking_reference} /> : null}
                </span>
              </p>
              <p className="min-w-0 rounded-md bg-white/70 px-3 py-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink/48">
                  <Mail className="size-3.5" aria-hidden="true" />
                  E-mail
                </span>
                <span className="font-semibold text-midnight [overflow-wrap:anywhere]">{booking.participant_email}</span>
              </p>
              <p className="min-w-0 rounded-md bg-white/70 px-3 py-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink/48">
                  <Phone className="size-3.5" aria-hidden="true" />
                  Telefon
                </span>
                <span className="font-semibold text-midnight [overflow-wrap:anywhere]">{booking.participant_phone || "Ikke angivet"}</span>
              </p>
              <p className="min-w-0 rounded-md bg-white/70 px-3 py-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink/48">
                  <Ticket className="size-3.5" aria-hidden="true" />
                  Pladser
                </span>
                <span className="font-semibold text-midnight">{booking.seats}</span>
              </p>
              <p className="min-w-0 rounded-md bg-white/70 px-3 py-2">
                <span className="block text-xs font-semibold uppercase tracking-wide text-ink/48">Bookingværdi</span>
                <span className="font-semibold text-midnight">{formatMoney(booking.booking_value_cents)}</span>
              </p>
              <p className="min-w-0 rounded-md bg-white/70 px-3 py-2 md:col-span-2">
                <span className="block text-xs font-semibold uppercase tracking-wide text-ink/48">Eventdato</span>
                <span className="font-semibold text-midnight">{formatShortDateTime(booking.event_starts_at_snapshot)}</span>
              </p>
              <p className="min-w-0 rounded-md bg-white/70 px-3 py-2">
                <span className="block text-xs font-semibold uppercase tracking-wide text-ink/48">Tilmeldingsdato</span>
                <span className="font-semibold text-midnight">{formatShortDateTime(booking.created_at)}</span>
              </p>
            </div>

            {booking.message && (
              <div className="mt-4 max-w-3xl rounded-md border border-white/70 bg-white/75 p-3 text-sm leading-6 text-ink/70">
                <p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink/48">
                  <MessageSquare className="size-3.5" aria-hidden="true" />
                  Deltagerens besked
                </p>
                <p className="[overflow-wrap:anywhere]">{booking.message}</p>
              </div>
            )}

            {paymentSnapshot ? (
              <div className="mt-4 grid gap-3 rounded-md border border-sage-700/10 bg-[#EEF7F0] p-4 text-sm leading-6 text-sage-700">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide">Betalingsoplysninger sendt</p>
                  <p className="mt-1 font-semibold text-midnight">Reference: {paymentSnapshot.reference}</p>
                  <p className="text-ink/65">
                    {paymentSnapshot.dueAt ? `Frist: ${formatPaymentDate(paymentSnapshot.dueAt)}` : "Betaling aftales direkte med arrangøren."}
                  </p>
                </div>
                {paymentSnapshot.methods.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {paymentSnapshot.methods.map((method) => (
                      <span
                        className="rounded-full bg-white px-3 py-1 font-semibold text-sage-700 shadow-soft"
                        key={`${booking.id}-${method.type}-${method.value}`}
                      >
                        {method.label}
                      </span>
                    ))}
                  </div>
                ) : null}
                {paymentSnapshot.note ? <p className="text-ink/65">{paymentSnapshot.note}</p> : null}
              </div>
            ) : null}

            {isPaidEventBooking ? (
              <div
                className={
                  "mt-4 grid gap-3 rounded-md border p-4 text-sm leading-6 " +
                  (isManuallyMarkedPaid
                    ? "border-sage-700/15 bg-[#EEF7F0] text-sage-700"
                    : "border-[#E8D6A8] bg-[#FFF8E8] text-[#6E5528]")
                }
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide">Manuel betalingsregistrering</p>
                  <p className="mt-1 font-semibold text-midnight">
                    {isManuallyMarkedPaid ? (isCancelledBooking ? "Tidligere markeret betalt" : "Betalt") : "Ikke registreret som betalt"}
                  </p>
                  {booking.manually_marked_paid_at ? (
                    <p className="text-ink/65">
                      Markeret{" "}
                      {new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(booking.manually_marked_paid_at))}
                    </p>
                  ) : (
                    <p className="text-ink/65">SoulEvents verificerer ikke betalingen. Markér kun efter egen kontrol.</p>
                  )}
                  {isCancelledBooking && isManuallyMarkedPaid ? (
                    <p className="text-ink/65">Tilmeldingen er aflyst, men historikken er bevaret.</p>
                  ) : null}
                  {booking.manual_payment_note ? <p className="mt-1 text-ink/65">Note: {booking.manual_payment_note}</p> : null}
                </div>
              </div>
            ) : null}
          </div>

          {showActions ? (
            <div className="grid content-start gap-3">
              {isPaidEventBooking && booking.status === "confirmed" ? (
                <div className="rounded-md border border-midnight/10 bg-white/80 p-3">
                  <ManualPaymentAction booking={booking} currentEventId={currentEventId} />
                  <div className="mt-3 border-t border-midnight/10 pt-3">
                    <PaymentReminderAction
                      bookingId={booking.id}
                      currentEventId={currentEventId}
                      disabledReason={reminderDisabledReason}
                      latestReminderAt={booking.payment_reminder_sent_at}
                      participantEmail={booking.participant_email}
                      participantName={booking.participant_name}
                    />
                  </div>
                </div>
              ) : null}
              <SeatAdjustmentAction booking={booking} currentEventId={currentEventId} />
              {booking.status === "pending" && (
                <StatusAction bookingId={booking.id} currentEventId={currentEventId} status="confirmed" variant="primary">
                  <Check className="size-4" aria-hidden="true" />
                  Bekræft
                </StatusAction>
              )}
              <div className="pt-1">
                {["pending", "confirmed"].includes(booking.status) && (
                  <CancelBookingAction bookingId={booking.id} currentEventId={currentEventId} />
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function ManualPaymentAction({
  booking,
  currentEventId,
}: {
  booking: BookingRow;
  currentEventId: string;
}) {
  if (booking.booking_value_cents <= 0 || booking.status !== "confirmed") {
    return null;
  }

  const isMarkedPaid = Boolean(booking.manually_marked_paid_at);

  return (
    <form action={updateBookingManualPaymentAction} className="grid w-full gap-3">
      <input name="booking_id" type="hidden" value={booking.id} />
      <input name="current_event_id" type="hidden" value={currentEventId} />
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-ink/48">Betalingsstatus</p>
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-md bg-sand/35 p-1">
          <button
            className={
              "rounded-md px-3 py-2 text-sm font-semibold transition " +
              (!isMarkedPaid ? "bg-white text-[#6E5528] shadow-soft" : "text-ink/62 hover:bg-white/70")
            }
            disabled={!isMarkedPaid}
            name="payment_action"
            type="submit"
            value="clear"
          >
            Afventer betaling
          </button>
          <button
            className={
              "rounded-md px-3 py-2 text-sm font-semibold transition " +
              (isMarkedPaid ? "bg-[#EEF7F0] text-sage-700 shadow-soft" : "text-ink/62 hover:bg-white/70")
            }
            disabled={isMarkedPaid}
            name="payment_action"
            type="submit"
            value="mark"
          >
            Betalt
          </button>
        </div>
      </div>
      <label className="grid gap-1 text-sm font-semibold text-midnight">
        Intern note til betalingsstatus
        <input
          className="h-9 w-full rounded-md border border-midnight/15 bg-white px-3 text-sm text-midnight placeholder:text-ink/35"
          defaultValue={booking.manual_payment_note ?? ""}
          maxLength={160}
          name="manual_payment_note"
          placeholder="Valgfri note til dit eget overblik"
        />
      </label>
    </form>
  );
}

function SeatAdjustmentAction({
  booking,
  currentEventId,
}: {
  booking: BookingRow;
  currentEventId: string;
}) {
  if (!["pending", "confirmed"].includes(booking.status)) {
    return null;
  }

  return (
    <form action={updateBookingSeatsAction} className="rounded-md border border-midnight/10 bg-white/80 p-3">
      <input name="booking_id" type="hidden" value={booking.id} />
      <input name="current_event_id" type="hidden" value={currentEventId} />
      <label className="grid gap-1 text-sm font-semibold text-midnight" htmlFor={"booking-seats-" + booking.id}>
        Justér antal pladser
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          className="h-9 w-24 rounded-md border border-midnight/15 bg-white px-2 text-sm font-semibold text-midnight"
          defaultValue={booking.seats}
          id={"booking-seats-" + booking.id}
          min={1}
          name="seats"
          type="number"
        />
        <button
          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700 sm:flex-none"
          type="submit"
        >
          Gem antal
        </button>
      </div>
      <p className="mt-2 text-xs text-ink/55">Kan ændres, hvis der er ledig kapacitet. Betalingsstatus bevares.</p>
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
                <CapacityBadge availableSeats={stats.availableSeats} capacity={event.capacity} className="justify-center text-center" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-ink/64">
                <span className="rounded-md bg-white px-2.5 py-1">{stats.totalSeats} tilmeldte</span>
                <span className="rounded-md bg-white px-2.5 py-1">{bookingLabel(stats.bookingCount)}</span>
                <span className="rounded-md bg-white px-2.5 py-1">{stats.pendingSeats} afventer</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function BookingList({ bookings, eventOptions, initialExpandedBookingId, selectedEventId }: BookingListProps) {
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(initialExpandedBookingId ?? null);
  const [filter, setFilter] = useState<BookingFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setSort] = useState<BookingSort>("newest");
  const selectedEvent = eventOptions.find((event) => event.id === selectedEventId) ?? null;
  const selectedEventStats = selectedEvent ? getEventBookingStats(selectedEvent) : null;
  const selectedEventLocation = selectedEvent
    ? [selectedEvent.address_line, selectedEvent.city].filter(Boolean).join(", ") || null
    : null;
  const participantRows = bookings.map((booking) => ({
    bookingValueCents: booking.booking_value_cents,
    createdAt: booking.created_at,
    email: booking.participant_email,
    id: booking.id,
    manualPaymentNote: booking.manual_payment_note,
    message: booking.message,
    name: booking.participant_name,
    paymentDueAt: booking.payment_due_at,
    paymentReference: booking.payment_reference,
    paymentStatus: paymentStatusLabel(booking),
    phone: booking.participant_phone,
    seats: booking.seats,
    status: booking.status,
  }));
  const visibleBookings = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();
    const searchedBookings = normalizedSearchTerm
      ? bookings.filter((booking) =>
          [booking.participant_name, booking.participant_email, booking.participant_phone]
            .filter(Boolean)
            .some((value) => value?.toLowerCase().includes(normalizedSearchTerm)),
        )
      : bookings;

    return sortBookings(
      searchedBookings.filter((booking) => matchesBookingFilter(booking, filter)),
      sort,
    );
  }, [bookings, filter, searchTerm, sort]);

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
                <h2 className="text-lg font-semibold text-midnight">{selectedEvent.title}</h2>
                <p className="mt-1 text-sm text-ink/64">{formatEventDate(selectedEvent.starts_at)}</p>
                {selectedEventStats && (
                  <CapacityBadge availableSeats={selectedEventStats.availableSeats} capacity={selectedEvent.capacity} className="mt-2" />
                )}
              </div>
              {selectedEvent.status === "sold_out" ? (
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <ParticipantListMenu
                    bookings={participantRows}
                    eventLocation={selectedEventLocation}
                    eventStartsAt={selectedEvent.starts_at}
                    eventTitle={selectedEvent.title}
                  />
                  <span className="inline-flex h-9 items-center justify-center rounded-md bg-sage-50 px-3 text-sm font-semibold text-sage-700">
                    Eventet er udsolgt
                  </span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <ParticipantListMenu
                    bookings={participantRows}
                    eventLocation={selectedEventLocation}
                    eventStartsAt={selectedEvent.starts_at}
                    eventTitle={selectedEvent.title}
                  />
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
                </div>
              )}
            </div>
          </div>

          {bookings.length > 0 ? (
            <div className="grid gap-4 border-b border-midnight/10 bg-[#FBF8F4] px-5 py-4">
              <label className="relative block">
                <span className="sr-only">Søg i tilmeldinger</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-lavender" aria-hidden="true" />
                <input
                  className="h-11 w-full rounded-md border border-midnight/12 bg-white pl-10 pr-3 text-sm font-semibold text-midnight placeholder:text-ink/40"
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Søg på navn, e-mail eller telefon"
                  type="search"
                  value={searchTerm}
                />
              </label>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap gap-2">
                  {bookingFilters.map((bookingFilter) => (
                    <button
                      className={
                        "h-9 rounded-md px-3 text-sm font-semibold transition " +
                        (filter === bookingFilter.value
                          ? "bg-lavender text-white shadow-soft"
                          : "border border-midnight/12 bg-white text-midnight hover:border-lavender hover:text-lavender")
                      }
                      key={bookingFilter.value}
                      onClick={() => setFilter(bookingFilter.value)}
                      type="button"
                    >
                      {bookingFilter.label}
                    </button>
                  ))}
                </div>
                <label className="grid gap-1 text-sm font-semibold text-midnight sm:max-w-xs">
                  Sortering
                  <select
                    className="h-10 rounded-md border border-midnight/12 bg-white px-3 text-sm font-semibold text-midnight"
                    onChange={(event) => setSort(event.target.value as BookingSort)}
                    value={sort}
                  >
                    {bookingSortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ) : null}

          <div className="divide-y divide-midnight/10">
            {bookings.length === 0 ? (
              <div className="p-8 text-center">
                <h3 className="text-base font-semibold text-midnight">Ingen tilmeldinger til dette event endnu</h3>
                <p className="mt-2 text-sm text-ink/64">Når deltagere tilmelder sig det valgte event, vises de her.</p>
              </div>
            ) : visibleBookings.length === 0 ? (
              <div className="p-8 text-center">
                <h3 className="text-base font-semibold text-midnight">Ingen tilmeldinger matcher filtrene</h3>
                <p className="mt-2 text-sm text-ink/64">Prøv at ændre søgning, filter eller sortering.</p>
              </div>
            ) : (
              visibleBookings.map((booking) => (
                <BookingArticle
                  booking={booking}
                  currentEventId={selectedEvent.id}
                  isExpanded={expandedBookingId === booking.id}
                  key={booking.id}
                  onToggle={() => setExpandedBookingId((currentId) => (currentId === booking.id ? null : booking.id))}
                  showActions={booking.status !== "cancelled"}
                />
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}
