import type { SupabaseClient } from "@supabase/supabase-js";

const capacityStatuses = ["active", "sold_out"];

export async function getAvailableEventSeats(adminSupabase: SupabaseClient, eventId: string, capacity: number) {
  const { data: bookings } = await adminSupabase
    .from("bookings")
    .select("seats")
    .eq("event_id", eventId)
    .in("status", ["pending", "confirmed"]);

  const reservedSeats =
    bookings?.reduce((sum: number, booking: { seats?: number | null }) => sum + (booking.seats ?? 0), 0) ?? 0;

  return Math.max(capacity - reservedSeats, 0);
}

export async function getAvailableEventSeatsByEventId(
  adminSupabase: SupabaseClient,
  events: Array<{ id: string; capacity?: number | null }>,
) {
  const eventIds = events.map((event) => event.id);
  const reservedSeatsByEventId = new Map<string, number>();

  if (eventIds.length === 0) {
    return new Map<string, number | null>();
  }

  const { data: bookings } = await adminSupabase
    .from("bookings")
    .select("event_id, seats")
    .in("event_id", eventIds)
    .in("status", ["pending", "confirmed"]);

  for (const booking of bookings ?? []) {
    const eventId = booking.event_id as string | null;
    if (!eventId) continue;

    reservedSeatsByEventId.set(eventId, (reservedSeatsByEventId.get(eventId) ?? 0) + (booking.seats ?? 0));
  }

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
