"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

function messageRedirect(facilitatorId: string, message: string): never {
  redirect("/facilitators/" + facilitatorId + "?reminder_message=" + encodeURIComponent(message) + "#reminder-signup");
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
    .eq("is_paused", false)
    .eq("is_disabled", false)
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
        unsubscribe_token: randomUUID(),
        unsubscribed_at: null,
      },
      { onConflict: "facilitator_id,email" },
    );

  if (error) {
    messageRedirect(facilitatorId, "Påmindelsen kunne ikke gemmes. Prøv igen.");
  }

  revalidatePath("/facilitators/" + facilitatorId);
  messageRedirect(facilitatorId, "Tak. Vi giver dig besked på e-mail, når arrangøren opretter et nyt event.");
}
