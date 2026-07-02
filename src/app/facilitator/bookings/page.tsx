import Link from "next/link";
import { ArrowLeft, Inbox } from "lucide-react";
import { AuthMessage } from "@/components/auth/auth-message";
import { BookingList } from "@/components/facilitator/bookings/booking-list";
import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type FacilitatorBookingsPageProps = {
  searchParams: Promise<{
    event?: string;
    message?: string;
  }>;
};

export default async function FacilitatorBookingsPage({ searchParams }: FacilitatorBookingsPageProps) {
  const [{ event, message }, profile] = await Promise.all([searchParams, requireRole("facilitator")]);
  const supabase = await createClient();

  const { data: facilitatorProfile } = await supabase
    .from("facilitator_profiles")
    .select("id")
    .eq("profile_id", profile.id)
    .single();

  const bookingsQuery = facilitatorProfile
    ? supabase
        .from("bookings")
        .select(
          "id, event_id, status, participant_name, participant_email, participant_phone, seats, message, event_title_snapshot, event_starts_at_snapshot, booking_value_cents, commission_cents, created_at",
        )
        .eq("facilitator_id", facilitatorProfile.id)
    : null;

  const { data: bookings } = bookingsQuery
    ? await (event ? bookingsQuery.eq("event_id", event) : bookingsQuery).order("created_at", { ascending: false })
    : { data: [] };

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
        <AuthMessage message={message} />
        <BookingList bookings={(bookings ?? []) as never} />
      </section>
    </main>
  );
}
