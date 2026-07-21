import Link from "next/link";
import { ArrowLeft, Inbox } from "lucide-react";
import { AuthMessage } from "@/components/auth/auth-message";
import { BookingList } from "@/components/facilitator/bookings/booking-list";
import { requireRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type FacilitatorBookingsPageProps = {
  searchParams: Promise<{
    booking?: string;
    event?: string;
    message?: string;
  }>;
};

const bookingSelect =
  "id, event_id, status, participant_name, participant_email, participant_phone, seats, message, event_title_snapshot, event_starts_at_snapshot, booking_number, booking_reference, booking_value_cents, payment_reference, payment_instructions_snapshot, payment_due_at, payment_snapshot_created_at, payment_reminder_sent_at, manually_marked_paid_at, manually_marked_paid_by, manual_payment_note, created_at";

const bookingSelectWithoutReminder =
  "id, event_id, status, participant_name, participant_email, participant_phone, seats, message, event_title_snapshot, event_starts_at_snapshot, booking_value_cents, payment_reference, payment_instructions_snapshot, payment_due_at, payment_snapshot_created_at, manually_marked_paid_at, manually_marked_paid_by, manual_payment_note, created_at";

export default async function FacilitatorBookingsPage({ searchParams }: FacilitatorBookingsPageProps) {
  const [{ booking, event, message }, profile] = await Promise.all([searchParams, requireRole("facilitator")]);
  const supabase = await createClient();

  const { data: facilitatorProfile } = await supabase
    .from("facilitator_profiles")
    .select("id")
    .eq("profile_id", profile.id)
    .single();

  const now = new Date();
  const { data: eventOptions } = facilitatorProfile
    ? await supabase
        .from("events")
        .select("id, title, starts_at, ends_at, status, capacity, address_line, city, bookings(id, status, seats)")
        .eq("facilitator_id", facilitatorProfile.id)
        .in("status", ["active", "sold_out"])
        .order("starts_at", { ascending: true })
    : { data: [] };

  const currentEventOptions = (eventOptions ?? []).filter((eventOption) => {
    const eventEndsAt = eventOption.ends_at ?? eventOption.starts_at;
    return eventEndsAt ? new Date(eventEndsAt) >= now : false;
  });
  const selectedEvent = currentEventOptions.find((eventOption) => eventOption.id === event) ?? null;

  let bookingsErrorMessage: string | null = null;
  let bookings: unknown[] = [];

  if (selectedEvent && facilitatorProfile) {
    const adminSupabase = createAdminClient();
    const bookingResult = await adminSupabase
      .from("bookings")
      .select(bookingSelect)
      .eq("event_id", selectedEvent.id)
      .order("created_at", { ascending: false });

    if (
      bookingResult.error?.code === "42703" ||
      bookingResult.error?.message.includes("payment_reminder_sent_at") ||
      bookingResult.error?.message.includes("booking_number") ||
      bookingResult.error?.message.includes("booking_reference")
    ) {
      const fallbackBookingResult = await adminSupabase
        .from("bookings")
        .select(bookingSelectWithoutReminder)
        .eq("event_id", selectedEvent.id)
        .order("created_at", { ascending: false });

      bookings = (fallbackBookingResult.data ?? []).map((booking) => ({
        ...booking,
        booking_number: null,
        booking_reference: booking.payment_reference,
        payment_reminder_sent_at: null,
      }));
      bookingsErrorMessage = fallbackBookingResult.error?.message ?? null;
    } else {
      bookings = bookingResult.data ?? [];
      bookingsErrorMessage = bookingResult.error?.message ?? null;
    }
  }

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-midnight text-white">
              <Inbox className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Arrangør</p>
              <h1 className="text-xl font-semibold text-midnight">Tilmeldinger</h1>
            </div>
          </div>
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta"
            href="/facilitator"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Tilbage
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <AuthMessage
          message={
            message ??
            (bookingsErrorMessage ? "Tilmeldingerne kunne ikke hentes lige nu. Prøv at genindlæse siden." : undefined)
          }
        />
        <BookingList
          bookings={(bookings ?? []) as never}
          eventOptions={currentEventOptions as never}
          initialExpandedBookingId={booking ?? null}
          selectedEventId={selectedEvent?.id ?? null}
        />
      </section>
    </main>
  );
}
