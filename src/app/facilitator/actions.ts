"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

function getText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function go(message: string): never {
  redirect("/facilitator?message=" + encodeURIComponent(message));
}

async function getFacilitatorForCurrentUser() {
  const profile = await requireRole("facilitator");
  const admin = createAdminClient();
  const { data: facilitator } = await admin
    .from("facilitator_profiles")
    .select("id, company_name")
    .eq("profile_id", profile.id)
    .single();

  if (!facilitator) {
    go("Arrangørprofilen kunne ikke findes.");
  }

  return { admin, profile, facilitator };
}

export async function sendFacilitatorAdminMessageAction(formData: FormData) {
  const subject = getText(formData, "subject") || "Besked fra arrangør";
  const message = getText(formData, "message");

  if (!message || message.length > 500) {
    go("Skriv en besked på højst 500 tegn.");
  }

  const { admin, profile, facilitator } = await getFacilitatorForCurrentUser();
  const { error } = await admin.from("facilitator_admin_messages").insert({
    facilitator_id: facilitator.id,
    profile_id: profile.id,
    type: "message",
    subject,
    message,
  });

  if (error) {
    go("Beskeden kunne ikke sendes. Prøv igen.");
  }

  revalidatePath("/facilitator");
  revalidatePath("/admin");
  go("Beskeden er sendt til admin.");
}

export async function requestFacilitatorProfileClosureAction(formData: FormData) {
  const confirmed = formData.get("confirm_closure") === "on";
  const reason = getText(formData, "reason");

  if (!confirmed) {
    go("Bekræft venligst, at du ønsker at sætte din arrangørprofil på pause.");
  }

  if (reason.length > 500) {
    go("Begrundelsen må højst være 500 tegn.");
  }

  const { admin, profile, facilitator } = await getFacilitatorForCurrentUser();
  const message = reason || "Arrangøren har ikke skrevet en begrundelse.";

  const { error: messageError } = await admin.from("facilitator_admin_messages").insert({
    facilitator_id: facilitator.id,
    profile_id: profile.id,
    type: "closure_request",
    subject: "Anmodning om at sætte arrangørprofil på pause",
    message,
  });

  if (messageError) {
    go("Anmodningen kunne ikke sendes. Prøv igen.");
  }

  await admin.from("facilitator_profiles").update({ status: "disabled" }).eq("id", facilitator.id);

  revalidatePath("/facilitator");
  revalidatePath("/admin");
  go("Din arrangørprofil er sat på pause, og admin har fået besked om din anmodning.");
}
