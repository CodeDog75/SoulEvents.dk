"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendParticipantBookingResponse } from "@/lib/email/participant-booking-response";
import { getString } from "@/lib/forms/form-data";
import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { BookingStatus } from "@/types/database";

const responseStatuses: BookingStatus[] = ["confirmed", "sold_out", "cancelled"];

function bookingsRedirect(message: string): never {
  redirect(`/facilitator/bookings?message=${encodeURIComponent(message)}`);
}

export async function updateBookingStatusAction(formData: FormData) {
  const profile = await requireRole("facilitator");
  const bookingId = getString(formData, "booking_id");
  const status = getString(formData, "status") as BookingStatus;

  if (!bookingId || !responseStatuses.includes(status)) {
    bookingsRedirect("Ugyldig tilmeldingshandling.");
  }

  const supabase = await createClient();
  const { data: facilitatorProfile } = await supabase
    .from("facilitator_profiles")
    .select("id")
    .eq("profile_id", profile.id)
    .single();

  if (!facilitatorProfile) {
    bookingsRedirect("Arrangørprofilen mangler.");
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
      event_title_snapshot,
      event_starts_at_snapshot,
      facilitator_name_snapshot
    `,
    )
    .eq("id", bookingId)
    .eq("facilitator_id", facilitatorProfile.id)
    .single();

  if (!booking) {
    bookingsRedirect("Tilmeldingen kunne ikke findes.");
  }

  const { error } = await supabase.from("bookings").update({ status }).eq("id", bookingId);

  if (error) {
    bookingsRedirect("Tilmeldingsstatus kunne ikke opdateres.");
  }

  await sendParticipantBookingResponse({
    bookingId: booking.id,
    eventId: booking.event_id,
    status,
    participantEmail: booking.participant_email,
    participantName: booking.participant_name,
    eventTitle: booking.event_title_snapshot,
    eventStartsAt: booking.event_starts_at_snapshot,
    facilitatorName: booking.facilitator_name_snapshot,
  });

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/bookings");

  const labels: Record<string, string> = {
    confirmed: "bekræftet",
    sold_out: "markeret som udsolgt",
    cancelled: "aflyst",
  };

  bookingsRedirect(`Tilmeldingen er ${labels[status]}, og deltageren har fået besked.`);
}
