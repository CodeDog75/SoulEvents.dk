"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendBookingNotification } from "@/lib/email/booking-notification";
import { sendParticipantBookingReceipt } from "@/lib/email/participant-booking-receipt";
import { getOptionalString, getString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function bookingRedirect(eventId: string, message: string): never {
  redirect("/events/" + eventId + "?message=" + encodeURIComponent(message) + "#booking-response");
}

function getSeats(formData: FormData) {
  const raw = getString(formData, "seats");
  const seats = Number(raw);
  return Number.isInteger(seats) ? seats : 0;
}

function wordCount(value: string) {
  return value.split(/\s+/).filter(Boolean).length;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validOptionalPhone(value: string | null) {
  if (!value) return true;
  return value.replace(/\D/g, "").length === 8;
}

const eventSelect = [
  "id,",
  "title,",
  "starts_at,",
  "price_cents,",
  "capacity,",
  "facilitator_id,",
  "facilitator_profiles!inner(",
  "status,",
  "company_name,",
  "profiles(full_name, email)",
  "),",
  "event_categories(categories(name))",
].join("\n");

export async function createBookingAction(formData: FormData) {
  const eventId = getString(formData, "event_id");
  const participantName = getString(formData, "participant_name");
  const participantEmail = getString(formData, "participant_email").toLowerCase();
  const participantPhone = getOptionalString(formData, "participant_phone");
  const seats = getSeats(formData);
  const message = getOptionalString(formData, "message");
  const acceptedGuidelines = getOptionalString(formData, "accepted_guidelines");

  if (!eventId) {
    redirect("/events");
  }

  if (!participantName) {
    bookingRedirect(eventId, "Navn er påkrævet.");
  }

  if (!participantEmail) {
    bookingRedirect(eventId, "E-mail er påkrævet.");
  }

  if (!validEmail(participantEmail)) {
    bookingRedirect(eventId, "Indtast en gyldig e-mailadresse.");
  }

  if (!validOptionalPhone(participantPhone)) {
    bookingRedirect(eventId, "Indtast et gyldigt telefonnummer eller lad feltet være tomt.");
  }

  if (seats <= 0) {
    bookingRedirect(eventId, "Antal pladser skal være mindst 1.");
  }

  if (message && wordCount(message) > 200) {
    bookingRedirect(eventId, "Beskeden må højst være 200 ord.");
  }

  if (acceptedGuidelines !== "yes") {
    bookingRedirect(eventId, "Du skal acceptere SoulEvents.dk\u2019s retningslinjer før tilmelding.");
  }

  const supabase = await createClient();
  const { data: eventResult } = await supabase
    .from("events")
    .select(eventSelect)
    .eq("id", eventId)
    .eq("status", "active")
    .eq("facilitator_profiles.status", "approved")
    .single();

  const event = eventResult as any;

  if (!event) {
    bookingRedirect(eventId, "Eventet kunne ikke findes eller er ikke aktivt.");
  }

  const { data: capacityResult } = await supabase
    .from("event_capacity_view")
    .select("available_seats")
    .eq("event_id", eventId)
    .single();
  const capacity = capacityResult as { available_seats?: number } | null;
  const availableSeats = capacity?.available_seats ?? event.capacity;

  if (seats > availableSeats) {
    bookingRedirect(eventId, "Der er kun " + availableSeats + " ledige pladser.");
  }

  const facilitatorProfile = Array.isArray(event.facilitator_profiles)
    ? event.facilitator_profiles[0]
    : event.facilitator_profiles;
  const facilitatorUser = Array.isArray(facilitatorProfile?.profiles)
    ? facilitatorProfile?.profiles[0]
    : facilitatorProfile?.profiles;
  const primaryCategoryRow = event.event_categories?.[0];
  const primaryCategory = Array.isArray(primaryCategoryRow?.categories)
    ? primaryCategoryRow?.categories[0]
    : primaryCategoryRow?.categories;

  const facilitatorName = facilitatorProfile?.company_name || facilitatorUser?.full_name || "Arrangør";
  const adminSupabase = createAdminClient();

  const { data: bookingResult, error } = await adminSupabase
    .from("bookings")
    .insert({
      event_id: event.id,
      facilitator_id: event.facilitator_id,
      status: "pending",
      participant_name: participantName,
      participant_email: participantEmail,
      participant_phone: participantPhone,
      seats,
      message,
      event_title_snapshot: event.title,
      event_starts_at_snapshot: event.starts_at,
      facilitator_name_snapshot: facilitatorName,
      primary_category_snapshot: primaryCategory?.name ?? null,
      price_per_seat_cents: event.price_cents,
      commission_rate_bps: 1200,
    })
    .select("id, booking_value_cents, commission_cents")
    .single();

  const booking = bookingResult as any;

  if (error || !booking) {
    bookingRedirect(
      eventId,
      error?.message ? "Tilmeldingen kunne ikke gemmes: " + error.message : "Tilmeldingen kunne ikke gemmes. Prøv igen.",
    );
  }

  await sendBookingNotification({
    bookingId: booking.id,
    eventId: event.id,
    eventTitle: event.title,
    eventStartsAt: event.starts_at,
    facilitatorEmail: facilitatorUser?.email ?? null,
    facilitatorName,
    participantName,
    participantEmail,
    participantPhone,
    seats,
    message,
    bookingValueCents: booking.booking_value_cents,
    commissionCents: booking.commission_cents,
  });

  await sendParticipantBookingReceipt({
    bookingId: booking.id,
    eventId: event.id,
    eventTitle: event.title,
    eventStartsAt: event.starts_at,
    facilitatorName,
    participantName,
    participantEmail,
    seats,
  });

  revalidatePath("/events/" + eventId);
  redirect(
    "/events/" +
      eventId +
      "?booking=sent&message=" +
      encodeURIComponent("Tak. Din tilmelding er registreret. Du modtager en mailkvittering, og arrangøren har fået besked.") + "#booking-response",
  );
}
