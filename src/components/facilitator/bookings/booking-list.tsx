"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Check, ChevronDown, Copy, Mail, MessageSquare, Phone, Search, Slash, Ticket } from "lucide-react";
import {
  markEventSoldOutAction,
  updateBookingManualPaymentAction,
  updateBookingSeatsAction,
} from "@/app/facilitator/bookings/actions";
import { CapacityBadge } from "@/components/events/capacity-badge";
import { EventDateBox } from "@/components/events/event-card-overlays";
import { CancelBookingAction } from "@/components/facilitator/bookings/cancel-booking-action";
import { ParticipantListMenu } from "@/components/facilitator/bookings/participant-list-menu";
import { PaymentReminderAction } from "@/components/facilitator/bookings/payment-reminder-action";
import { getReservedSeatsFromRows, isActiveBookingStatus } from "@/lib/events/capacity";
import { publicMediaUrl } from "@/lib/media/public-url";
import { parsePaymentInstructionsSnapshot } from "@/lib/payment-instructions";
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
  externalParticipants: ExternalParticipantRow[];
  initialExpandedBookingId?: string | null;
  selectedEventId: string | null;
};

type ExternalParticipantRow = {
  id: string;
  event_id: string;
  participant_name: string | null;
  participant_email: string | null;
  participant_phone: string | null;
  seats: number;
  internal_note: string | null;
  source: "manual" | "provider_sync";
  created_at: string;
};

type EventOption = {
  address_line?: string | null;
  city?: string | null;
  cover_image_path?: string | null;
  id: string;
  title: string;
  starts_at: string;
  status: string;
  capacity?: number | null;
  price_cents?: number | null;
  registration_mode?: "direct" | "approval_required" | null;
  bookings?: Array<{
    booking_value_cents: number;
    id: string;
    status: BookingStatus;
    seats: number;
  }>;
  event_payment_settings?: Array<{
    method_source?: "facilitator" | "custom" | "none" | null;
    payment_link_mode?: "external_registration" | "payment_only" | null;
  }> | {
    method_source?: "facilitator" | "custom" | "none" | null;
    payment_link_mode?: "external_registration" | "payment_only" | null;
  } | null;
  event_main_categories?: Array<{
    main_categories?: {
      color_hex?: string | null;
      image_path?: string | null;
      name?: string | null;
    } | Array<{
      color_hex?: string | null;
      image_path?: string | null;
      name?: string | null;
    }> | null;
  }> | null;
};

const statusLabels: Record<BookingStatus, string> = {
  pending: "Afventer",
  confirmed: "Tilmeldt",
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

function formatMoney(cents: number) {
  return `${new Intl.NumberFormat("da-DK").format(cents / 100)} kr.`;
}

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function usesExternalRegistration(event: EventOption | null | undefined) {
  if (!event || (event.price_cents ?? 0) <= 0 || event.registration_mode !== "direct") {
    return false;
  }

  const paymentSettings = first(event.event_payment_settings);
  return paymentSettings?.method_source === "custom" && paymentSettings.payment_link_mode === "external_registration";
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
  if (booking.status === "cancelled" || booking.booking_value_cents <= 0) {
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

function getEventBookingStats(event: EventOption, externalParticipants?: ExternalParticipantRow[]) {
  const bookings = event.bookings ?? [];
  const totalSeats = getReservedSeatsFromRows({ bookings, externalParticipants });
  const pendingSeats = bookings
    .filter((booking) => booking.status === "pending")
    .reduce((sum, booking) => sum + booking.seats, 0);
  const confirmedSeats = bookings
    .filter((booking) => booking.status === "confirmed")
    .reduce((sum, booking) => sum + booking.seats, 0);
  const expectedRevenueCents = bookings
    .filter((booking) => booking.status === "confirmed" && booking.booking_value_cents > 0)
    .reduce((sum, booking) => sum + booking.booking_value_cents, 0);

  return {
    availableSeats: typeof event.capacity === "number" ? Math.max(event.capacity - totalSeats, 0) : null,
    confirmedSeats,
    expectedRevenueCents,
    pendingSeats,
    totalSeats,
  };
}

type BookingFilter = "all" | "confirmed" | "pending" | "paid" | "unpaid" | "cancelled";
type BookingSort = "newest" | "oldest" | "name_asc" | "name_desc" | "unpaid_first" | "paid_first" | "value_desc" | "value_asc";

const bookingFilters: Array<{ label: string; value: BookingFilter }> = [
  { label: "Tilmeldte", value: "confirmed" },
  { label: "Betalt", value: "paid" },
  { label: "Ikke registreret", value: "unpaid" },
  { label: "Afventer", value: "pending" },
  { label: "Annulleret", value: "cancelled" },
  { label: "Alle", value: "all" },
];

const bookingSortOptions: Array<{ label: string; value: BookingSort }> = [
  { label: "Nyeste først", value: "newest" },
  { label: "Ældste først", value: "oldest" },
  { label: "Navn A-Å", value: "name_asc" },
  { label: "Navn Å-A", value: "name_desc" },
  { label: "Ikke registreret først", value: "unpaid_first" },
  { label: "Betalt først", value: "paid_first" },
  { label: "Bookingværdi høj/lav", value: "value_desc" },
  { label: "Bookingværdi lav/høj", value: "value_asc" },
];

function matchesBookingFilter(booking: BookingRow, filter: BookingFilter) {
  const paymentStatus = paymentStatusLabel(booking);

  if (filter === "all") return true;
  if (filter === "confirmed") return booking.status === "confirmed";
  if (filter === "pending") return booking.status === "pending";
  if (filter === "cancelled") return booking.status === "cancelled";
  if (filter === "paid") return paymentStatus === "Betalt";
  if (filter === "unpaid") return paymentStatus === "Afventer";

  return true;
}

function paymentSortValue(booking: BookingRow) {
  if (booking.status === "cancelled") return 3;
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

function SubmitButton({
  children,
  className,
  name,
  value,
}: {
  children: React.ReactNode;
  className: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button className={className} disabled={pending} name={name} type="submit" value={value}>
      {pending ? "Arbejder..." : children}
    </button>
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
  const paymentSnapshot = parsePaymentInstructionsSnapshot(booking.payment_instructions_snapshot);
  const isPaidEventBooking = booking.booking_value_cents > 0;
  const isManuallyMarkedPaid = Boolean(booking.manually_marked_paid_at);
  const isCancelledBooking = booking.status === "cancelled";
  const reminderDisabledReason = canSendPaymentReminder(booking, paymentSnapshot);
  const paymentLabel = !isPaidEventBooking ? "Gratis" : isManuallyMarkedPaid ? "Betalt" : isCancelledBooking ? "—" : "Ikke registreret";
  const statusLabel = statusLabels[booking.status];
  const statusClass = statusBadgeClasses[booking.status];

  return (
    <article className="border-b border-midnight/8 last:border-b-0 odd:bg-white even:bg-[#FCFAF7]" id={`booking-${booking.id}`} key={booking.id}>
      <div className="grid gap-2 px-3 py-3 transition hover:bg-[#F7F2FB]/55 md:grid-cols-[7.5rem_minmax(10rem,1.5fr)_4.5rem_6.5rem_9rem_9.5rem_2.75rem] md:items-center md:gap-3 md:px-4 md:py-2.5">
        <div className="flex items-center justify-between gap-3 md:block">
          <span className={"inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-bold " + statusClass}>{statusLabel}</span>
          <button
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Luk tilmelding" : "Åbn tilmelding"}
            className="grid size-8 shrink-0 place-items-center rounded-md border border-midnight/10 bg-white text-lavender transition hover:border-lavender hover:bg-lavender hover:text-white md:hidden"
            onClick={onToggle}
            type="button"
          >
            <ChevronDown className={"size-4 transition " + (isExpanded ? "rotate-180" : "")} aria-hidden="true" />
          </button>
        </div>
        <button aria-expanded={isExpanded} className="min-w-0 text-left" onClick={onToggle} type="button">
          <span className="flex min-w-0 items-center gap-2">
            {booking.booking_number ? (
              <span className="shrink-0 rounded-full bg-[#F4F0F7] px-2 py-0.5 text-[11px] font-bold text-lavender">#{booking.booking_number}</span>
            ) : null}
            <span className="min-w-0 truncate text-sm font-bold text-midnight md:text-[15px]">{booking.participant_name}</span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-ink/52 md:hidden">{booking.participant_email}</span>
        </button>
        <button aria-expanded={isExpanded} className="hidden text-left text-sm font-semibold text-midnight md:block" onClick={onToggle} type="button">
          {booking.seats}
        </button>
        <button aria-expanded={isExpanded} className="hidden text-left text-sm font-semibold text-midnight md:block" onClick={onToggle} type="button">
          {formatMoney(booking.booking_value_cents)}
        </button>
        <button aria-expanded={isExpanded} className="hidden text-left text-sm font-semibold text-ink/68 md:block" onClick={onToggle} type="button">
          {formatShortDateTime(booking.created_at)}
        </button>
        <div className="flex items-center justify-between gap-3 md:block">
          <span className="text-xs font-semibold text-ink/45 md:hidden">
            {booking.seats} {booking.seats === 1 ? "plads" : "pladser"} · {formatMoney(booking.booking_value_cents)}
          </span>
          {showActions && isPaidEventBooking && booking.status === "confirmed" && !isCancelledBooking ? (
            <RowPaymentAction booking={booking} currentEventId={currentEventId} />
          ) : (
            <span
              className={
                "inline-flex min-h-8 items-center justify-center rounded-full px-2.5 py-1 text-xs font-bold md:min-w-[7.5rem] " +
                (!isPaidEventBooking
                  ? "bg-sand/45 text-ink/62"
                  : isManuallyMarkedPaid
                    ? "bg-[#EEF7F0] text-sage-700"
                    : "bg-midnight/5 text-ink/50")
              }
            >
              {isManuallyMarkedPaid ? <Check className="mr-1 size-3.5" aria-hidden="true" /> : null}
              {paymentLabel}
            </span>
          )}
        </div>
        <button
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Luk tilmelding" : "Åbn tilmelding"}
          className="hidden size-8 shrink-0 place-items-center justify-self-end rounded-md border border-midnight/10 bg-white text-lavender transition hover:border-lavender hover:bg-lavender hover:text-white md:grid"
          onClick={onToggle}
          type="button"
        >
          <ChevronDown className={"size-4 transition " + (isExpanded ? "rotate-180" : "")} aria-hidden="true" />
        </button>
      </div>

      {isExpanded ? (
        <div className="grid gap-3 border-t border-midnight/10 bg-white/90 p-3 shadow-[inset_0_12px_24px_rgba(46,36,52,0.04)] xl:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="min-w-0">
            <h3 className="min-w-0 text-base font-semibold leading-snug text-midnight">{booking.event_title_snapshot}</h3>
            <div className="mt-2 grid gap-1.5 text-sm text-ink/72 md:grid-cols-2 xl:grid-cols-3">
              <p className="flex min-w-0 flex-col rounded-md border border-midnight/8 bg-white/80 px-2.5 py-1.5">
                <span className="block text-[11px] font-semibold text-ink/48">Bookingreference</span>
                <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-midnight [overflow-wrap:anywhere]">{booking.booking_reference || booking.payment_reference || "Ikke oprettet"}</span>
                  {booking.booking_reference ? <CopyReferenceButton reference={booking.booking_reference} /> : null}
                </span>
              </p>
              <p className="flex min-w-0 flex-col rounded-md border border-midnight/8 bg-white/80 px-2.5 py-1.5">
                <span className="flex items-center gap-1 text-[11px] font-semibold text-ink/48">
                  <Mail className="size-3.5" aria-hidden="true" />
                  E-mail
                </span>
                <span className="mt-0.5 font-semibold text-midnight [overflow-wrap:anywhere]">{booking.participant_email}</span>
              </p>
              <p className="flex min-w-0 flex-col rounded-md border border-midnight/8 bg-white/80 px-2.5 py-1.5">
                <span className="flex items-center gap-1 text-[11px] font-semibold text-ink/48">
                  <Phone className="size-3.5" aria-hidden="true" />
                  Telefon
                </span>
                <span className="mt-0.5 font-semibold text-midnight [overflow-wrap:anywhere]">{booking.participant_phone || "Ikke angivet"}</span>
              </p>
              <p className="flex min-w-0 flex-col rounded-md border border-midnight/8 bg-white/80 px-2.5 py-1.5">
                <span className="flex items-center gap-1 text-[11px] font-semibold text-ink/48">
                  <Ticket className="size-3.5" aria-hidden="true" />
                  Pladser
                </span>
                <span className="mt-0.5 font-semibold text-midnight">{booking.seats}</span>
              </p>
              <p className="flex min-w-0 flex-col rounded-md border border-midnight/8 bg-white/80 px-2.5 py-1.5">
                <span className="block text-[11px] font-semibold text-ink/48">Bookingværdi</span>
                <span className="mt-0.5 font-semibold text-midnight">{formatMoney(booking.booking_value_cents)}</span>
              </p>
              <p className="flex min-w-0 flex-col rounded-md border border-midnight/8 bg-white/80 px-2.5 py-1.5 md:col-span-2">
                <span className="block text-[11px] font-semibold text-ink/48">Eventdato</span>
                <span className="mt-0.5 font-semibold text-midnight">{formatShortDateTime(booking.event_starts_at_snapshot)}</span>
              </p>
              <p className="flex min-w-0 flex-col rounded-md border border-midnight/8 bg-white/80 px-2.5 py-1.5">
                <span className="block text-[11px] font-semibold text-ink/48">Tilmeldingsdato</span>
                <span className="mt-0.5 font-semibold text-midnight">{formatShortDateTime(booking.created_at)}</span>
              </p>
            </div>

            <div className="mt-2 max-w-3xl rounded-md border border-midnight/8 bg-white/70 px-2.5 py-2 text-sm leading-5 text-ink/70">
              <p className="mb-0.5 flex items-center gap-1.5 text-[11px] font-bold text-ink/48">
                <MessageSquare className="size-3.5" aria-hidden="true" />
                Deltagerens besked
              </p>
              <p className="[overflow-wrap:anywhere]">{booking.message || "Der er ikke skrevet en besked."}</p>
            </div>

            {paymentSnapshot && !isCancelledBooking ? (
              <div className="mt-2 grid gap-1.5 rounded-md border border-midnight/10 bg-white/80 px-2.5 py-2 text-sm leading-5 text-ink/72">
                <div>
                  <p className="text-[11px] font-bold text-sage-700">Betalingsoplysninger sendt</p>
                  <p className="mt-0.5 font-semibold text-midnight">Beløb: {formatMoney(paymentSnapshot.amountCents)}</p>
                  <p className="font-semibold text-midnight">Reference: {paymentSnapshot.reference}</p>
                </div>
                {paymentSnapshot.methods.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {paymentSnapshot.methods.map((method) => (
                      <span
                        className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-sage-700 shadow-soft"
                        key={`${booking.id}-${method.type}-${method.value}`}
                      >
                        {method.label}
                      </span>
                    ))}
                  </div>
                ) : null}
                {paymentSnapshot.note ? <p className="text-ink/65">{paymentSnapshot.note}</p> : null}
                {paymentSnapshot.dueAt ? <p className="text-ink/65">Betalingsfrist: {formatShortDateTime(paymentSnapshot.dueAt)}</p> : null}
              </div>
            ) : null}

            {isPaidEventBooking && !isCancelledBooking ? (
              <div
                className={
                  "mt-2 rounded-md border px-2.5 py-2 text-sm leading-5 " +
                  (isManuallyMarkedPaid
                    ? "border-sage-700/15 bg-white/80 text-sage-700"
                    : "border-[#E8D6A8] bg-[#FFF8E8] text-[#6E5528]")
                }
              >
                <div>
                  <p className="text-[11px] font-bold">Manuel betalingsregistrering</p>
                  <p className="mt-0.5 font-semibold text-midnight">{isManuallyMarkedPaid ? "Betalt" : "Ikke registreret"}</p>
                  {booking.manually_marked_paid_at ? (
                    <p className="text-ink/65">
                      Markeret{" "}
                      {new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(booking.manually_marked_paid_at))}
                    </p>
                  ) : (
                    <p className="text-ink/65">SoulEvents verificerer ikke betalinger.</p>
                  )}
                  {booking.manual_payment_note ? <p className="mt-0.5 text-ink/65">Note: {booking.manual_payment_note}</p> : null}
                </div>
              </div>
            ) : null}
          </div>

          {showActions ? (
            <div className="flex h-full flex-col gap-2">
              {isPaidEventBooking && booking.status === "confirmed" ? (
                <div className="rounded-md border border-midnight/10 bg-white/80 p-2.5">
                  <PaymentReminderAction
                    bookingId={booking.id}
                    currentEventId={currentEventId}
                    disabledReason={reminderDisabledReason}
                    latestReminderAt={booking.payment_reminder_sent_at}
                    participantEmail={booking.participant_email}
                    participantName={booking.participant_name}
                  />
                </div>
              ) : null}
              <SeatAdjustmentAction booking={booking} currentEventId={currentEventId} />
              <div className="pt-1">
                {isActiveBookingStatus(booking.status) && (
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

function RowPaymentAction({
  booking,
  currentEventId,
}: {
  booking: BookingRow;
  currentEventId: string;
}) {
  const isMarkedPaid = Boolean(booking.manually_marked_paid_at);
  const nextAction = isMarkedPaid ? "clear" : "mark";

  return (
    <form action={updateBookingManualPaymentAction} className="min-w-0">
      <input name="booking_id" type="hidden" value={booking.id} />
      <input name="current_event_id" type="hidden" value={currentEventId} />
      <SubmitButton
        className={
          "inline-flex min-h-8 w-full items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold transition hover:brightness-95 md:min-w-[7.5rem] " +
          (isMarkedPaid
            ? "border-[#C9DAC1] bg-[#EEF7F0] text-sage-700"
            : "border-midnight/10 bg-white text-ink/68")
        }
        name="payment_action"
        value={nextAction}
      >
        {isMarkedPaid ? <Check className="size-3.5" aria-hidden="true" /> : null}
        {isMarkedPaid ? "Betalt" : "Ikke registreret"}
      </SubmitButton>
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
  if (!isActiveBookingStatus(booking.status)) {
    return null;
  }

  return (
    <form action={updateBookingSeatsAction} className="rounded-md border border-midnight/10 bg-white/80 p-2.5">
      <input name="booking_id" type="hidden" value={booking.id} />
      <input name="current_event_id" type="hidden" value={currentEventId} />
      <label className="grid gap-0.5 text-sm font-semibold text-midnight" htmlFor={"booking-seats-" + booking.id}>
        Justér antal pladser
      </label>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <input
          className="h-8 w-20 rounded-md border border-midnight/15 bg-white px-2 text-sm font-semibold text-midnight"
          defaultValue={booking.seats}
          id={"booking-seats-" + booking.id}
          min={1}
          name="seats"
          type="number"
        />
        <button
          className="inline-flex h-8 flex-1 items-center justify-center gap-2 rounded-md border border-midnight/15 bg-white px-2.5 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700 sm:flex-none"
          type="submit"
        >
          Gem antal
        </button>
      </div>
      <p className="mt-1.5 text-xs leading-5 text-ink/55">Kan ændres, hvis der er ledig kapacitet. Betalingsstatus bevares.</p>
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
    <section className="overflow-hidden rounded-[28px] border border-midnight/10 bg-white shadow-soft">
      <div className="border-b border-midnight/10 px-5 py-4">
        <h2 className="text-lg font-semibold text-midnight">Vælg event</h2>
        <p className="mt-1 text-sm text-ink/64">Start med at vælge det event, du vil se tilmeldinger for.</p>
      </div>
      <div className="flex snap-x gap-4 overflow-x-auto px-5 py-5 [scrollbar-width:thin]">
        {eventOptions.map((event) => {
          const stats = getEventBookingStats(event);
          const eventUsesExternalRegistration = usesExternalRegistration(event);
          const isSelected = selectedEvent?.id === event.id;
          const mainCategories =
            event.event_main_categories
              ?.map((row) => first(row.main_categories))
              .filter((category): category is NonNullable<typeof category> => Boolean(category)) ?? [];
          const categoryImageUrl = publicMediaUrl(mainCategories.find((category) => category.image_path)?.image_path);
          const eventImageUrl = publicMediaUrl(event.cover_image_path) ?? categoryImageUrl;
          const fallbackColor = mainCategories[0]?.color_hex || "#D89A94";
          const availableLabel =
            stats.availableSeats === null
              ? "Ledige pladser"
              : stats.availableSeats === 1
                ? "1 ledig plads"
                : `${stats.availableSeats} ledige pladser`;
          const capacitySummaryLabel =
            eventUsesExternalRegistration
              ? "Tilmeldinger håndteres eksternt"
              : stats.availableSeats === null ? `${stats.totalSeats} tilmeldte` : `${stats.totalSeats} tilmeldte • ${availableLabel}`;

          return (
            <Link
              className={
                "group relative block min-w-[235px] max-w-[235px] snap-start overflow-hidden rounded-[22px] border bg-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift sm:min-w-[250px] sm:max-w-[250px] lg:min-w-[270px] lg:max-w-[270px] " +
                (isSelected ? "border-[#7A5D91] ring-4 ring-[#EADCF7]" : "border-olive/10 hover:border-sage-700/25")
              }
              href={"/facilitator/bookings?event=" + event.id}
              key={event.id}
              aria-current={isSelected ? "page" : undefined}
            >
              <div
                className="relative aspect-[16/10] overflow-hidden bg-[#FAF6EF]"
                style={
                  eventImageUrl
                    ? undefined
                    : {
                        background:
                          "radial-gradient(circle at 18% 20%, rgba(255,255,255,0.88), transparent 32%), linear-gradient(135deg, " +
                          fallbackColor +
                          "33, #FAF6EF 56%, #EDE4F7)",
                      }
                }
              >
                {eventImageUrl ? (
                  <Image
                    alt=""
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                    fill
                    sizes="(min-width: 1024px) 270px, (min-width: 640px) 250px, 235px"
                    src={eventImageUrl}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-5 text-center">
                    <span className="font-serif text-2xl font-medium leading-tight text-olive">
                      {mainCategories[0]?.name || "SoulEvents"}
                    </span>
                  </div>
                )}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#2F2633]/12 to-transparent" aria-hidden="true" />
                <div className="absolute left-3 top-3">
                  <EventDateBox startsAt={event.starts_at} />
                </div>
                {isSelected ? (
                  <span className="absolute bottom-3 right-3 grid size-8 place-items-center rounded-full bg-white text-[#7A5D91] shadow-soft ring-1 ring-[#7A5D91]/20">
                    <Check className="size-4" aria-hidden="true" />
                  </span>
                ) : null}
              </div>

              <div className="grid gap-3 p-4">
                <h3 className="line-clamp-2 min-h-[2.75rem] text-lg font-semibold leading-snug text-midnight">
                  {event.title}
                </h3>
                <p className="inline-flex items-center gap-2 text-sm font-medium text-ink/64">
                  <CalendarDays className="size-4 shrink-0 text-[#7A5D91]" aria-hidden="true" />
                  <span>{formatEventDate(event.starts_at).replace(",", " kl.")}</span>
                </p>
                <span className="inline-flex items-center gap-2 rounded-full bg-[#EDF3EA] px-3 py-2 text-sm font-semibold text-[#4F6849]">
                  <Ticket className="size-4 shrink-0" aria-hidden="true" />
                  {capacitySummaryLabel}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function BookingList({ bookings, eventOptions, externalParticipants, initialExpandedBookingId, selectedEventId }: BookingListProps) {
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(initialExpandedBookingId ?? null);
  const [filter, setFilter] = useState<BookingFilter>("confirmed");
  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setSort] = useState<BookingSort>("newest");
  const selectedEvent = eventOptions.find((event) => event.id === selectedEventId) ?? null;
  const selectedEventUsesExternalRegistration = usesExternalRegistration(selectedEvent);
  const selectedEventStats = selectedEvent ? getEventBookingStats(selectedEvent, externalParticipants) : null;
  const selectedEventLocation = selectedEvent
    ? [selectedEvent.address_line, selectedEvent.city].filter(Boolean).join(", ") || null
    : null;
  const participantRows = bookings.map((booking) => ({
    bookingReference: booking.booking_reference || booking.payment_reference || "",
    bookingValueCents: booking.booking_value_cents,
    createdAt: booking.created_at,
    email: booking.participant_email,
    id: booking.id,
    manualPaymentNote: booking.manual_payment_note,
    message: booking.message,
    name: booking.participant_name,
    paymentReference: booking.payment_reference,
    paymentStatus: paymentStatusLabel(booking),
    phone: booking.participant_phone,
    seats: booking.seats,
    sourceLabel: "SoulEvents-booking",
    status: booking.status,
  }));
  const externalParticipantRows = externalParticipants.map((participant) => ({
    bookingReference: "",
    bookingValueCents: 0,
    createdAt: participant.created_at,
    email: participant.participant_email ?? "",
    id: participant.id,
    manualPaymentNote: participant.internal_note,
    message: participant.internal_note,
    name: participant.participant_name || "Manuel deltager",
    paymentReference: null,
    paymentStatus: "Ikke relevant" as const,
    phone: participant.participant_phone,
    seats: participant.seats,
    sourceLabel: participant.source === "provider_sync" ? "Synkroniseret ekstern tilmelding" : "Manuelt registreret",
    status: "confirmed" as BookingStatus,
  }));
  const participantListRows = [...participantRows, ...externalParticipantRows];
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
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
              <div>
                <h2 className="text-lg font-semibold text-midnight">{selectedEvent.title}</h2>
                <p className="mt-1 text-sm text-ink/64">{formatEventDate(selectedEvent.starts_at)}</p>
                {selectedEventStats && !selectedEventUsesExternalRegistration && (
                  <div className="mt-3 flex flex-wrap items-stretch gap-2">
                    <div className="inline-flex min-h-12 flex-col justify-center rounded-md border border-midnight/10 bg-[#FBF8F4] px-3 py-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-ink/45">Tilmeldinger</span>
                      <span className="text-sm font-semibold text-midnight">{selectedEventStats.totalSeats} tilmeldte</span>
                    </div>
                    <div className="inline-flex min-h-12 items-center rounded-md border border-midnight/10 bg-[#FBF8F4] px-3 py-2">
                      <CapacityBadge availableSeats={selectedEventStats.availableSeats} capacity={selectedEvent.capacity} />
                    </div>
                    <div className="inline-flex min-h-12 flex-col justify-center rounded-md border border-[#D8CBE4] bg-[#F7F2FB] px-3 py-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-[#7A5D91]">Forventet omsætning</span>
                      <span className="text-lg font-bold leading-tight text-midnight">{formatMoney(selectedEventStats.expectedRevenueCents)}</span>
                      <span className="text-[11px] leading-4 text-ink/55">Baseret på bekræftede tilmeldinger.</span>
                    </div>
                  </div>
                )}
                {selectedEventUsesExternalRegistration ? (
                  <div className="mt-2 grid max-w-2xl gap-2">
                    <p className="rounded-md border border-[#E8D6A8] bg-[#FFF8E8] px-3 py-2 text-sm leading-6 text-[#6E5528]">
                      Tilmeldinger og betaling håndteres via din eksterne tilmeldingsløsning. SoulEvents registrerer derfor ikke deltagere eller ledige pladser.
                    </p>
                  </div>
                ) : null}
              </div>
              {selectedEvent.status === "sold_out" ? (
                <div className="flex flex-wrap gap-2 md:justify-end">
                  {!selectedEventUsesExternalRegistration ? (
                    <ParticipantListMenu
                      bookings={participantListRows}
                      eventLocation={selectedEventLocation}
                      eventStartsAt={selectedEvent.starts_at}
                      eventTitle={selectedEvent.title}
                    />
                  ) : null}
                  <span className="inline-flex h-9 items-center justify-center rounded-md bg-sage-50 px-3 text-sm font-semibold text-sage-700">
                    Eventet er udsolgt
                  </span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 md:justify-end">
                  {!selectedEventUsesExternalRegistration ? (
                    <>
                      <ParticipantListMenu
                        bookings={participantListRows}
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
                    </>
                  ) : null}
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
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end">
                  <label className="grid gap-1 text-sm font-semibold text-midnight sm:w-64">
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
            </div>
          ) : null}

          <div className="bg-[#FBF8F4] p-4">
            {bookings.length === 0 ? (
              <div className="rounded-md border border-midnight/10 bg-white p-8 text-center">
                <h3 className="text-base font-semibold text-midnight">
                  {selectedEventUsesExternalRegistration ? "Tilmeldinger håndteres eksternt" : "Ingen tilmeldinger til dette event endnu"}
                </h3>
                <p className="mt-2 text-sm text-ink/64">
                  {selectedEventUsesExternalRegistration
                    ? "Deltagerlisten findes hos din betalings- eller tilmeldingsudbyder."
                    : "Når deltagere tilmelder sig det valgte event, vises de her."}
                </p>
              </div>
            ) : visibleBookings.length === 0 ? (
              <div className="rounded-md border border-midnight/10 bg-white p-8 text-center">
                <h3 className="text-base font-semibold text-midnight">Ingen tilmeldinger matcher filtrene</h3>
                <p className="mt-2 text-sm text-ink/64">Prøv at ændre søgning, filter eller sortering.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border border-midnight/10 bg-white shadow-soft">
                <div className="sticky top-0 z-10 hidden border-b border-midnight/10 bg-[#F4F0F7] px-4 py-2 text-xs font-bold uppercase tracking-wide text-ink/55 md:grid md:grid-cols-[7.5rem_minmax(10rem,1.5fr)_4.5rem_6.5rem_9rem_9.5rem_2.75rem] md:items-center md:gap-3">
                  <span>Status</span>
                  <span>Deltager</span>
                  <span>Pladser</span>
                  <span>Bookingværdi</span>
                  <span>Tilmeldt</span>
                  <span>Betalingsstatus</span>
                  <span className="sr-only">Detaljer</span>
                </div>
                {visibleBookings.map((booking) => (
                  <BookingArticle
                    booking={booking}
                    currentEventId={selectedEvent.id}
                    isExpanded={expandedBookingId === booking.id}
                    key={booking.id}
                    onToggle={() => setExpandedBookingId((currentId) => (currentId === booking.id ? null : booking.id))}
                    showActions={booking.status !== "cancelled" && !selectedEventUsesExternalRegistration}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
