"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendParticipantBookingResponse } from "@/lib/email/participant-booking-response";
import { env } from "@/lib/env";
import { syncEventCapacityStatus } from "@/lib/events/capacity";
import { getString } from "@/lib/forms/form-data";
import { requireRole } from "@/lib/auth/roles";
import { publicEventPath } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import type { BookingStatus } from "@/types/database";

const responseStatuses: BookingStatus[] = ["confirmed", "cancelled"];

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function publicEventUrl(eventId: string, eventSlug?: string | null) {
  const appUrl = (env.appUrl || "https://www.soulevents.dk").trim().replace(/\/$/, "");
  return appUrl + publicEventPath(eventSlug || eventId);
}

function bookingsRedirect(message: string, eventId?: string | null): never {
  const params = new URLSearchParams({ message });

  if (eventId) {
    params.set("event", eventId);
  }

  redirect(`/facilitator/bookings?${params.toString()}`);
}

function getSeats(formData: FormData) {
  const seats = Number(getString(formData, "seats"));
  return Number.isInteger(seats) ? seats : 0;
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

  if (status === "cancelled" && !["pending", "confirmed"].includes(booking.status)) {
    bookingsRedirect("Kun afventende eller bekræftede tilmeldinger kan aflyses.", booking.event_id);
  }

  const { error } = await supabase.from("bookings").update({ status }).eq("id", bookingId);

  if (error) {
    bookingsRedirect("Tilmeldingsstatus kunne ikke opdateres.", booking.event_id);
  }

  await syncEventCapacityStatus(supabase, booking.event_id);

  const participantMailSent = await sendParticipantBookingResponse({
    bookingId: booking.id,
    eventId: booking.event_id,
    status,
    participantEmail: booking.participant_email,
    participantName: booking.participant_name,
    eventTitle: booking.event_title_snapshot,
    eventStartsAt: booking.event_starts_at_snapshot,
    facilitatorName: booking.facilitator_name_snapshot,
    eventUrl: status === "confirmed" ? publicEventUrl(booking.event_id, firstRelation(booking.events)?.slug ?? null) : null,
  });

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/bookings");
  revalidatePath("/");
  revalidatePath("/events/" + booking.event_id);

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

export async function updateBookingSeatsAction(formData: FormData) {
  const profile = await requireRole("facilitator");
  const bookingId = getString(formData, "booking_id");
  const currentEventId = getString(formData, "current_event_id");
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
    .select("id, event_id, facilitator_id, status, seats")
    .eq("id", bookingId)
    .eq("facilitator_id", facilitatorProfile.id)
    .single();

  if (!booking) {
    bookingsRedirect("Tilmeldingen kunne ikke findes.", currentEventId);
  }

  if (!["pending", "confirmed"].includes(booking.status)) {
    bookingsRedirect("Kun aktive tilmeldinger kan justeres.", booking.event_id);
  }

  if (seats >= booking.seats) {
    bookingsRedirect("Antal pladser kan kun sænkes her.", booking.event_id);
  }

  const { error } = await supabase.from("bookings").update({ seats }).eq("id", booking.id);

  if (error) {
    bookingsRedirect("Antal pladser kunne ikke opdateres.", booking.event_id);
  }

  await syncEventCapacityStatus(supabase, booking.event_id);

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/bookings");
  revalidatePath("/");
  revalidatePath("/events/" + booking.event_id);

  bookingsRedirect("Antal pladser er opdateret.", booking.event_id);
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
    .select("id, status")
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
  bookingsRedirect("Eventet er markeret som udsolgt. Eksisterende tilmeldinger er ikke ændret.", eventId);
}
