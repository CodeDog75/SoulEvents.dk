import {
  firstRelation,
  publicBookingEvent,
  type PublicBooking,
  type PublicBookingEvent,
} from "@/lib/bookings/public-booking-access";
import type { CalendarEventInput } from "@/lib/calendar/booking-calendar";

export function participantCalendarInput(
  booking: PublicBooking,
  event: PublicBookingEvent,
  siteUrl: string,
): CalendarEventInput {
  const facilitatorProfile = firstRelation(event.facilitator_profiles);
  const facilitatorUser = firstRelation(facilitatorProfile?.profiles);

  return {
    addressLine: event.address_line,
    city: event.city,
    country: event.country,
    endsAt: event.ends_at,
    eventFormat: event.event_format,
    eventId: event.id,
    eventSlug: event.slug,
    facilitatorName:
      booking.facilitator_name_snapshot ||
      facilitatorProfile?.company_name ||
      facilitatorUser?.full_name ||
      "Arrangør",
    onlineUrlOrNote: event.online_url_or_note,
    postalCode: event.postal_code,
    siteUrl,
    startsAt: event.starts_at || booking.event_starts_at_snapshot,
    title: event.title || booking.event_title_snapshot,
  };
}

export function participantCalendarInputFromBooking(booking: PublicBooking, siteUrl: string) {
  const event = publicBookingEvent(booking);
  return event ? participantCalendarInput(booking, event, siteUrl) : null;
}
