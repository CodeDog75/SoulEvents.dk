import { createAdminClient } from "@/lib/supabase/admin";

export type PublicBookingEvent = {
  address_line: string | null;
  city: string | null;
  country: string | null;
  ends_at: string;
  event_format: string | null;
  facilitator_profiles:
    | {
        company_name: string | null;
        profiles?: { email: string | null; full_name: string | null } | { email: string | null; full_name: string | null }[] | null;
      }
    | Array<{
        company_name: string | null;
        profiles?: { email: string | null; full_name: string | null } | { email: string | null; full_name: string | null }[] | null;
      }>
    | null;
  id: string;
  online_url_or_note: string | null;
  postal_code: string | null;
  slug: string | null;
  starts_at: string;
  status: string;
  title: string;
};

export type PublicBooking = {
  event_id: string;
  event_starts_at_snapshot: string;
  event_title_snapshot: string;
  events: PublicBookingEvent | PublicBookingEvent[] | null;
  facilitator_name_snapshot: string;
  id: string;
  participant_access_token: string;
  participant_email: string;
  participant_name: string;
  seats: number;
  status: string;
};

const participantTokenPattern = /^[a-f0-9]{64}$/i;

export function isParticipantAccessToken(value: string | null | undefined) {
  return Boolean(value && participantTokenPattern.test(value));
}

export function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function getBookingByParticipantToken(token: string) {
  if (!isParticipantAccessToken(token)) {
    return null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookings")
    .select(
      `
      id,
      event_id,
      status,
      participant_access_token,
      participant_name,
      participant_email,
      seats,
      event_title_snapshot,
      event_starts_at_snapshot,
      facilitator_name_snapshot,
      events!inner(
        id,
        slug,
        title,
        status,
        starts_at,
        ends_at,
        address_line,
        postal_code,
        city,
        country,
        event_format,
        online_url_or_note,
        facilitator_profiles!events_facilitator_id_fkey(
          company_name,
          profiles!facilitator_profiles_profile_id_fkey(email, full_name)
        )
      )
    `,
    )
    .eq("participant_access_token", token)
    .maybeSingle();

  if (error) {
    console.error("[participant-booking-access] Booking lookup failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
    });
    return null;
  }

  return data as PublicBooking | null;
}

export function publicBookingEvent(booking: PublicBooking | null) {
  return firstRelation(booking?.events);
}

export function eventHasEnded(event: PublicBookingEvent | null | undefined, now = new Date()) {
  if (!event?.ends_at) {
    return true;
  }

  return new Date(event.ends_at).getTime() <= now.getTime();
}

export function canParticipantCancelBooking(booking: PublicBooking | null, now = new Date()) {
  const event = publicBookingEvent(booking);
  return Boolean(
    booking &&
      event &&
      ["pending", "confirmed"].includes(booking.status) &&
      event.status !== "cancelled" &&
      !eventHasEnded(event, now),
  );
}

export function canParticipantUseCalendar(booking: PublicBooking | null, now = new Date()) {
  const event = publicBookingEvent(booking);
  return Boolean(
    booking &&
      event &&
      booking.status === "confirmed" &&
      !["cancelled", "completed", "archived"].includes(event.status) &&
      !eventHasEnded(event, now),
  );
}
