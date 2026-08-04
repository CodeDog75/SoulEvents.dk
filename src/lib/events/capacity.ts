import type { SupabaseClient } from "@supabase/supabase-js";

const capacityStatuses = ["active", "sold_out"];
export const activeBookingStatuses = ["pending", "confirmed"] as const;

function sumSeats(rows: Array<{ seats?: number | null }> | null | undefined) {
  return rows?.reduce((sum: number, row) => sum + (row.seats ?? 0), 0) ?? 0;
}

export function isActiveBookingStatus(status?: string | null) {
  return activeBookingStatuses.includes(status as (typeof activeBookingStatuses)[number]);
}

export function getReservedSeatsFromRows(input: {
  bookings?: Array<{ seats?: number | null; status?: string | null }> | null;
  externalParticipants?: Array<{ seats?: number | null }> | null;
}) {
  return sumSeats(input.bookings?.filter((booking) => isActiveBookingStatus(booking.status))) + sumSeats(input.externalParticipants);
}

export async function getReservedEventSeatsByEventId(adminSupabase: SupabaseClient, eventIds: string[]) {
  const uniqueEventIds = Array.from(new Set(eventIds));
  const reservedSeatsByEventId = new Map<string, number>();

  if (uniqueEventIds.length === 0) {
    return reservedSeatsByEventId;
  }

  const [{ data: bookings }, { data: externalParticipants }] = await Promise.all([
    adminSupabase
      .from("bookings")
      .select("event_id, seats, status")
      .in("event_id", uniqueEventIds)
      .in("status", activeBookingStatuses),
    adminSupabase
      .from("external_event_participants")
      .select("event_id, seats")
      .in("event_id", uniqueEventIds),
  ]);

  for (const booking of bookings ?? []) {
    const eventId = booking.event_id as string | null;
    if (!eventId) continue;

    reservedSeatsByEventId.set(eventId, (reservedSeatsByEventId.get(eventId) ?? 0) + (booking.seats ?? 0));
  }

  for (const participant of externalParticipants ?? []) {
    const eventId = participant.event_id as string | null;
    if (!eventId) continue;

    reservedSeatsByEventId.set(eventId, (reservedSeatsByEventId.get(eventId) ?? 0) + (participant.seats ?? 0));
  }

  return reservedSeatsByEventId;
}

export async function getAvailableEventSeats(adminSupabase: SupabaseClient, eventId: string, capacity: number) {
  const [{ data: bookings }, { data: externalParticipants }] = await Promise.all([
    adminSupabase
      .from("bookings")
      .select("seats, status")
      .eq("event_id", eventId)
      .in("status", activeBookingStatuses),
    adminSupabase
      .from("external_event_participants")
      .select("seats")
      .eq("event_id", eventId),
  ]);

  const reservedSeats = getReservedSeatsFromRows({ bookings, externalParticipants });

  return Math.max(capacity - reservedSeats, 0);
}

export async function getAvailableEventSeatsByEventId(
  adminSupabase: SupabaseClient,
  events: Array<{ id: string; capacity?: number | null }>,
) {
  const eventIds = events.map((event) => event.id);

  if (eventIds.length === 0) {
    return new Map<string, number | null>();
  }

  const reservedSeatsByEventId = await getReservedEventSeatsByEventId(adminSupabase, eventIds);

  return new Map(
    events.map((event) => [
      event.id,
      typeof event.capacity === "number"
        ? Math.max(event.capacity - (reservedSeatsByEventId.get(event.id) ?? 0), 0)
        : null,
    ]),
  );
}

export async function syncEventCapacityStatus(supabase: SupabaseClient, eventId: string) {
  const { data: event } = await supabase.from("events").select("id, capacity, status").eq("id", eventId).maybeSingle();

  if (!event || !capacityStatuses.includes(event.status)) {
    return;
  }

  const availableSeats = await getAvailableEventSeats(supabase, event.id, event.capacity);
  const nextStatus = availableSeats <= 0 ? "sold_out" : "active";

  if (event.status !== nextStatus) {
    await supabase.from("events").update({ status: nextStatus }).eq("id", event.id);
  }
}
