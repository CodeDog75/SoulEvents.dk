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
