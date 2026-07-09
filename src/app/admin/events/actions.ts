"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { notifyFacilitatorEventReminderSubscribers } from "@/lib/email/facilitator-new-event-reminder";
import { activeLimitMessage, getFacilitatorEventLimitStatus } from "@/lib/events/event-limits";
import { getString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventStatus } from "@/types/database";

const allowedStatuses: EventStatus[] = ["draft", "pending_review", "active", "rejected", "completed", "archived"];

function go(message: string): never {
  redirect("/admin/events?message=" + encodeURIComponent(message));
}

export async function updateAdminEventStatusAction(formData: FormData) {
  const adminProfile = await requireRole("admin");

  const eventId = getString(formData, "event_id");
  const status = getString(formData, "status") as EventStatus;

  if (!eventId || !allowedStatuses.includes(status)) {
    go("Ugyldig eventhandling.");
  }

  const supabase = createAdminClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, facilitator_id, status, facilitator_profiles(status)")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) {
    go("Eventet kunne ikke findes.");
  }

  if (status === "active") {
    const facilitator = Array.isArray(event.facilitator_profiles) ? event.facilitator_profiles[0] : event.facilitator_profiles;

    if (facilitator?.status !== "approved") {
      go("Eventet kan først godkendes, når arrangøren er godkendt.");
    }

    const limitStatus = await getFacilitatorEventLimitStatus(supabase, event.facilitator_id, {
      excludeEventId: event.id,
    });

    if (limitStatus.activeCount >= limitStatus.maxActiveEvents) {
      go(activeLimitMessage(limitStatus.maxActiveEvents));
    }
  }

  const { error } = await supabase.from("events").update({ status }).eq("id", eventId);

  if (error) {
    go("Eventstatus kunne ikke opdateres.");
  }

  await supabase.from("admin_audit_log").insert({
    actor_profile_id: adminProfile.id,
    facilitator_id: event.facilitator_id,
    event_id: event.id,
    action: "event_status_changed",
    old_value: event.status,
    new_value: status,
  });

  if (status === "active") {
    await notifyFacilitatorEventReminderSubscribers(event.id);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/events");
  revalidatePath("/");
  go("Eventstatus er opdateret.");
}
