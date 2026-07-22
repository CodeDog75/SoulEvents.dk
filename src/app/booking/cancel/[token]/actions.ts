"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canParticipantCancelBooking,
  firstRelation,
  getBookingByParticipantToken,
  publicBookingEvent,
} from "@/lib/bookings/public-booking-access";
import { sendFacilitatorBookingCancellation, sendParticipantBookingCancellation } from "@/lib/email/booking-cancellation";
import { syncEventCapacityStatus } from "@/lib/events/capacity";
import { publicEventPath } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";

function cancelRedirect(token: string, status: "cancelled" | "unavailable"): never {
  redirect(`/booking/cancel/${encodeURIComponent(token)}?status=${status}`);
}

export async function cancelParticipantBookingAction(formData: FormData) {
  const token = String(formData.get("token") || "");
  const booking = await getBookingByParticipantToken(token);

  if (!canParticipantCancelBooking(booking)) {
    cancelRedirect(token, "unavailable");
  }

  const event = publicBookingEvent(booking);
  if (!booking || !event) {
    cancelRedirect(token, "unavailable");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", booking.id)
    .in("status", ["pending", "confirmed"]);

  if (error) {
    console.error("[participant-booking-cancel] Booking cancellation failed", {
      bookingId: booking.id,
      code: error.code,
      details: error.details,
      eventId: booking.event_id,
      hint: error.hint,
      message: error.message,
    });
    cancelRedirect(token, "unavailable");
  }

  await syncEventCapacityStatus(admin, booking.event_id);

  const facilitatorProfile = firstRelation(event.facilitator_profiles);
  const facilitatorUser = firstRelation(facilitatorProfile?.profiles);
  const facilitatorEmail = facilitatorUser?.email ?? null;

  const mailInput = {
    bookingId: booking.id,
    eventId: booking.event_id,
    eventStartsAt: event.starts_at,
    eventTitle: event.title || booking.event_title_snapshot,
    participantEmail: booking.participant_email,
    participantName: booking.participant_name,
    seats: booking.seats,
  };

  const [participantResult, facilitatorResult] = await Promise.allSettled([
    sendParticipantBookingCancellation(mailInput),
    sendFacilitatorBookingCancellation({
      ...mailInput,
      facilitatorEmail,
    }),
  ]);

  if (participantResult.status === "rejected" || facilitatorResult.status === "rejected") {
    console.error("[participant-booking-cancel] Cancellation mail delivery failed", {
      bookingId: booking.id,
      eventId: booking.event_id,
      facilitatorMailError: facilitatorResult.status === "rejected" ? facilitatorResult.reason : null,
      participantMailError: participantResult.status === "rejected" ? participantResult.reason : null,
    });
  }

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/bookings");
  revalidatePath(publicEventPath(event.slug || event.id));
  cancelRedirect(token, "cancelled");
}
