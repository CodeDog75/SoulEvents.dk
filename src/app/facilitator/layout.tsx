import { FacilitatorDashboardShell } from "@/components/facilitator/facilitator-dashboard-shell";
import { requireProfile } from "@/lib/auth/roles";
import { getFacilitatorUnreadAdminMessageCount } from "@/lib/facilitator/dashboard-data";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function FacilitatorLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile({ allowDisabledFacilitator: true });

  if (profile.role !== "facilitator") {
    return <>{children}</>;
  }

  const supabase = await createClient();
  const { data: facilitatorProfile } = await supabase
    .from("facilitator_profiles")
    .select("id, city, company_name, host_reference_id, profile_image_path")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!facilitatorProfile?.id) {
    return <>{children}</>;
  }

  const now = new Date();
  const [unreadMessagesCount, { data: pendingBookingRows }] = await Promise.all([
    getFacilitatorUnreadAdminMessageCount(facilitatorProfile.id),
    supabase
      .from("bookings")
      .select("id, event_id, events!inner(id, facilitator_id, starts_at, ends_at, status)")
      .eq("events.facilitator_id", facilitatorProfile.id)
      .eq("status", "pending")
      .in("events.status", ["active", "sold_out"]),
  ]);

  const pendingBookingsCount = (pendingBookingRows ?? []).filter((booking) => {
    const event = Array.isArray(booking.events) ? booking.events[0] : booking.events;
    const eventEndsAt = event?.ends_at ?? event?.starts_at;
    return eventEndsAt ? new Date(eventEndsAt) >= now : false;
  }).length;
  const facilitatorImageUrl = facilitatorProfile.profile_image_path
    ? supabase.storage.from("media").getPublicUrl(facilitatorProfile.profile_image_path).data.publicUrl
    : null;

  return (
    <FacilitatorDashboardShell
      facilitatorIdentity={{
        city: facilitatorProfile.city,
        hostReferenceId: facilitatorProfile.host_reference_id,
        imageUrl: facilitatorImageUrl,
        name: facilitatorProfile.company_name || profile.full_name || "Arrangør",
      }}
      pendingBookingsCount={pendingBookingsCount}
      unreadMessagesCount={unreadMessagesCount}
    >
      {children}
    </FacilitatorDashboardShell>
  );
}
