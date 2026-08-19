"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sendBookingPaymentReminder } from "@/lib/email/booking-payment-reminder";
import { sendParticipantBookingResponse, sendParticipantBookingSeatsUpdated } from "@/lib/email/participant-booking-response";
import { env } from "@/lib/env";
import { participantCalendarUrl, participantCancelUrl } from "@/lib/bookings/participant-links";
import { activeBookingStatuses, getReservedSeatsFromRows, isActiveBookingStatus, syncEventCapacityStatus } from "@/lib/events/capacity";
import { getString } from "@/lib/forms/form-data";
import { requireRole } from "@/lib/auth/roles";
import {
  buildBookingPaymentInstructions,
  paymentSettingsToInstructionsRecord,
  parsePaymentInstructionsSnapshot,
  type PaymentInstructionsSnapshot,
} from "@/lib/payment-instructions";
import { publicEventPath } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { BookingStatus } from "@/types/database";

const responseStatuses: BookingStatus[] = ["cancelled"];
const paymentReminderCooldownMs = 24 * 60 * 60 * 1000;
type BookingsRedirectOptions = {
  filter?: string | null;
  focusBooking?: boolean;
  scrollY?: string | null;
  sort?: string | null;
};

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function publicEventUrl(eventId: string, eventSlug?: string | null) {
  const appUrl = (env.appUrl || "https://www.soulevents.dk").trim().replace(/\/$/, "");
  return appUrl + publicEventPath(eventSlug || eventId);
}

function bookingsRedirect(message: string, eventId?: string | null, bookingId?: string | null, options: BookingsRedirectOptions = {}): never {
  const params = new URLSearchParams({ message });

  if (eventId) {
    params.set("event", eventId);
  }

  if (bookingId) {
    params.set("booking", bookingId);
  }

  if (options.filter) {
    params.set("filter", options.filter);
  }

  if (options.sort) {
    params.set("sort", options.sort);
  }

  if (options.scrollY) {
    params.set("scroll", options.scrollY);
  }

  const shouldFocusBooking = options.focusBooking !== false && bookingId;

  redirect(`/facilitator/bookings?${params.toString()}${shouldFocusBooking ? `#booking-${bookingId}` : ""}`);
}

function getSeats(formData: FormData) {
  const seats = Number(getString(formData, "seats"));
  return Number.isInteger(seats) ? seats : 0;
}

function isLikelyEmail(value: string | null | undefined) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function getOptionalText(formData: FormData, key: string) {
  const value = getString(formData, key).trim();
  return value.length > 0 ? value : null;
}

function getOptionalEmailText(formData: FormData, key: string) {
  const value = getOptionalText(formData, key);
  return value ? value.toLowerCase() : null;
}

function isExternalRegistrationEvent(event: {
  price_cents?: number | null;
  registration_mode?: string | null;
  event_payment_settings?: Array<{ method_source?: string | null; payment_link_mode?: string | null }> | { method_source?: string | null; payment_link_mode?: string | null } | null;
}) {
  const paymentSettings = firstRelation(event.event_payment_settings);
  return (
    (event.price_cents ?? 0) > 0 &&
    event.registration_mode === "direct" &&
    paymentSettings?.method_source === "custom" &&
    paymentSettings.payment_link_mode === "external_registration"
  );
}

async function getReservedSeatsForEvent(
  supabase: ReturnType<typeof createAdminClient>,
  input: { eventId: string; excludeExternalParticipantId?: string | null },
) {
  const [
    { data: bookings, error: bookingsError },
    { data: externalParticipants, error: externalParticipantsError },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("seats, status")
      .eq("event_id", input.eventId)
      .in("status", activeBookingStatuses),
    supabase
      .from("external_event_participants")
      .select("id, seats")
      .eq("event_id", input.eventId),
  ]);

  if (bookingsError) {
    throw bookingsError;
  }

  if (externalParticipantsError) {
    throw externalParticipantsError;
  }

  const externalSeats = (externalParticipants ?? [])
    .filter((participant) => participant.id !== input.excludeExternalParticipantId)
    .reduce((sum, participant) => sum + (participant.seats ?? 0), 0);

  return getReservedSeatsFromRows({ bookings }) + externalSeats;
}

async function getOwnExternalRegistrationEvent(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  input: { eventId: string; facilitatorId: string },
) {
  const { data: event } = await supabase
    .from("events")
    .select("id, slug, facilitator_id, capacity, status, price_cents, registration_mode, event_payment_settings(method_source, payment_link_mode)")
    .eq("id", input.eventId)
    .eq("facilitator_id", input.facilitatorId)
    .maybeSingle();

  return event;
}

export async function updateBookingStatusAction(formData: FormData) {
  const profile = await requireRole("facilitator");
  const bookingId = getString(formData, "booking_id");
  const status = getString(formData, "status") as BookingStatus;
  const currentEventId = getString(formData, "current_event_id");

  if (!bookingId || !responseStatuses.includes(status)) {
    bookingsRedirect("Ugyldig tilmeldingshandling.", currentEventId);
  }

  const supabase = await createClient();
  const { data: facilitatorProfile } = await supabase
    .from("facilitator_profiles")
    .select("id")
    .eq("profile_id", profile.id)
    .single();

  if (!facilitatorProfile) {
    bookingsRedirect("Arrangørprofilen mangler.", currentEventId);
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      `
      id,
      event_id,
      facilitator_id,
      participant_name,
      participant_email,
      status,
      seats,
      price_per_seat_cents,
      booking_value_cents,
      payment_reference,
      participant_access_token,
      event_title_snapshot,
      event_starts_at_snapshot,
      facilitator_name_snapshot,
      events(slug)
    `,
    )
    .eq("id", bookingId)
    .eq("facilitator_id", facilitatorProfile.id)
    .single();

  if (!booking) {
    bookingsRedirect("Tilmeldingen kunne ikke findes.", currentEventId);
  }

  if (status === "confirmed" && booking.status !== "pending") {
    bookingsRedirect("Kun afventende tilmeldinger kan bekræftes.", booking.event_id);
  }

  if (status === "cancelled" && !isActiveBookingStatus(booking.status)) {
    bookingsRedirect("Kun afventende eller bekræftede tilmeldinger kan aflyses.", booking.event_id);
  }

  let paymentInstructions: PaymentInstructionsSnapshot | null = null;

  if (status === "confirmed") {
    const [{ data: event }, { data: eventPaymentSettings }, { data: facilitatorPaymentSettings }] = await Promise.all([
      supabase.from("events").select("id, starts_at").eq("id", booking.event_id).maybeSingle(),
      supabase
        .from("event_payment_settings")
        .select("*")
        .eq("event_id", booking.event_id)
        .eq("facilitator_id", booking.facilitator_id)
        .maybeSingle(),
      supabase
        .from("facilitator_payment_settings")
        .select("*")
        .eq("facilitator_id", booking.facilitator_id)
        .maybeSingle(),
    ]);

    if (event) {
      const eventPaymentRecord = {
        ...paymentSettingsToInstructionsRecord(eventPaymentSettings),
        payment_method_source: eventPaymentSettings?.method_source ?? "facilitator",
      };
      const facilitatorPaymentRecord = paymentSettingsToInstructionsRecord(facilitatorPaymentSettings);

      paymentInstructions = buildBookingPaymentInstructions({
        amountCents: booking.booking_value_cents,
        confirmedAt: new Date(),
        event: eventPaymentRecord,
        eventStartsAt: event.starts_at,
        facilitator: facilitatorPaymentRecord,
        reference: booking.payment_reference,
      });
    }

    if (booking.booking_value_cents > 0 && !paymentInstructions) {
      console.warn("[booking-confirmation:payment] Missing payment instructions for paid confirmed booking", {
        amountCents: booking.booking_value_cents,
        bookingId: booking.id,
        eventId: booking.event_id,
        eventPaymentSource: eventPaymentSettings?.method_source ?? "facilitator",
        eventWasLoaded: Boolean(event),
        facilitatorId: booking.facilitator_id,
        hasEventPaymentSettings: Boolean(eventPaymentSettings),
        hasFacilitatorPaymentSettings: Boolean(facilitatorPaymentSettings),
      });
    }
  }

  const bookingUpdates: Record<string, unknown> = { status };

  if (paymentInstructions) {
    bookingUpdates.payment_instructions_snapshot = paymentInstructions;
    bookingUpdates.payment_due_at = paymentInstructions.dueAt;
    bookingUpdates.payment_snapshot_created_at = paymentInstructions.generatedAt;
  }

  const { error } = await supabase.from("bookings").update(bookingUpdates).eq("id", bookingId);

  if (error) {
    bookingsRedirect("Tilmeldingsstatus kunne ikke opdateres.", booking.event_id);
  }

  await syncEventCapacityStatus(supabase, booking.event_id);
  const requestHeaders = await headers();
  const requestOrigin = requestHeaders.get("origin");

  const participantMailSent = await sendParticipantBookingResponse({
    bookingId: booking.id,
    eventId: booking.event_id,
    status,
    participantEmail: booking.participant_email,
    participantName: booking.participant_name,
    seats: booking.seats,
    eventTitle: booking.event_title_snapshot,
    eventStartsAt: booking.event_starts_at_snapshot,
    facilitatorName: booking.facilitator_name_snapshot,
    eventUrl: status === "confirmed" ? publicEventUrl(booking.event_id, firstRelation(booking.events)?.slug ?? null) : null,
    calendarUrl: status === "confirmed" ? participantCalendarUrl(booking.participant_access_token, requestOrigin) : null,
    cancelUrl: participantCancelUrl(booking.participant_access_token, requestOrigin),
    paymentInstructions,
  });

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/bookings");
  revalidatePath("/");
  revalidatePath("/events/" + booking.event_id);
  revalidatePath(publicEventPath(firstRelation(booking.events)?.slug ?? booking.event_id));

  const labels: Record<string, string> = {
    confirmed: "bekræftet",
    cancelled: "aflyst",
  };

  bookingsRedirect(
    participantMailSent
      ? `Tilmeldingen er ${labels[status]}, og deltageren har fået besked.`
      : `Tilmeldingen er ${labels[status]}, men beskeden kunne ikke sendes.`,
    booking.event_id,
  );
}

export async function confirmAllPendingBookingsAction(formData: FormData) {
  await requireRole("facilitator");
  const eventId = getString(formData, "event_id");

  if (!eventId) {
    bookingsRedirect("Vælg et event først.");
  }

  bookingsRedirect("Manuel bekræftelse af tilmeldinger er udfaset. Nye SoulEvents-tilmeldinger bekræftes automatisk.", eventId);
}

export async function updateBookingSeatsAction(formData: FormData) {
  const profile = await requireRole("facilitator");
  const bookingId = getString(formData, "booking_id");
  const currentEventId = getString(formData, "current_event_id");
  const sendUpdateEmail = getString(formData, "send_update_email") === "1";
  const seats = getSeats(formData);

  if (!bookingId || seats <= 0) {
    bookingsRedirect("Ugyldigt antal pladser.", currentEventId);
  }

  const supabase = await createClient();
  const { data: facilitatorProfile } = await supabase
    .from("facilitator_profiles")
    .select("id")
    .eq("profile_id", profile.id)
    .single();

  if (!facilitatorProfile) {
    bookingsRedirect("Arrangørprofilen mangler.", currentEventId);
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id, event_id, facilitator_id, status, seats, participant_email, participant_name, event_title_snapshot, event_starts_at_snapshot, facilitator_name_snapshot, price_per_seat_cents, booking_value_cents, booking_reference, payment_reference, payment_instructions_snapshot, events(slug)",
    )
    .eq("id", bookingId)
    .eq("facilitator_id", facilitatorProfile.id)
    .single();

  if (!booking) {
    bookingsRedirect("Tilmeldingen kunne ikke findes.", currentEventId);
  }

  if (!isActiveBookingStatus(booking.status)) {
    bookingsRedirect("Kun aktive tilmeldinger kan justeres.", booking.event_id);
  }

  if (seats === booking.seats) {
    bookingsRedirect("Antal pladser er uændret.", booking.event_id, booking.id);
  }

  if (seats > booking.seats) {
    const admin = createAdminClient();
    const [{ data: event }, { data: activeBookings }] = await Promise.all([
      admin.from("events").select("capacity").eq("id", booking.event_id).single(),
      admin
        .from("bookings")
        .select("id, seats, status")
        .eq("event_id", booking.event_id)
        .in("status", activeBookingStatuses)
        .neq("id", booking.id),
    ]);

    const usedSeats = (activeBookings ?? []).reduce((sum, activeBooking) => sum + (activeBooking.seats ?? 0), 0);
    if (typeof event?.capacity === "number" && usedSeats + seats > event.capacity) {
      bookingsRedirect("Der er ikke nok ledige pladser til at gemme ændringen.", booking.event_id, booking.id);
    }
  }

  const { error } = await supabase
    .from("bookings")
    .update({ seats })
    .eq("id", booking.id);

  if (error) {
    bookingsRedirect(
      error.code === "23514" ? "Der er ikke nok ledige pladser til at gemme ændringen." : "Antal pladser kunne ikke opdateres.",
      booking.event_id,
      booking.id,
    );
  }

  await syncEventCapacityStatus(supabase, booking.event_id);

  let participantMailSent = false;
  if (sendUpdateEmail && booking.status === "confirmed") {
    const paymentSnapshot = parsePaymentInstructionsSnapshot(booking.payment_instructions_snapshot);
    const nextBookingValueCents = booking.price_per_seat_cents * seats;
    const paymentInstructions = paymentSnapshot
      ? {
          ...paymentSnapshot,
          amountCents: nextBookingValueCents,
          reference: booking.booking_reference || paymentSnapshot.reference,
        }
      : null;

    participantMailSent = await sendParticipantBookingSeatsUpdated({
      bookingId: booking.id,
      bookingReference: booking.booking_reference || booking.payment_reference,
      eventId: booking.event_id,
      participantEmail: booking.participant_email,
      participantName: booking.participant_name,
      previousSeats: booking.seats,
      nextSeats: seats,
      pricePerSeatCents: booking.price_per_seat_cents,
      nextBookingValueCents,
      eventTitle: booking.event_title_snapshot,
      eventStartsAt: booking.event_starts_at_snapshot,
      facilitatorName: booking.facilitator_name_snapshot,
      paymentInstructions,
    });
  }

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/bookings");
  revalidatePath("/");
  revalidatePath("/events/" + booking.event_id);
  revalidatePath(publicEventPath(firstRelation(booking.events)?.slug ?? booking.event_id));

  bookingsRedirect(
    sendUpdateEmail
      ? participantMailSent
        ? "Antal pladser er opdateret, og deltageren har fået besked."
        : "Antal pladser er opdateret, men beskeden kunne ikke sendes."
      : "Antal pladser er opdateret.",
    booking.event_id,
    booking.id,
  );
}

export async function updateBookingManualPaymentAction(formData: FormData) {
  const profile = await requireRole("facilitator");
  const bookingId = getString(formData, "booking_id");
  const currentEventId = getString(formData, "current_event_id");
  const currentFilter = getString(formData, "current_filter");
  const currentScrollY = getString(formData, "current_scroll_y");
  const currentSort = getString(formData, "current_sort");
  const expandedBookingId = getString(formData, "expanded_booking_id");
  const paymentAction = getString(formData, "payment_action");
  const manualPaymentNote = getString(formData, "manual_payment_note").trim();

  if (!bookingId || !["mark", "clear"].includes(paymentAction)) {
    bookingsRedirect("Ugyldig betalingshandling.", currentEventId);
  }

  if (manualPaymentNote.length > 160) {
    bookingsRedirect("Betalingsnoten må højst være 160 tegn.", currentEventId);
  }

  const supabase = await createClient();
  const { data: facilitatorProfile } = await supabase
    .from("facilitator_profiles")
    .select("id")
    .eq("profile_id", profile.id)
    .single();

  if (!facilitatorProfile) {
    bookingsRedirect("Arrangørprofilen mangler.", currentEventId);
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, event_id, facilitator_id, status, booking_value_cents, manually_marked_paid_at")
    .eq("id", bookingId)
    .eq("facilitator_id", facilitatorProfile.id)
    .single();

  if (!booking) {
    bookingsRedirect("Tilmeldingen kunne ikke findes.", currentEventId);
  }

  if (booking.booking_value_cents <= 0) {
    bookingsRedirect("Gratis tilmeldinger kan ikke markeres som betalt.", booking.event_id);
  }

  if (booking.status !== "confirmed") {
    bookingsRedirect("Kun bekræftede tilmeldinger kan markeres som betalt.", booking.event_id);
  }

  const isMarkingPaid = paymentAction === "mark";
  const { error } = await supabase
    .from("bookings")
    .update({
      manually_marked_paid_at: isMarkingPaid ? new Date().toISOString() : null,
      manually_marked_paid_by: isMarkingPaid ? profile.id : null,
      manual_payment_note: isMarkingPaid ? manualPaymentNote || null : null,
    })
    .eq("id", booking.id);

  if (error) {
    bookingsRedirect("Betalingsmarkeringen kunne ikke gemmes.", booking.event_id);
  }

  const admin = createAdminClient();
  await admin.from("admin_audit_log").insert({
    actor_profile_id: profile.id,
    facilitator_id: facilitatorProfile.id,
    event_id: booking.event_id,
    action: isMarkingPaid ? "manual_payment_marked_paid" : "manual_payment_marking_cleared",
    old_value: booking.manually_marked_paid_at ? "paid" : "not_registered",
    new_value: isMarkingPaid ? "paid" : "not_registered",
    reason: manualPaymentNote || null,
  });

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/bookings");

  bookingsRedirect(
    isMarkingPaid ? "Tilmeldingen er markeret som betalt." : "Betalingsmarkeringen er fjernet.",
    booking.event_id,
    expandedBookingId || null,
    { filter: currentFilter, focusBooking: false, scrollY: currentScrollY, sort: currentSort },
  );
}

export async function sendBookingPaymentReminderAction(formData: FormData) {
  const profile = await requireRole("facilitator");
  const bookingId = getString(formData, "booking_id");
  const currentEventId = getString(formData, "current_event_id");

  if (!bookingId) {
    bookingsRedirect("Tilmeldingen kunne ikke findes.", currentEventId);
  }

  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: facilitatorProfile } = await supabase
    .from("facilitator_profiles")
    .select("id, company_name")
    .eq("profile_id", profile.id)
    .single();

  if (!facilitatorProfile) {
    bookingsRedirect("Arrangørprofilen mangler.", currentEventId);
  }

  const { data: booking } = await admin
    .from("bookings")
    .select(
      "id, event_id, facilitator_id, status, participant_name, participant_email, seats, event_title_snapshot, event_starts_at_snapshot, facilitator_name_snapshot, booking_value_cents, payment_instructions_snapshot, payment_reminder_sent_at, manually_marked_paid_at, events!inner(facilitator_id)",
    )
    .eq("id", bookingId)
    .eq("events.facilitator_id", facilitatorProfile.id)
    .maybeSingle();

  if (!booking) {
    bookingsRedirect("Tilmeldingen kunne ikke findes.", currentEventId);
  }

  if (booking.status !== "confirmed") {
    bookingsRedirect("Betalingspåmindelser kan kun sendes til bekræftede tilmeldinger.", booking.event_id, booking.id);
  }

  if (booking.booking_value_cents <= 0) {
    bookingsRedirect("Gratis tilmeldinger skal ikke have betalingspåmindelser.", booking.event_id, booking.id);
  }

  if (booking.manually_marked_paid_at) {
    bookingsRedirect("Tilmeldingen er allerede markeret som betalt.", booking.event_id, booking.id);
  }

  if (!isLikelyEmail(booking.participant_email)) {
    bookingsRedirect("Deltageren mangler en gyldig e-mailadresse.", booking.event_id, booking.id);
  }

  const latestReminderAt = booking.payment_reminder_sent_at ? new Date(booking.payment_reminder_sent_at) : null;
  if (latestReminderAt && Date.now() - latestReminderAt.getTime() < paymentReminderCooldownMs) {
    bookingsRedirect("Der er allerede sendt en betalingspåmindelse inden for de seneste 24 timer.", booking.event_id, booking.id);
  }

  const paymentInstructions = parsePaymentInstructionsSnapshot(booking.payment_instructions_snapshot);
  if (!paymentInstructions || paymentInstructions.source === "none" || (paymentInstructions.methods.length === 0 && !paymentInstructions.note)) {
    bookingsRedirect("Der findes ikke betalingsoplysninger fra bekræftelsen, som kan sendes igen.", booking.event_id, booking.id);
  }

  const facilitatorName =
    booking.facilitator_name_snapshot ||
    facilitatorProfile.company_name ||
    profile.full_name ||
    "Arrangøren";

  const reminderSent = await sendBookingPaymentReminder({
    bookingId: booking.id,
    eventId: booking.event_id,
    participantEmail: booking.participant_email,
    participantName: booking.participant_name,
    seats: booking.seats,
    eventTitle: booking.event_title_snapshot,
    eventStartsAt: booking.event_starts_at_snapshot,
    facilitatorName,
    paymentInstructions,
  });

  if (!reminderSent) {
    bookingsRedirect("Betalingspåmindelsen kunne ikke sendes. Prøv igen om lidt.", booking.event_id, booking.id);
  }

  const sentAt = new Date().toISOString();
  const { error } = await admin
    .from("bookings")
    .update({ payment_reminder_sent_at: sentAt })
    .eq("id", booking.id);

  if (error) {
    console.error("[booking-payment-reminder] Sent email but failed to save reminder timestamp", {
      bookingId: booking.id,
      code: error.code,
      details: error.details,
      eventId: booking.event_id,
      hint: error.hint,
      message: error.message,
    });
    bookingsRedirect("Påmindelsen blev sendt, men tidspunktet kunne ikke gemmes.", booking.event_id, booking.id);
  }

  await admin.from("admin_audit_log").insert({
    actor_profile_id: profile.id,
    facilitator_id: facilitatorProfile.id,
    event_id: booking.event_id,
    action: "booking_payment_reminder_sent",
    old_value: latestReminderAt?.toISOString() ?? null,
    new_value: sentAt,
    reason: booking.id,
  });

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/bookings");

  bookingsRedirect(`Betalingspåmindelsen er sendt til ${booking.participant_name}.`, booking.event_id, booking.id);
}

export async function markEventSoldOutAction(formData: FormData) {
  const profile = await requireRole("facilitator");
  const eventId = getString(formData, "event_id");

  if (!eventId) {
    bookingsRedirect("Vælg et event først.");
  }

  const supabase = await createClient();
  const { data: facilitatorProfile } = await supabase
    .from("facilitator_profiles")
    .select("id")
    .eq("profile_id", profile.id)
    .single();

  if (!facilitatorProfile) {
    bookingsRedirect("Arrangørprofilen mangler.", eventId);
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, slug, status")
    .eq("id", eventId)
    .eq("facilitator_id", facilitatorProfile.id)
    .maybeSingle();

  if (!event) {
    bookingsRedirect("Eventet kunne ikke findes.", eventId);
  }

  if (event.status === "sold_out") {
    bookingsRedirect("Eventet er allerede markeret som udsolgt.", eventId);
  }

  if (event.status !== "active") {
    bookingsRedirect("Kun aktive events kan markeres som udsolgt.", eventId);
  }

  const { error } = await supabase.from("events").update({ status: "sold_out" }).eq("id", eventId);

  if (error) {
    bookingsRedirect("Eventet kunne ikke markeres som udsolgt.", eventId);
  }

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/bookings");
  revalidatePath("/events/" + eventId);
  revalidatePath(publicEventPath(event.slug || eventId));
  bookingsRedirect("Eventet er markeret som udsolgt. Eksisterende tilmeldinger er ikke ændret.", eventId);
}

export async function addExternalEventParticipantAction(formData: FormData) {
  await requireRole("facilitator");
  const eventId = getString(formData, "event_id");

  if (!eventId) {
    bookingsRedirect("Vælg et event først.");
  }

  bookingsRedirect("Ekstern tilmelding håndteres uden deltagerstyring i SoulEvents.", eventId);
}

export async function updateExternalEventParticipantAction(formData: FormData) {
  await requireRole("facilitator");
  const participantId = getString(formData, "participant_id");
  const eventId = getString(formData, "event_id");

  if (!participantId || !eventId) {
    bookingsRedirect("Deltageren kunne ikke findes.", eventId);
  }

  bookingsRedirect("Ekstern tilmelding håndteres uden deltagerstyring i SoulEvents.", eventId);
}

export async function deleteExternalEventParticipantAction(formData: FormData) {
  await requireRole("facilitator");
  const participantId = getString(formData, "participant_id");
  const eventId = getString(formData, "event_id");
  const confirmDelete = getString(formData, "confirm_delete");

  if (!participantId || !eventId || confirmDelete !== "yes") {
    bookingsRedirect("Deltageren blev ikke fjernet.", eventId);
  }

  bookingsRedirect("Ekstern tilmelding håndteres uden deltagerstyring i SoulEvents.", eventId);
}
