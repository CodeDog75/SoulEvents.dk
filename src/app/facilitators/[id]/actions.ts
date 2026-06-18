"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

function messageRedirect(facilitatorId: string, message: string): never {
  redirect("/facilitators/" + facilitatorId + "?reminder_message=" + encodeURIComponent(message));
}

function normalizeEmail(value: FormDataEntryValue | null) {
  return String(value || "").trim().toLowerCase();
}

export async function subscribeToFacilitatorReminderAction(facilitatorId: string, formData: FormData) {
  const email = normalizeEmail(formData.get("email"));

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    messageRedirect(facilitatorId, "Skriv venligst en gyldig e-mailadresse.");
  }

  const admin = createAdminClient();
  const { data: facilitator } = await admin
    .from("facilitator_profiles")
    .select("id")
    .eq("id", facilitatorId)
    .eq("status", "approved")
    .maybeSingle();

  if (!facilitator) {
    messageRedirect(facilitatorId, "Arrangøren kunne ikke findes.");
  }

  const { error } = await admin
    .from("facilitator_event_reminders")
    .upsert(
      {
        facilitator_id: facilitatorId,
        email,
        status: "active",
        unsubscribed_at: null,
      },
      { onConflict: "facilitator_id,email" },
    );

  if (error) {
    messageRedirect(facilitatorId, "Påmindelsen kunne ikke gemmes. Prøv igen.");
  }

  revalidatePath("/facilitators/" + facilitatorId);
  messageRedirect(facilitatorId, "Tak. Du får besked på e-mail, når arrangøren opretter et nyt event.");
}
