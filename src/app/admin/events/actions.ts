"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { notifyFacilitatorEventReminderSubscribers } from "@/lib/email/facilitator-new-event-reminder";
import { activeLimitMessage, getFacilitatorEventLimitStatus } from "@/lib/events/event-limits";
import { getString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventStatus } from "@/types/database";

const allowedStatuses: EventStatus[] = ["draft", "pending_review", "active", "rejected", "sold_out", "cancelled", "completed", "archived"];
const financiallyClosedStatuses = ["below_threshold", "no_revenue", "settled", "waived"];
const missingCoverPublishMessage = "Tilføj et coverbillede, før eventet kan offentliggøres.";

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
    .select("id, ends_at, facilitator_id, published_at, status, cover_image_path, facilitator_profiles(status, is_paused, is_disabled)")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) {
    go("Eventet kunne ikke findes.");
  }

  if (status === "active" || status === "sold_out") {
    const facilitator = Array.isArray(event.facilitator_profiles) ? event.facilitator_profiles[0] : event.facilitator_profiles;

    if (facilitator?.status !== "approved" || facilitator?.is_paused || facilitator?.is_disabled) {
      go("Eventet kan først publiceres, når arrangøren er aktiv og godkendt.");
    }

    if (!event.cover_image_path) {
      go(missingCoverPublishMessage);
    }

    const limitStatus = await getFacilitatorEventLimitStatus(supabase, event.facilitator_id, {
      excludeEventId: event.id,
    });

    if (limitStatus.activeCount >= limitStatus.maxActiveEvents) {
      go(activeLimitMessage(limitStatus.maxActiveEvents));
    }
  }

  if (status === "archived" && event.published_at && event.ends_at && new Date(event.ends_at) <= new Date()) {
    const { data: financialRecord, error: financialRecordError } = await supabase
      .from("event_financial_records")
      .select("status")
      .eq("event_id", event.id)
      .maybeSingle();

    if (financialRecordError) {
      console.error("[admin-events] financial archive guard failed", {
        eventId: event.id,
        message: financialRecordError.message,
      });
      go("Eventets økonomiske status kunne ikke kontrolleres.");
    }

    if (!financialRecord || !financiallyClosedStatuses.includes(financialRecord.status ?? "")) {
      go("Eventet kan først arkiveres, når det er økonomisk afsluttet.");
    }
  }

  const updatePayload: { published_at?: string | null; reviewed_at?: string | null; reviewed_by?: string | null; status: EventStatus } = { status };

  if (status === "active" || status === "sold_out") {
    updatePayload.published_at = new Date().toISOString();
    updatePayload.reviewed_at = new Date().toISOString();
    updatePayload.reviewed_by = adminProfile.id;
  }

  const { error } = await supabase.from("events").update(updatePayload).eq("id", eventId);

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

  if (status === "active" || status === "sold_out") {
    await notifyFacilitatorEventReminderSubscribers(event.id);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/events");
  revalidatePath("/");
  go("Eventstatus er opdateret.");
}

export async function markAdminEventReviewedAction(formData: FormData) {
  const adminProfile = await requireRole("admin");
  const eventId = getString(formData, "event_id");

  if (!eventId) {
    go("Eventet kunne ikke markeres som kontrolleret.");
  }

  const supabase = createAdminClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, facilitator_id, status, reviewed_at")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) {
    go("Eventet kunne ikke findes.");
  }

  if (!["active", "sold_out"].includes(event.status)) {
    go("Kun publicerede events kan markeres som kontrolleret.");
  }

  const reviewedAt = new Date().toISOString();
  const { error } = await supabase
    .from("events")
    .update({ reviewed_at: reviewedAt, reviewed_by: adminProfile.id })
    .eq("id", eventId);

  if (error) {
    go("Eventet kunne ikke markeres som kontrolleret.");
  }

  await supabase.from("admin_audit_log").insert({
    actor_profile_id: adminProfile.id,
    facilitator_id: event.facilitator_id,
    event_id: event.id,
    action: "event_reviewed",
    old_value: event.reviewed_at,
    new_value: reviewedAt,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/events");
  go("Eventet er markeret som kontrolleret.");
}
