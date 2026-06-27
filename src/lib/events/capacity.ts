import type { SupabaseClient } from "@supabase/supabase-js";

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
