"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { getFacilitatorSubmissionReadiness } from "@/lib/facilitators/profile-readiness";
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
    .select("id, company_name, profile_image_path, short_description, long_description, status, is_disabled, is_paused, facilitator_categories(category_id), facilitator_images(image_path)")
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
    status: "unread",
    subject,
    message,
  });

  if (error) {
    console.error("sendFacilitatorAdminMessageAction failed", error);
    go("Beskeden kunne ikke sendes. Prøv igen.");
  }

  revalidatePath("/facilitator");
  revalidatePath("/admin");
  revalidatePath("/admin/messages");
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
    status: "unread",
    subject: "Arrangørprofil sat på pause",
    message,
  });

  if (messageError) {
    console.error("requestFacilitatorProfileClosureAction failed", messageError);
    go("Anmodningen kunne ikke sendes. Prøv igen.");
  }

  await admin.from("facilitator_profiles").update({ is_paused: true }).eq("id", facilitator.id);

  revalidatePath("/facilitator");
  revalidatePath("/admin");
  revalidatePath("/admin/messages");
  revalidatePath("/facilitators");
  revalidatePath("/facilitators/" + facilitator.id);
  go("Din arrangørprofil er sat på pause. Din profil og dine aktive events er skjult på SoulEvents.");
}

export async function activateFacilitatorProfileAction() {
  const { admin, facilitator } = await getFacilitatorForCurrentUser();

  if (facilitator.is_disabled) {
    go("Din arrangørkonto er deaktiveret. Kontakt SoulEvents, hvis du mener, at dette er en fejl.");
  }

  if (!facilitator.is_paused) {
    go("Din arrangørprofil er allerede aktiv eller afventer godkendelse.");
  }

  const { error } = await admin.from("facilitator_profiles").update({ is_paused: false }).eq("id", facilitator.id);

  if (error) {
    console.error("activateFacilitatorProfileAction failed", error);
    go("Profilen kunne ikke aktiveres. Prøv igen.");
  }

  revalidatePath("/facilitator");
  revalidatePath("/facilitators");
  revalidatePath("/facilitators/" + facilitator.id);
  go("Din arrangørprofil er aktiv igen. Din profil og dine aktive events kan nu vises på SoulEvents.");
}

export async function sendFacilitatorProfileToReviewAction() {
  const { admin, facilitator, profile } = await getFacilitatorForCurrentUser();

  if (facilitator.is_disabled) {
    go("Din arrangørkonto er deaktiveret. Kontakt SoulEvents, hvis du mener, at dette er en fejl.");
  }

  if (facilitator.status !== "changes_requested") {
    go("Din profil kan ikke sendes til ny godkendelse lige nu.");
  }

  const readiness = getFacilitatorSubmissionReadiness({
    categoryIds: facilitator.facilitator_categories?.map((row: { category_id: string }) => row.category_id) ?? [],
    companyName: facilitator.company_name,
    fullName: profile.full_name,
    hasMoodImage: Boolean(facilitator.facilitator_images?.length),
    hasProfileImage: Boolean(facilitator.profile_image_path),
    shortDescription: facilitator.long_description || facilitator.short_description,
  });

  if (!readiness.isComplete) {
    go("Ret de manglende profiloplysninger, før du sender profilen til ny godkendelse.");
  }

  const { error } = await admin
    .from("facilitator_profiles")
    .update({ status: "pending" })
    .eq("id", facilitator.id);

  if (error) {
    console.error("sendFacilitatorProfileToReviewAction failed", error);
    go("Profilen kunne ikke sendes til ny godkendelse. Prøv igen.");
  }

  await admin.from("admin_audit_log").insert({
    actor_profile_id: profile.id,
    action: "facilitator_resubmitted_for_review",
    facilitator_id: facilitator.id,
    old_value: "changes_requested",
    new_value: "pending",
  });

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/profile");
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  go("Din profil er sendt til ny godkendelse.");
}

export async function markFacilitatorAdminMessagesReadAction() {
  const { admin, facilitator } = await getFacilitatorForCurrentUser();

  await admin
    .from("facilitator_admin_messages")
    .update({
      facilitator_read_at: new Date().toISOString(),
      status: "read",
    })
    .eq("facilitator_id", facilitator.id)
    .eq("type", "admin_reply")
    .eq("status", "unread");

  revalidatePath("/facilitator");
  redirect("/facilitator?messages=open&message=" + encodeURIComponent("Beskederne er markeret som læst.") + "#beskeder-admin");
}
