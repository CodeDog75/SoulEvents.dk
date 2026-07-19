"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { sendFacilitatorProfileDeactivatedEmail } from "@/lib/email/facilitator-profile-deactivated";
import { getOptionalString, getString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppRole, FacilitatorStatus } from "@/types/database";

function adminUsersReturnPath(returnTo = "/admin/users", options?: { clearSearch?: boolean }) {
  const safeReturnTo = returnTo.startsWith("/admin/users") ? returnTo : "/admin/users";
  if (!options?.clearSearch) return safeReturnTo;

  const [path, query] = safeReturnTo.split("?");
  const searchParams = new URLSearchParams(query ?? "");
  searchParams.delete("q");
  searchParams.delete("type");
  searchParams.delete("page");
  searchParams.delete("event_page");
  const nextQuery = searchParams.toString();
  return path + (nextQuery ? "?" + nextQuery : "");
}

function usersRedirect(message: string, returnTo = "/admin/users", options?: { clearSearch?: boolean }): never {
  const safeReturnTo = adminUsersReturnPath(returnTo, options);
  const separator = safeReturnTo.includes("?") ? "&" : "?";
  redirect(`${safeReturnTo}${separator}message=${encodeURIComponent(message)}`);
}

function usersRedirectWithParams(message: string, returnTo: string, params: Record<string, string>, options?: { clearSearch?: boolean }): never {
  const safeReturnTo = adminUsersReturnPath(returnTo, options);
  const [path, query] = safeReturnTo.split("?");
  const searchParams = new URLSearchParams(query ?? "");
  searchParams.set("message", message);

  for (const [key, value] of Object.entries(params)) {
    searchParams.set(key, value);
  }

  redirect(`${path}?${searchParams.toString()}`);
}

const overviewBooleanFields = ["auto_approve_events", "is_active_host", "is_experienced_host", "is_featured"] as const;
const overviewVisibilityFields = ["is_disabled", "is_paused"] as const;
const overviewStatuses: FacilitatorStatus[] = ["approved", "pending"];
const missingColumnErrorCodes = ["42703", "PGRST204"];

async function ensureAnotherAdminIsLeft(profileId: string) {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .neq("id", profileId);

  return (count ?? 0) > 0;
}

async function ensureFacilitatorProfileExists(profileId: string) {
  const supabase = createAdminClient();
  const { data: facilitatorProfile } = await supabase
    .from("facilitator_profiles")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!facilitatorProfile) {
    await supabase.from("facilitator_profiles").insert({
      profile_id: profileId,
      status: "pending",
    });
  }
}

export async function updateUserRoleAction(formData: FormData) {
  await requireRole("admin");

  const profileId = getString(formData, "profile_id");
  const role = getString(formData, "role") as AppRole;
  const returnTo = getString(formData, "return_to") || "/admin/users";

  if (!profileId || !["admin", "facilitator"].includes(role)) {
    usersRedirect("Ugyldig brugerhandling.", returnTo);
  }

  if (role === "facilitator") {
    const anotherAdminExists = await ensureAnotherAdminIsLeft(profileId);

    if (!anotherAdminExists) {
      usersRedirect("Der skal altid være mindst én administrator.", returnTo);
    }
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", profileId);

  if (error) {
    usersRedirect("Rollen kunne ikke opdateres.", returnTo);
  }

  if (role === "facilitator") {
    await ensureFacilitatorProfileExists(profileId);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/dashboard");
  usersRedirect(role === "admin" ? "Brugeren er nu administrator." : "Adminadgangen er fjernet.", returnTo);
}

export async function transferAdminByEmailAction(formData: FormData) {
  const currentAdmin = await requireRole("admin");
  const email = getString(formData, "email").toLowerCase();
  const makeCurrentFacilitator = getString(formData, "make_current_facilitator") === "on";

  if (!email) {
    usersRedirect("Skriv e-mailen på den bruger, der skal være administrator.");
  }

  const supabase = createAdminClient();
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("id, email")
    .ilike("email", email)
    .maybeSingle();

  if (!targetProfile) {
    usersRedirect("Brugeren findes ikke endnu. Opret kontoen først, og prøv igen.");
  }

  const { error: targetError } = await supabase.from("profiles").update({ role: "admin" }).eq("id", targetProfile.id);

  if (targetError) {
    usersRedirect("Adminadgangen kunne ikke tilføjes.");
  }

  if (makeCurrentFacilitator && targetProfile.id !== currentAdmin.id) {
    const { error: currentError } = await supabase
      .from("profiles")
      .update({ role: "facilitator" })
      .eq("id", currentAdmin.id);

    if (currentError) {
      usersRedirect("Ny administrator er aktiveret, men din adminrolle kunne ikke fjernes.");
    }

    await ensureFacilitatorProfileExists(currentAdmin.id);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/dashboard");
  redirect("/dashboard?message=Adminadgangen er tilføjet.");
}

export async function updateFacilitatorOverviewAction(formData: FormData) {
  const adminProfile = await requireRole("admin");

  const facilitatorId = getString(formData, "facilitator_id");
  const field = getString(formData, "field");
  const value = getString(formData, "value");
  const returnTo = getString(formData, "return_to") || "/admin/users";
  const disabledReason = getOptionalString(formData, "disabled_reason");
  const disabledReasonDetail = getOptionalString(formData, "disabled_reason_detail");
  const disabledAdminMessage = getOptionalString(formData, "disabled_admin_message")?.trim() ?? "";

  if (!facilitatorId || !field) {
    usersRedirect("Arrangørhandlingen kunne ikke udføres.", returnTo);
  }

  if (disabledAdminMessage.length > 500) {
    usersRedirect("Beskeden til arrangøren må højst være 500 tegn.", returnTo);
  }

  const update: Record<string, boolean | number | string | null> = {};

  if (overviewBooleanFields.includes(field as (typeof overviewBooleanFields)[number])) {
    update[field] = value === "true";
  } else if (field === "is_disabled") {
    update.is_disabled = value === "true";
    if (value === "true") {
      const reason = [disabledReason, disabledReasonDetail].filter(Boolean).join(": ");

      if (!reason) {
        usersRedirect("Vælg eller skriv en årsag, før arrangøren deaktiveres.", returnTo);
      }

      update.disabled_at = new Date().toISOString();
      update.disabled_by = adminProfile.id;
      update.disabled_reason = reason;
    } else {
      update.disabled_at = null;
      update.disabled_by = null;
      update.disabled_reason = null;
    }
  } else if (field === "is_paused") {
    const { data: facilitator, error: facilitatorError } = await createAdminClient()
      .from("facilitator_profiles")
      .select("id, is_disabled")
      .eq("id", facilitatorId)
      .maybeSingle();

    if (facilitatorError || !facilitator) {
      usersRedirect("Arrangøren kunne ikke findes.", returnTo);
    }

    if (facilitator.is_disabled) {
      usersRedirect("En deaktiveret arrangør skal genaktiveres, før pause kan ændres.", returnTo);
    }

    update.is_paused = value === "true";
  } else if (field === "featured_sort_order") {
    const sortOrder = Number(value);
    update.featured_sort_order = Number.isFinite(sortOrder) ? sortOrder : 0;
  } else if (field === "status" && overviewStatuses.includes(value as FacilitatorStatus)) {
    if (value === "pending") {
      usersRedirect("En arrangør kan ikke sættes tilbage til afventer fra oversigten.", returnTo);
    }
    update.status = value;
  } else {
    usersRedirect("Ugyldig arrangørhandling.", returnTo);
  }

  const supabase = createAdminClient();
  const facilitatorForDeactivation =
    field === "is_disabled" && value === "true"
      ? await supabase
          .from("facilitator_profiles")
          .select(
            "id, status, is_disabled, company_name, profiles!facilitator_profiles_profile_id_fkey(email, full_name)",
          )
          .eq("id", facilitatorId)
          .maybeSingle()
      : null;
  if (facilitatorForDeactivation?.error) {
    console.error("Facilitator deactivation recipient lookup failed", {
      errorCode: facilitatorForDeactivation.error.code ?? null,
      errorMessage: facilitatorForDeactivation.error.message,
      facilitatorId,
      type: "facilitator_profile_deactivated",
    });
  }
  const { error } = await supabase.from("facilitator_profiles").update(update).eq("id", facilitatorId);

  if (error) {
    const migrationName =
      overviewVisibilityFields.includes(field as (typeof overviewVisibilityFields)[number])
        ? "061_facilitator_pause_and_admin_disable.sql"
        : "046_admin_facilitator_overview_fields.sql";

    usersRedirect(
      missingColumnErrorCodes.includes(error.code ?? "")
        ? "Databasen mangler feltet til denne handling. Kør migration " + migrationName + " og prøv igen."
        : "Arrangøren kunne ikke opdateres.",
      returnTo,
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/featured-facilitators");
  revalidatePath("/facilitators");
  revalidatePath("/facilitators/" + facilitatorId);

  let deactivationEmailSent: boolean | null = null;
  const deactivationReason = [disabledReason, disabledReasonDetail].filter(Boolean).join(": ");
  if (field === "is_disabled" && value === "true") {
    const profile = Array.isArray(facilitatorForDeactivation?.data?.profiles)
      ? facilitatorForDeactivation?.data?.profiles[0]
      : facilitatorForDeactivation?.data?.profiles;
    const facilitatorName =
      facilitatorForDeactivation?.data?.company_name ||
      profile?.full_name ||
      "arrangør";
    const notificationSent = await sendFacilitatorProfileDeactivatedEmail({
      adminMessage: disabledAdminMessage,
      facilitatorEmail: profile?.email ?? null,
      facilitatorName,
      reason: deactivationReason,
      variant: facilitatorForDeactivation?.data?.status === "approved" ? "active_deactivated" : "pending_not_approved",
    });
    deactivationEmailSent = notificationSent;

    if (!notificationSent) {
      console.error("Facilitator deactivation email failed after status update", {
        facilitatorId,
        recipientFound: Boolean(profile?.email),
        type: "facilitator_profile_deactivated",
      });
    }
  }

  if (field === "is_disabled") {
    await supabase.from("admin_audit_log").insert({
      actor_profile_id: adminProfile.id,
      action: value === "true" ? "facilitator_disabled_from_overview" : "facilitator_reactivated_from_overview",
      facilitator_id: facilitatorId,
      old_value:
        value === "true"
          ? JSON.stringify({
              isDisabled: facilitatorForDeactivation?.data?.is_disabled ?? null,
              status: facilitatorForDeactivation?.data?.status ?? null,
            })
          : null,
      new_value:
        value === "true"
          ? JSON.stringify({
              adminMessage: disabledAdminMessage || null,
              emailError: deactivationEmailSent === false ? "email_delivery_failed" : null,
              emailSent: deactivationEmailSent,
              isDisabled: true,
              reason: deactivationReason,
              status: facilitatorForDeactivation?.data?.status ?? null,
            })
          : "enabled",
      reason: value === "true" ? deactivationReason : null,
    });
  }

  if (field === "is_paused" && value === "true") {
    usersRedirectWithParams("Arrangøren er sat på pause.", returnTo, { paused_facilitator: facilitatorId }, { clearSearch: true });
  }

  if (field === "is_disabled") {
    usersRedirect(
      value === "true"
        ? deactivationEmailSent === false
          ? "Arrangøren blev deaktiveret, men e-mailen kunne ikke sendes."
          : "Arrangøren er deaktiveret."
        : "Arrangøren er genaktiveret.",
      returnTo,
      { clearSearch: true },
    );
  }

  usersRedirect(field === "is_paused" ? (value === "true" ? "Arrangøren er sat på pause." : "Arrangørprofilen er genåbnet.") : "Arrangøren er opdateret.", returnTo, { clearSearch: true });
}

export async function deleteFacilitatorFromOverviewAction(formData: FormData) {
  await requireRole("admin");

  const facilitatorId = getString(formData, "facilitator_id");
  const profileId = getString(formData, "profile_id");
  const confirmation = getString(formData, "confirmation");
  const returnTo = getString(formData, "return_to") || "/admin/users";

  if (!facilitatorId || !profileId) {
    usersRedirect("Arrangøren kunne ikke findes.", returnTo);
  }

  const supabase = createAdminClient();
  const { data: facilitator } = await supabase
    .from("facilitator_profiles")
    .select("id, profile_id, host_reference_id, company_name, profiles!facilitator_profiles_profile_id_fkey(email)")
    .eq("id", facilitatorId)
    .maybeSingle();
  const profile = Array.isArray(facilitator?.profiles) ? facilitator?.profiles[0] : facilitator?.profiles;
  const expectedConfirmation = "SLET " + (facilitator?.host_reference_id || profile?.email || "");

  if (!facilitator || facilitator.profile_id !== profileId || confirmation !== expectedConfirmation) {
    usersRedirect("Sletning blev ikke bekræftet korrekt.", returnTo);
  }

  const [
    { count: nonDraftEvents },
    { count: bookings },
    { count: reports },
    { count: invoices },
    { count: notificationLogs },
    { count: adminMessages },
    { count: auditLogs },
    { count: legalAcceptances },
  ] = await Promise.all([
    supabase.from("events").select("id", { count: "exact", head: true }).eq("facilitator_id", facilitatorId).neq("status", "draft"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("facilitator_id", facilitatorId),
    supabase.from("monthly_reports").select("id", { count: "exact", head: true }).eq("facilitator_id", facilitatorId),
    supabase.from("invoice_drafts").select("id", { count: "exact", head: true }).eq("facilitator_id", facilitatorId),
    supabase.from("event_update_notification_logs").select("id", { count: "exact", head: true }).eq("facilitator_id", facilitatorId),
    supabase.from("facilitator_admin_messages").select("id", { count: "exact", head: true }).or(`facilitator_id.eq.${facilitatorId},profile_id.eq.${profileId}`),
    supabase.from("admin_audit_log").select("id", { count: "exact", head: true }).eq("facilitator_id", facilitatorId),
    supabase.from("legal_document_acceptances").select("id", { count: "exact", head: true }).eq("profile_id", profileId),
  ]);
  const deleteBlockers = [
    (nonDraftEvents ?? 0) > 0 ? `${nonDraftEvents} ${nonDraftEvents === 1 ? "event" : "events"}` : null,
    (bookings ?? 0) > 0 ? `${bookings} ${bookings === 1 ? "tilmelding" : "tilmeldinger"}` : null,
    (reports ?? 0) > 0 ? `${reports} ${reports === 1 ? "månedsrapport" : "månedsrapporter"}` : null,
    (invoices ?? 0) > 0 ? `${invoices} ${invoices === 1 ? "fakturakladde" : "fakturakladder"}` : null,
    (notificationLogs ?? 0) > 0 ? `${notificationLogs} ${notificationLogs === 1 ? "eventbesked-log" : "eventbesked-logs"}` : null,
    (adminMessages ?? 0) > 0 ? `${adminMessages} ${adminMessages === 1 ? "besked" : "beskeder"}` : null,
    (auditLogs ?? 0) > 0 ? `${auditLogs} auditspor` : null,
    (legalAcceptances ?? 0) > 0 ? `${legalAcceptances} ${legalAcceptances === 1 ? "juridisk accept" : "juridiske accepter"}` : null,
  ].filter(Boolean);

  if (
    (nonDraftEvents ?? 0) > 0 ||
    (bookings ?? 0) > 0 ||
    (reports ?? 0) > 0 ||
    (invoices ?? 0) > 0 ||
    (notificationLogs ?? 0) > 0 ||
    (adminMessages ?? 0) > 0 ||
    (auditLogs ?? 0) > 0 ||
    (legalAcceptances ?? 0) > 0
  ) {
    usersRedirect(
      "Arrangøren kan ikke slettes permanent, fordi der findes historik, som skal bevares: " +
        deleteBlockers.join(", ") +
        ". Du kan stadig deaktivere arrangøren.",
      returnTo,
    );
  }

  const { error } = await supabase.auth.admin.deleteUser(profileId);

  if (error) {
    usersRedirect("Arrangøren kunne ikke slettes.", returnTo);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/facilitators");
  usersRedirect("Arrangøren er slettet.", returnTo, { clearSearch: true });
}
