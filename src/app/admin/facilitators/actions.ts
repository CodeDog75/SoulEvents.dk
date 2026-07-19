"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/app-url";
import { requireRole } from "@/lib/auth/roles";
import { sendAdminEmailChangeConfirmation, sendEmailChangeSecurityNotice } from "@/lib/email/email-change";
import { sendAdminMessageNotificationEmail } from "@/lib/email/admin-message-notification";
import { facilitatorProfileEditUrl, sendFacilitatorProfileChangesRequestedEmail } from "@/lib/email/facilitator-profile-changes-requested";
import { sendFacilitatorProfileDeactivatedEmail } from "@/lib/email/facilitator-profile-deactivated";
import { getAllStrings, getOptionalString, getString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FacilitatorStatus } from "@/types/database";

const allowedStatuses: FacilitatorStatus[] = ["pending", "approved"];
const editableStatuses: FacilitatorStatus[] = ["pending", "approved", "changes_requested"];
const missingColumnErrorCodes = ["42703", "PGRST204"];

const profileChangeFieldLabels = {
  description: "Beskrivelse",
  mood_images: "Stemningsbilleder",
  other: "Andet",
  profile_image: "Profilbillede",
  social_links: "Sociale medier",
  website: "Hjemmeside",
  work_areas: "Arbejdsområder",
} as const;

type FacilitatorProfileContact = {
  email?: string | null;
  first_name?: string | null;
  full_name?: string | null;
};

type FacilitatorMessageRecipient = {
  id: string;
  is_disabled?: boolean | null;
  profile_id: string | null;
  status?: FacilitatorStatus | null;
};

type AdminSupabaseClient = ReturnType<typeof createAdminClient>;

async function getFacilitatorMessageRecipient(supabase: AdminSupabaseClient, facilitatorId: string) {
  const { data: facilitator, error: facilitatorError } = await supabase
    .from("facilitator_profiles")
    .select("id, is_disabled, profile_id, status")
    .eq("id", facilitatorId)
    .maybeSingle<FacilitatorMessageRecipient>();

  if (facilitatorError) {
    console.error("Admin message facilitator lookup failed", {
      errorCode: facilitatorError.code ?? null,
      errorMessage: facilitatorError.message,
    });
  }

  if (!facilitator?.profile_id) {
    return { facilitator: null, profile: null };
  }

  let profile: FacilitatorProfileContact | null = null;
  const profileResult = await supabase
    .from("profiles")
    .select("email, first_name, full_name")
    .eq("id", facilitator.profile_id)
    .maybeSingle();

  if (profileResult.error) {
    const fallbackResult = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", facilitator.profile_id)
      .maybeSingle();

    if (fallbackResult.error) {
      console.error("Admin message profile lookup failed", {
        errorCode: fallbackResult.error.code ?? null,
        errorMessage: fallbackResult.error.message,
      });
    }

    profile = fallbackResult.data ?? null;
  } else {
    profile = profileResult.data ?? null;
  }

  return { facilitator, profile };
}

function adminRedirect(message: string): never {
  redirect(`/admin?message=${encodeURIComponent(message)}`);
}

function safeAdminReturnPath(returnTo: string | null | undefined, fallback = "/admin") {
  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(returnTo, "https://soulevents.local");
    if (url.origin !== "https://soulevents.local") {
      return fallback;
    }

    if (url.pathname !== "/admin" && url.pathname !== "/admin/users") {
      return fallback;
    }

    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

function clearAdminUsersSearchParams(returnPath: string) {
  const url = new URL(returnPath, "https://soulevents.local");
  if (url.pathname !== "/admin/users") {
    return returnPath;
  }

  url.searchParams.delete("q");
  url.searchParams.delete("type");
  url.searchParams.delete("page");
  url.searchParams.delete("event_page");
  return url.pathname + (url.search ? url.search : "") + url.hash;
}

function adminReturnRedirect(message: string, returnTo: string | null | undefined = "/admin", options?: { clearSearch?: boolean }): never {
  const safeReturnTo = safeAdminReturnPath(returnTo);
  const nextReturnTo = options?.clearSearch ? clearAdminUsersSearchParams(safeReturnTo) : safeReturnTo;
  const url = new URL(nextReturnTo, "https://soulevents.local");
  url.searchParams.set("message", message);
  redirect(url.pathname + (url.search ? url.search : "") + url.hash);
}

function adminMessageRedirect(message: string): never {
  redirect(`/admin/messages?message=${encodeURIComponent(message)}`);
}

function adminMessageReturnRedirect(message: string, returnTo = "/admin/messages"): never {
  const safeReturnTo = returnTo.startsWith("/admin/messages") || returnTo.startsWith("/admin/users") ? returnTo : "/admin/messages";
  const separator = safeReturnTo.includes("?") ? "&" : "?";
  redirect(`${safeReturnTo}${separator}message=${encodeURIComponent(message)}`);
}

function adminFacilitatorEditRedirect(facilitatorId: string, message: string): never {
  redirect(`/admin/facilitators/${facilitatorId}/edit?message=${encodeURIComponent(message)}`);
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function emailIsReserved(supabase: AdminSupabaseClient, email: string, profileId: string) {
  const [{ data: profileDuplicate, error: profileError }, { data: pendingDuplicate, error: pendingError }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .neq("id", profileId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("email_change_requests")
      .select("id")
      .ilike("new_email", email)
      .neq("profile_id", profileId)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileError || pendingError) {
    throw profileError ?? pendingError;
  }

  const perPage = 1000;
  let page = 1;
  let authDuplicate = false;
  while (!authDuplicate) {
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers({ page, perPage });
    if (usersError) {
      console.warn("[admin-email-change] Auth duplicate lookup failed", {
        message: usersError.message,
        profileRef: profileId.slice(0, 8),
      });
      break;
    }

    authDuplicate = users.users.some((user) => user.id !== profileId && normalizeEmail(user.email) === email);
    if (users.users.length < perPage) {
      break;
    }
    page += 1;
  }

  return Boolean(profileDuplicate || pendingDuplicate || authDuplicate);
}

export async function sendAdminMessageToFacilitatorAction(formData: FormData) {
  await requireRole("admin");

  const facilitatorId = getString(formData, "facilitator_id");
  const returnTo = getString(formData, "return_to") || "/admin/messages?box=sent";
  const subject = getString(formData, "subject") || "Besked fra SoulEvents administration";
  const message = getString(formData, "message");

  if (!facilitatorId || !message || message.length > 500 || subject.length > 120) {
    adminMessageReturnRedirect("Skriv en besked på højst 500 tegn.", returnTo);
  }

  const supabase = createAdminClient();
  const { facilitator, profile } = await getFacilitatorMessageRecipient(supabase, facilitatorId);

  if (!facilitator?.profile_id) {
    adminMessageReturnRedirect("Arrangøren kunne ikke findes.", returnTo);
  }

  if (facilitator.is_disabled) {
    adminMessageReturnRedirect(
      "Arrangøren er deaktiveret og kan ikke åbne interne beskeder. Kontakt arrangøren direkte via e-mail.",
      returnTo,
    );
  }

  const { error } = await supabase.from("facilitator_admin_messages").insert({
    facilitator_id: facilitator.id,
    profile_id: facilitator.profile_id,
    type: "admin_reply",
    status: "unread",
    subject,
    message,
  });

  if (error) {
    adminMessageReturnRedirect("Beskeden kunne ikke sendes. Kør eventuelt den nyeste Supabase-migration og prøv igen.", returnTo);
  }

  const { count: unreadCount } = await supabase
    .from("facilitator_admin_messages")
    .select("id", { count: "exact", head: true })
    .eq("facilitator_id", facilitator.id)
    .eq("type", "admin_reply")
    .eq("status", "unread");
  const notificationSent = await sendAdminMessageNotificationEmail({
    facilitatorId: facilitator.id,
    firstName: profile?.first_name || profile?.full_name?.split(/\s+/)[0] || null,
    recipientEmail: profile?.email ?? null,
    unreadCount: unreadCount ?? 1,
  });
  if (!notificationSent) {
    console.error("Admin message notification failed after message insert", {
      facilitatorId: facilitator.id,
      type: "admin_message_notification",
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/messages");
  revalidatePath("/facilitator");
  adminMessageReturnRedirect("Beskeden er sendt til arrangøren.", returnTo);
}

export async function replyToFacilitatorAdminMessageAction(formData: FormData) {
  await requireRole("admin");

  const originalMessageId = getString(formData, "message_id");
  const facilitatorId = getString(formData, "facilitator_id");
  const subject = getString(formData, "subject") || "Svar fra SoulEvents administration";
  const message = getString(formData, "message");

  if (!originalMessageId || !facilitatorId || !message || message.length > 500) {
    adminMessageRedirect("Skriv et svar på højst 500 tegn.");
  }

  const supabase = createAdminClient();
  const { facilitator, profile } = await getFacilitatorMessageRecipient(supabase, facilitatorId);

  if (!facilitator?.profile_id) {
    adminMessageRedirect("Arrangøren kunne ikke findes.");
  }

  if (facilitator.is_disabled) {
    adminMessageRedirect(
      "Arrangøren er deaktiveret og kan ikke åbne interne beskeder. Kontakt arrangøren direkte via e-mail.",
    );
  }

  const { error } = await supabase.from("facilitator_admin_messages").insert({
    facilitator_id: facilitator.id,
    profile_id: facilitator.profile_id,
    type: "admin_reply",
    status: "unread",
    subject: subject.startsWith("Re:") ? subject : "Re: " + subject,
    message,
  });

  if (error) {
    adminMessageRedirect("Svaret kunne ikke sendes. Kør eventuelt den nyeste Supabase-migration og prøv igen.");
  }

  const { count: unreadCount } = await supabase
    .from("facilitator_admin_messages")
    .select("id", { count: "exact", head: true })
    .eq("facilitator_id", facilitator.id)
    .eq("type", "admin_reply")
    .eq("status", "unread");
  const notificationSent = await sendAdminMessageNotificationEmail({
    facilitatorId: facilitator.id,
    firstName: profile?.first_name || profile?.full_name?.split(/\s+/)[0] || null,
    recipientEmail: profile?.email ?? null,
    unreadCount: unreadCount ?? 1,
  });
  if (!notificationSent) {
    console.error("Admin message notification failed after reply insert", {
      facilitatorId: facilitator.id,
      type: "admin_message_notification",
    });
  }

  await supabase
    .from("facilitator_admin_messages")
    .update({ status: "handled", read_at: new Date().toISOString() })
    .eq("id", originalMessageId);

  revalidatePath("/admin");
  revalidatePath("/admin/messages");
  revalidatePath("/facilitator");
  adminMessageRedirect("Svaret er sendt til arrangøren.");
}

export async function archiveFacilitatorAdminMessageAction(formData: FormData) {
  await requireRole("admin");

  const messageId = getString(formData, "message_id");

  if (!messageId) {
    adminMessageRedirect("Beskeden kunne ikke arkiveres.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("facilitator_admin_messages")
    .update({ status: "handled", read_at: new Date().toISOString() })
    .eq("id", messageId);

  if (error) {
    adminMessageRedirect("Beskeden kunne ikke arkiveres.");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/messages");
  adminMessageRedirect("Beskeden er arkiveret.");
}

export async function updateFacilitatorStatusAction(formData: FormData) {
  const adminProfile = await requireRole("admin");

  const facilitatorId = getString(formData, "facilitator_id");
  const status = getString(formData, "status") as FacilitatorStatus;
  const returnTo = getOptionalString(formData, "return_to") || "/admin";

  if (!facilitatorId || !allowedStatuses.includes(status)) {
    adminReturnRedirect("Ugyldig arrangørhandling.", returnTo);
  }

  if (status === "pending") {
    adminReturnRedirect("En godkendt eller deaktiveret arrangør kan ikke sættes tilbage til afventer. Brug deaktiver, hvis profilen ikke skal være synlig.", returnTo);
  }

  const supabase = createAdminClient();
  const { data: previousFacilitator } = await supabase
    .from("facilitator_profiles")
    .select("status")
    .eq("id", facilitatorId)
    .maybeSingle();
  const { error } = await supabase
    .from("facilitator_profiles")
    .update({ status })
    .eq("id", facilitatorId);

  if (error) {
    adminReturnRedirect("Arrangørstatus kunne ikke opdateres.", returnTo);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/facilitator");
  revalidatePath("/facilitator/profile");

  await supabase.from("admin_audit_log").insert({
    actor_profile_id: adminProfile.id,
    action: "facilitator_status_changed",
    facilitator_id: facilitatorId,
    old_value: previousFacilitator?.status ?? null,
    new_value: status,
  });

  const labels: Record<FacilitatorStatus, string> = {
    pending: "sat tilbage til afventer",
    approved: "godkendt",
    disabled: "deaktiveret",
    changes_requested: "markeret som kræver ændringer",
  };

  adminReturnRedirect(`Arrangør er ${labels[status]}.`, returnTo, { clearSearch: true });
}

export async function requestFacilitatorProfileChangesAction(formData: FormData) {
  const adminProfile = await requireRole("admin");

  const facilitatorId = getString(formData, "facilitator_id");
  const returnTo = getOptionalString(formData, "return_to") || "/admin";
  const changeFields = getAllStrings(formData, "change_fields").filter(
    (value): value is keyof typeof profileChangeFieldLabels => value in profileChangeFieldLabels,
  );
  const comment = getString(formData, "change_comment");
  const requestedFieldLabels = changeFields.map((field) => profileChangeFieldLabels[field]);

  if (!facilitatorId || changeFields.length === 0 || !comment || comment.length > 1000) {
    adminReturnRedirect("Vælg mindst ét område og skriv en kort kommentar til arrangøren.", returnTo);
  }

  const supabase = createAdminClient();
  const { data: facilitator, error: facilitatorError } = await supabase
    .from("facilitator_profiles")
    .select("id, status, company_name, profiles!facilitator_profiles_profile_id_fkey(email, full_name)")
    .eq("id", facilitatorId)
    .maybeSingle();

  if (facilitatorError || !facilitator) {
    adminReturnRedirect("Arrangøren kunne ikke findes.", returnTo);
  }

  if (facilitator.status !== "pending") {
    adminReturnRedirect("Kun arrangører, der afventer godkendelse, kan markeres som kræver ændringer her.", returnTo);
  }

  const relatedProfile = facilitator.profiles as FacilitatorProfileContact | FacilitatorProfileContact[] | null;
  const profile = Array.isArray(relatedProfile) ? relatedProfile[0] : relatedProfile;
  const facilitatorName = facilitator.company_name || profile?.full_name || "Din arrangørprofil";
  const previousStatus = facilitator.status;

  const { error: statusError } = await supabase
    .from("facilitator_profiles")
    .update({ status: "changes_requested" })
    .eq("id", facilitator.id);

  if (statusError) {
    adminReturnRedirect("Profilen kunne ikke markeres som kræver ændringer. Kontrollér at migration 071 er kørt.", returnTo);
  }

  await supabase.from("admin_audit_log").insert({
    actor_profile_id: adminProfile.id,
    action: "facilitator_changes_requested",
    facilitator_id: facilitator.id,
    old_value: previousStatus,
    new_value: "changes_requested",
    reason: JSON.stringify({
      comment,
      fields: requestedFieldLabels,
    }),
  });

  const mailSent = await sendFacilitatorProfileChangesRequestedEmail({
    comment,
    facilitatorEmail: profile?.email ?? null,
    facilitatorName,
    fields: requestedFieldLabels,
    profileEditUrl: facilitatorProfileEditUrl(),
  });

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/facilitator");
  revalidatePath("/facilitator/profile");
  revalidatePath("/facilitators/" + facilitator.id);
  revalidatePath("/admin/facilitators/" + facilitator.id + "/edit");

  adminReturnRedirect(mailSent ? "Der er sendt en anmodning om ændringer til arrangøren." : "Profilen er markeret som kræver ændringer, men e-mailen kunne ikke sendes.", returnTo, { clearSearch: true });
}

export async function disableFacilitatorAction(formData: FormData) {
  const adminProfile = await requireRole("admin");

  const facilitatorId = getString(formData, "facilitator_id");
  const reason = getOptionalString(formData, "disabled_reason");
  const adminMessage = getOptionalString(formData, "disabled_admin_message")?.trim() ?? "";

  if (!facilitatorId) {
    adminRedirect("Ugyldig arrangørhandling.");
  }

  if (adminMessage.length > 500) {
    adminRedirect("Beskeden til arrangøren må højst være 500 tegn.");
  }

  const supabase = createAdminClient();
  const { data: facilitator, error: facilitatorLookupError } = await supabase
    .from("facilitator_profiles")
    .select("id, status, is_disabled, company_name, profiles!facilitator_profiles_profile_id_fkey(email, full_name)")
    .eq("id", facilitatorId)
    .maybeSingle();
  if (facilitatorLookupError) {
    console.error("Facilitator deactivation recipient lookup failed", {
      errorCode: facilitatorLookupError.code ?? null,
      errorMessage: facilitatorLookupError.message,
      facilitatorId,
      type: "facilitator_profile_deactivated",
    });
  }
  const previousStatus = facilitator?.status ?? null;
  const previousDisabledState = facilitator?.is_disabled ?? null;
  const { error } = await supabase
    .from("facilitator_profiles")
    .update({
      disabled_at: new Date().toISOString(),
      disabled_by: adminProfile.id,
      disabled_reason: reason,
      is_disabled: true,
    })
    .eq("id", facilitatorId);

  if (error) {
    adminRedirect("Arrangøren kunne ikke deaktiveres.");
  }

  const relatedProfile = facilitator?.profiles as FacilitatorProfileContact | FacilitatorProfileContact[] | null;
  const profile = Array.isArray(relatedProfile) ? relatedProfile[0] : relatedProfile;
  const notificationSent = await sendFacilitatorProfileDeactivatedEmail({
    adminMessage,
    facilitatorEmail: profile?.email ?? null,
    facilitatorName: facilitator?.company_name || profile?.full_name || "arrangør",
    reason: reason ?? null,
    variant: previousStatus === "approved" ? "active_deactivated" : "pending_not_approved",
  });

  if (!notificationSent) {
    console.error("Facilitator deactivation email failed after admin edit disable", {
      facilitatorId,
      recipientFound: Boolean(profile?.email),
      type: "facilitator_profile_deactivated",
    });
  }

  await supabase.from("admin_audit_log").insert({
    actor_profile_id: adminProfile.id,
    action: "facilitator_disabled",
    facilitator_id: facilitatorId,
    old_value: JSON.stringify({
      isDisabled: previousDisabledState,
      status: previousStatus,
    }),
    new_value: JSON.stringify({
      adminMessage: adminMessage || null,
      emailError: notificationSent ? null : "email_delivery_failed",
      emailSent: notificationSent,
      isDisabled: true,
      reason: reason ?? null,
      status: previousStatus,
    }),
    reason: reason ?? null,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/facilitators");
  revalidatePath("/facilitators/" + facilitatorId);
  revalidatePath("/admin/facilitators/" + facilitatorId + "/edit");
  adminRedirect(notificationSent ? "Arrangør er deaktiveret." : "Arrangøren blev deaktiveret, men e-mailen kunne ikke sendes.");
}

export async function reactivateFacilitatorAction(formData: FormData) {
  const adminProfile = await requireRole("admin");

  const facilitatorId = getString(formData, "facilitator_id");

  if (!facilitatorId) {
    adminRedirect("Ugyldig arrangørhandling.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("facilitator_profiles")
    .update({
      disabled_at: null,
      disabled_by: null,
      disabled_reason: null,
      is_disabled: false,
    })
    .eq("id", facilitatorId);

  if (error) {
    adminRedirect("Arrangøren kunne ikke genaktiveres.");
  }

  await supabase.from("admin_audit_log").insert({
    actor_profile_id: adminProfile.id,
    action: "facilitator_reactivated",
    facilitator_id: facilitatorId,
    new_value: "enabled",
  });

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/facilitator");
  revalidatePath("/facilitators");
  revalidatePath("/facilitators/" + facilitatorId);
  revalidatePath("/admin/facilitators/" + facilitatorId + "/edit");
  adminRedirect("Arrangør er genaktiveret.");
}

export async function updateFacilitatorTemporaryPasswordAction(formData: FormData) {
  const adminProfile = await requireRole("admin");

  const facilitatorId = getString(formData, "facilitator_id");
  const profileId = getString(formData, "profile_id");
  const password = getString(formData, "temporary_password");
  const confirmPassword = getString(formData, "confirm_temporary_password");
  const confirmed = getString(formData, "confirm_support_password_change") === "yes";

  if (!facilitatorId || !profileId) {
    adminRedirect("Arrangøren kunne ikke findes.");
  }

  if (!confirmed) {
    adminFacilitatorEditRedirect(facilitatorId, "Bekræft at adgangskoden kun ændres som supporthandling.");
  }

  if (password.length < 10) {
    adminFacilitatorEditRedirect(facilitatorId, "Den midlertidige adgangskode skal være mindst 10 tegn.");
  }

  if (password !== confirmPassword) {
    adminFacilitatorEditRedirect(facilitatorId, "De to adgangskoder er ikke ens.");
  }

  const supabase = createAdminClient();
  const { data: facilitator, error: facilitatorError } = await supabase
    .from("facilitator_profiles")
    .select("id, profile_id")
    .eq("id", facilitatorId)
    .maybeSingle();

  if (facilitatorError || !facilitator || facilitator.profile_id !== profileId) {
    adminFacilitatorEditRedirect(facilitatorId, "Arrangøren kunne ikke findes.");
  }

  const { error } = await supabase.auth.admin.updateUserById(profileId, { password });

  if (error) {
    adminFacilitatorEditRedirect(facilitatorId, "Adgangskoden kunne ikke ændres.");
  }

  await supabase.from("admin_audit_log").insert({
    action: "facilitator_password_reset",
    actor_profile_id: adminProfile.id,
    facilitator_id: facilitatorId,
    new_value: "temporary_password_set",
  });

  revalidatePath("/admin");
  revalidatePath("/admin/facilitators/" + facilitatorId + "/edit");
  adminFacilitatorEditRedirect(facilitatorId, "Midlertidig adgangskode er gemt.");
}

export async function requestAdminFacilitatorEmailChangeAction(formData: FormData) {
  const adminProfile = await requireRole("admin");
  const facilitatorId = getString(formData, "facilitator_id");
  const profileId = getString(formData, "profile_id");
  const newEmail = normalizeEmail(getString(formData, "new_email"));
  const confirmEmail = normalizeEmail(getString(formData, "confirm_new_email"));
  const reason = getString(formData, "email_change_reason");
  const confirmed = getString(formData, "confirm_email_change") === "yes";

  if (!facilitatorId || !profileId) {
    adminRedirect("Arrangøren kunne ikke findes.");
  }

  if (!confirmed) {
    adminFacilitatorEditRedirect(facilitatorId, "Bekræft at mailændringen kun startes som supporthandling.");
  }

  if (!isValidEmail(newEmail)) {
    adminFacilitatorEditRedirect(facilitatorId, "Indtast en gyldig ny mailadresse.");
  }

  if (newEmail !== confirmEmail) {
    adminFacilitatorEditRedirect(facilitatorId, "De to mailadresser er ikke ens.");
  }

  if (!reason || reason.length > 500) {
    adminFacilitatorEditRedirect(facilitatorId, "Skriv en kort begrundelse på højst 500 tegn.");
  }

  const supabase = createAdminClient();
  const { data: facilitator, error: facilitatorError } = await supabase
    .from("facilitator_profiles")
    .select("id, company_name, profile_id, profiles!facilitator_profiles_profile_id_fkey(email, full_name)")
    .eq("id", facilitatorId)
    .maybeSingle();

  const profile = Array.isArray(facilitator?.profiles) ? facilitator?.profiles[0] : facilitator?.profiles;
  const currentEmail = normalizeEmail(profile?.email);

  if (facilitatorError || !facilitator || facilitator.profile_id !== profileId || !currentEmail) {
    adminFacilitatorEditRedirect(facilitatorId, "Arrangørens nuværende mailadresse kunne ikke findes.");
  }

  if (newEmail === currentEmail) {
    adminFacilitatorEditRedirect(facilitatorId, "Den nye mailadresse er den samme som den nuværende.");
  }

  const { data: existingPending, error: existingPendingError } = await supabase
    .from("email_change_requests")
    .select("id, expires_at")
    .eq("profile_id", profileId)
    .eq("status", "pending")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingPendingError) {
    adminFacilitatorEditRedirect(facilitatorId, "Aktuelle mailændringer kunne ikke kontrolleres.");
  }

  if (existingPending && new Date(existingPending.expires_at).getTime() >= Date.now()) {
    adminFacilitatorEditRedirect(facilitatorId, "Der findes allerede en mailændring, som afventer bekræftelse.");
  }

  if (existingPending) {
    await supabase.from("email_change_requests").update({ status: "expired" }).eq("id", existingPending.id);
  }

  let isReserved = false;
  try {
    isReserved = await emailIsReserved(supabase, newEmail, profileId);
  } catch (error) {
    console.error("[admin-email-change] Duplicate lookup failed", {
      facilitatorId,
      message: error instanceof Error ? error.message : "Ukendt fejl.",
    });
    adminFacilitatorEditRedirect(facilitatorId, "Mailadressen kunne ikke kontrolleres sikkert.");
  }

  if (isReserved) {
    adminFacilitatorEditRedirect(facilitatorId, "Mailadressen bruges allerede af en anden konto.");
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: requestRow, error: requestError } = await supabase
    .from("email_change_requests")
    .insert({
      admin_reason: reason,
      expires_at: expiresAt,
      facilitator_id: facilitatorId,
      new_email: newEmail,
      old_email: currentEmail,
      profile_id: profileId,
      requested_by_profile_id: adminProfile.id,
      requested_by_role: "admin",
    })
    .select("id")
    .single();

  if (requestError || !requestRow) {
    adminFacilitatorEditRedirect(facilitatorId, "Mailændringen kunne ikke registreres.");
  }

  const emailChangeRedirectTo = `${getAppUrl()}/auth/callback?flow=email-change`;
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    email: currentEmail,
    newEmail,
    options: {
      redirectTo: emailChangeRedirectTo,
    },
    type: "email_change_new",
  });

  const tokenHash = linkData.properties?.hashed_token ?? null;
  const actionUrl = tokenHash ? `${emailChangeRedirectTo}&token_hash=${encodeURIComponent(tokenHash)}&type=email_change` : null;
  if (linkError || !actionUrl) {
    await supabase.from("email_change_requests").update({ status: "cancelled" }).eq("id", requestRow.id);
    adminFacilitatorEditRedirect(facilitatorId, "Supabase kunne ikke oprette bekræftelseslinket til den nye mailadresse.");
  }

  const recipientName = facilitator.company_name || profile?.full_name || "arrangør";
  const [confirmationSent] = await Promise.all([
    sendAdminEmailChangeConfirmation({
      actionUrl,
      newEmail,
      recipientName,
    }),
    sendEmailChangeSecurityNotice({
      newEmail,
      oldEmail: currentEmail,
      recipientName,
      requestedBy: "admin",
    }),
  ]);

  if (!confirmationSent) {
    await supabase.from("email_change_requests").update({ status: "cancelled" }).eq("id", requestRow.id);
    adminFacilitatorEditRedirect(facilitatorId, "Bekræftelsesmailen kunne ikke sendes til den nye adresse.");
  }

  await supabase.from("admin_audit_log").insert({
    action: "profile_email_change_requested_by_admin",
    actor_profile_id: adminProfile.id,
    facilitator_id: facilitatorId,
    new_value: "email_change_pending",
    old_value: "email_change_current",
    reason,
  });

  revalidatePath("/admin/facilitators/" + facilitatorId + "/edit");
  adminFacilitatorEditRedirect(facilitatorId, "Mailændringen er startet og afventer bekræftelse fra arrangøren.");
}

export async function cancelAdminFacilitatorEmailChangeAction(formData: FormData) {
  const adminProfile = await requireRole("admin");
  const facilitatorId = getString(formData, "facilitator_id");
  const profileId = getString(formData, "profile_id");

  if (!facilitatorId || !profileId) {
    adminRedirect("Arrangøren kunne ikke findes.");
  }

  const supabase = createAdminClient();
  const { data: pendingRequest, error } = await supabase
    .from("email_change_requests")
    .select("id, old_email")
    .eq("profile_id", profileId)
    .eq("status", "pending")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    adminFacilitatorEditRedirect(facilitatorId, "Mailændringen kunne ikke hentes.");
  }

  if (!pendingRequest) {
    adminFacilitatorEditRedirect(facilitatorId, "Der er ingen aktiv mailændring at annullere.");
  }

  const { error: updateError } = await supabase
    .from("email_change_requests")
    .update({ cancelled_at: new Date().toISOString(), status: "cancelled" })
    .eq("id", pendingRequest.id);

  if (updateError) {
    adminFacilitatorEditRedirect(facilitatorId, "Mailændringen kunne ikke annulleres.");
  }

  const { error: authResetError } = await supabase.auth.admin.updateUserById(profileId, {
    email: pendingRequest.old_email,
    email_confirm: true,
  });

  if (authResetError) {
    console.warn("[admin-email-change] Pending auth email could not be reset after cancellation", {
      facilitatorId,
      message: authResetError.message,
    });
  }

  await supabase.from("admin_audit_log").insert({
    action: "profile_email_change_cancelled_by_admin",
    actor_profile_id: adminProfile.id,
    facilitator_id: facilitatorId,
    new_value: "email_change_cancelled",
    old_value: "email_change_pending",
  });

  revalidatePath("/admin/facilitators/" + facilitatorId + "/edit");
  adminFacilitatorEditRedirect(facilitatorId, "Mailændringen er annulleret.");
}

export async function updateFacilitatorAdminSettingsAction(formData: FormData) {
  const adminProfile = await requireRole("admin");

  const facilitatorId = getString(formData, "facilitator_id");
  const featuredSortOrder = Number(getOptionalString(formData, "featured_sort_order") ?? 0);
  const rawMaxTicketPrice = getOptionalString(formData, "max_ticket_price_per_person");
  const hasUnlimitedTicketPrice = formData.get("unlimited_ticket_price") === "on";
  const hasTicketPriceFields = formData.has("max_ticket_price_per_person") || formData.has("unlimited_ticket_price");
  const parsedMaxTicketPrice = Number(rawMaxTicketPrice);

  if (!facilitatorId) {
    adminRedirect("Arrangøren kunne ikke findes.");
  }

  if (hasTicketPriceFields && !hasUnlimitedTicketPrice && (!rawMaxTicketPrice || !/^\d+$/.test(rawMaxTicketPrice) || !Number.isSafeInteger(parsedMaxTicketPrice) || parsedMaxTicketPrice < 0)) {
    adminFacilitatorEditRedirect(facilitatorId, "Maksimal billetpris skal være et heltal på mindst 0 kr.");
  }

  const supabase = createAdminClient();
  const updatePayload: Record<string, boolean | number | null> = {
    auto_approve_events: formData.get("auto_approve_events") === "on",
    featured_sort_order: Number.isFinite(featuredSortOrder) ? featuredSortOrder : 0,
    is_active_host: formData.get("is_active_host") === "on",
    is_experienced_host: formData.get("is_experienced_host") === "on",
    is_featured: formData.get("is_featured") === "on",
  };
  if (hasTicketPriceFields) {
    updatePayload.max_ticket_price_per_person = hasUnlimitedTicketPrice ? null : parsedMaxTicketPrice;
  }

  const { error } = await supabase
    .from("facilitator_profiles")
    .update(updatePayload)
    .eq("id", facilitatorId);

  if (error) {
    adminFacilitatorEditRedirect(
      facilitatorId,
      missingColumnErrorCodes.includes(error.code ?? "")
        ? "Databasen mangler et felt til denne handling. Kør de nyeste Supabase-migrationer og prøv igen."
        : "Adminindstillingerne kunne ikke gemmes.",
    );
  }

  await supabase.from("admin_audit_log").insert({
    action: "facilitator_admin_settings_changed",
    actor_profile_id: adminProfile.id,
    facilitator_id: facilitatorId,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/featured-facilitators");
  revalidatePath("/admin/facilitators/" + facilitatorId + "/edit");
  revalidatePath("/facilitators/" + facilitatorId);
  adminFacilitatorEditRedirect(facilitatorId, "Adminindstillingerne er gemt.");
}

export async function updateAdminFacilitatorProfileAction(formData: FormData) {
  const adminProfile = await requireRole("admin");

  const facilitatorId = getString(formData, "facilitator_id");
  const profileId = getString(formData, "profile_id");
  const status = getString(formData, "status") as FacilitatorStatus;
  const fullName = getString(formData, "full_name");
  const phone = getOptionalString(formData, "phone");
  const companyName = getOptionalString(formData, "company_name");
  const shortDescription = getOptionalString(formData, "short_description") ?? "";
  const longDescription = getOptionalString(formData, "long_description") ?? "";
  const publicEmail = getOptionalString(formData, "public_email");
  const publicPhone = getOptionalString(formData, "public_phone");
  const websiteUrl = getOptionalString(formData, "website_url");
  const facebookUrl = getOptionalString(formData, "facebook_url");
  const instagramUrl = getOptionalString(formData, "instagram_url");
  const addressLine = getOptionalString(formData, "address_line");
  const postalCode = getOptionalString(formData, "postal_code");
  const city = getOptionalString(formData, "city");
  const regionId = getOptionalString(formData, "region_id");
  const isFeatured = formData.get("is_featured") === "on";
  const isActiveHost = formData.get("is_active_host") === "on";
  const isExperiencedHost = formData.get("is_experienced_host") === "on";
  const autoApproveEvents = formData.get("auto_approve_events") === "on";
  const featuredSortOrder = Number(getOptionalString(formData, "featured_sort_order") ?? 0);
  const hasUnlimitedTicketPrice = formData.get("unlimited_ticket_price") === "on";
  const rawMaxTicketPrice = getOptionalString(formData, "max_ticket_price_per_person");
  const hasTicketPriceFields = formData.has("max_ticket_price_per_person") || formData.has("unlimited_ticket_price");
  const parsedMaxTicketPrice = Number(rawMaxTicketPrice);
  const categoryIds = getAllStrings(formData, "category_ids");

  if (!facilitatorId || !profileId) {
    adminRedirect("Arrangøren kunne ikke findes.");
  }

  if (!editableStatuses.includes(status)) {
    adminFacilitatorEditRedirect(facilitatorId, "Ugyldig arrangørstatus.");
  }

  if (!fullName) {
    adminFacilitatorEditRedirect(facilitatorId, "Navn skal udfyldes.");
  }

  if (!companyName) {
    adminFacilitatorEditRedirect(facilitatorId, "Vist navn skal udfyldes.");
  }

  if (hasTicketPriceFields && !hasUnlimitedTicketPrice && (!rawMaxTicketPrice || !/^\d+$/.test(rawMaxTicketPrice) || !Number.isSafeInteger(parsedMaxTicketPrice) || parsedMaxTicketPrice < 0)) {
    adminFacilitatorEditRedirect(facilitatorId, "Maksimal billetpris skal være et heltal på mindst 0 kr.");
  }

  const supabase = createAdminClient();
  const { data: previousFacilitator, error: previousFacilitatorError } = await supabase
    .from("facilitator_profiles")
    .select("auto_approve_events")
    .eq("id", facilitatorId)
    .maybeSingle();
  const canUpdateAutoApprove = !missingColumnErrorCodes.includes(previousFacilitatorError?.code ?? "");
  const previousAutoApprove = Boolean(previousFacilitator?.auto_approve_events);

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      phone,
    })
    .eq("id", profileId);

  if (profileError) {
    adminFacilitatorEditRedirect(facilitatorId, "Brugeroplysninger kunne ikke gemmes.");
  }

  const facilitatorUpdate: Record<string, boolean | number | string | null> = {
    status,
    company_name: companyName,
    short_description: shortDescription,
    long_description: longDescription,
    public_email: publicEmail,
    public_phone: publicPhone,
    website_url: websiteUrl,
    facebook_url: facebookUrl,
    instagram_url: instagramUrl,
    address_line: addressLine,
    postal_code: postalCode,
    city,
    region_id: regionId,
    is_featured: isFeatured,
    is_active_host: isActiveHost,
    is_experienced_host: isExperiencedHost,
    featured_sort_order: Number.isFinite(featuredSortOrder) ? featuredSortOrder : 0,
  };
  if (hasTicketPriceFields) {
    facilitatorUpdate.max_ticket_price_per_person = hasUnlimitedTicketPrice ? null : parsedMaxTicketPrice;
  }

  if (canUpdateAutoApprove) {
    facilitatorUpdate.auto_approve_events = autoApproveEvents;
  }

  const { error: facilitatorError } = await supabase
    .from("facilitator_profiles")
    .update(facilitatorUpdate)
    .eq("id", facilitatorId);

  if (facilitatorError) {
    adminFacilitatorEditRedirect(
      facilitatorId,
      missingColumnErrorCodes.includes(facilitatorError.code ?? "")
        ? "Databasen mangler et felt til denne handling. Kør de nyeste Supabase-migrationer og prøv igen."
        : "Arrangørprofilen kunne ikke gemmes.",
    );
  }

  if (canUpdateAutoApprove && previousAutoApprove !== autoApproveEvents) {
    await supabase.from("admin_audit_log").insert({
      actor_profile_id: adminProfile.id,
      facilitator_id: facilitatorId,
      action: "auto_approve_events_changed",
      old_value: String(previousAutoApprove),
      new_value: String(autoApproveEvents),
    });
  }

  await supabase.from("facilitator_categories").delete().eq("facilitator_id", facilitatorId);
  if (categoryIds.length > 0) {
    const { error } = await supabase.from("facilitator_categories").insert(
      categoryIds.map((categoryId) => ({
        facilitator_id: facilitatorId,
        category_id: categoryId,
      })),
    );

    if (error) {
      adminFacilitatorEditRedirect(facilitatorId, "Arbejdsområder kunne ikke gemmes.");
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/featured-facilitators");
  revalidatePath("/facilitators");
  revalidatePath("/facilitators/" + facilitatorId);
  revalidatePath("/admin/facilitators/" + facilitatorId + "/edit");

  adminFacilitatorEditRedirect(
    facilitatorId,
    canUpdateAutoApprove
      ? "Arrangørprofilen er gemt."
      : "Arrangørprofilen er gemt. Auto-godkendelse kræver, at migration 046_admin_facilitator_overview_fields.sql køres.",
  );
}
