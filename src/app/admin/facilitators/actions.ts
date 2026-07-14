"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { getAllStrings, getOptionalString, getString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FacilitatorStatus } from "@/types/database";

const allowedStatuses: FacilitatorStatus[] = ["pending", "approved"];
const editableStatuses: FacilitatorStatus[] = ["pending", "approved"];
const missingColumnErrorCodes = ["42703", "PGRST204"];

function adminRedirect(message: string): never {
  redirect(`/admin?message=${encodeURIComponent(message)}`);
}

function adminMessageRedirect(message: string): never {
  redirect(`/admin/messages?message=${encodeURIComponent(message)}`);
}

function adminMessageReturnRedirect(message: string, returnTo = "/admin/messages"): never {
  const safeReturnTo = returnTo.startsWith("/admin/messages") ? returnTo : "/admin/messages";
  const separator = safeReturnTo.includes("?") ? "&" : "?";
  redirect(`${safeReturnTo}${separator}message=${encodeURIComponent(message)}`);
}

function adminFacilitatorEditRedirect(facilitatorId: string, message: string): never {
  redirect(`/admin/facilitators/${facilitatorId}/edit?message=${encodeURIComponent(message)}`);
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
  const { data: facilitator } = await supabase
    .from("facilitator_profiles")
    .select("id, profile_id")
    .eq("id", facilitatorId)
    .single();

  if (!facilitator?.profile_id) {
    adminMessageReturnRedirect("Arrangøren kunne ikke findes.", returnTo);
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
  const { data: facilitator } = await supabase
    .from("facilitator_profiles")
    .select("id, profile_id")
    .eq("id", facilitatorId)
    .single();

  if (!facilitator?.profile_id) {
    adminMessageRedirect("Arrangøren kunne ikke findes.");
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
  await requireRole("admin");

  const facilitatorId = getString(formData, "facilitator_id");
  const status = getString(formData, "status") as FacilitatorStatus;

  if (!facilitatorId || !allowedStatuses.includes(status)) {
    adminRedirect("Ugyldig arrangørhandling.");
  }

  
  if (status === "pending") {
    adminRedirect("En godkendt eller deaktiveret arrangør kan ikke sættes tilbage til afventer. Brug deaktiver, hvis profilen ikke skal være synlig.");
  }

const supabase = createAdminClient();
  const { error } = await supabase
    .from("facilitator_profiles")
    .update({ status })
    .eq("id", facilitatorId);

  if (error) {
    adminRedirect("Arrangørtatus kunne ikke opdateres.");
  }

  revalidatePath("/admin");
  revalidatePath("/facilitator");
  revalidatePath("/facilitator/profile");

  const labels: Record<FacilitatorStatus, string> = {
    pending: "sat tilbage til afventer",
    approved: "godkendt",
    disabled: "deaktiveret",
  };

  adminRedirect(`Arrangør er ${labels[status]}.`);
}

export async function disableFacilitatorAction(formData: FormData) {
  const adminProfile = await requireRole("admin");

  const facilitatorId = getString(formData, "facilitator_id");
  const reason = getOptionalString(formData, "disabled_reason");

  if (!facilitatorId) {
    adminRedirect("Ugyldig arrangørhandling.");
  }

  const supabase = createAdminClient();
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

  await supabase.from("admin_audit_log").insert({
    actor_profile_id: adminProfile.id,
    action: "facilitator_disabled",
    facilitator_id: facilitatorId,
    new_value: reason ?? "disabled",
  });

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/facilitators");
  revalidatePath("/facilitators/" + facilitatorId);
  revalidatePath("/admin/facilitators/" + facilitatorId + "/edit");
  adminRedirect("Arrangør er deaktiveret.");
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

export async function updateFacilitatorAdminSettingsAction(formData: FormData) {
  const adminProfile = await requireRole("admin");

  const facilitatorId = getString(formData, "facilitator_id");
  const featuredSortOrder = Number(getOptionalString(formData, "featured_sort_order") ?? 0);
  const rawMaxTicketPrice = getOptionalString(formData, "max_ticket_price_per_person");
  const hasUnlimitedTicketPrice = formData.get("unlimited_ticket_price") === "on";
  const parsedMaxTicketPrice = Number(rawMaxTicketPrice);

  if (!facilitatorId) {
    adminRedirect("Arrangøren kunne ikke findes.");
  }

  if (!hasUnlimitedTicketPrice && (!rawMaxTicketPrice || !/^\d+$/.test(rawMaxTicketPrice) || !Number.isSafeInteger(parsedMaxTicketPrice) || parsedMaxTicketPrice < 0)) {
    adminFacilitatorEditRedirect(facilitatorId, "Maksimal billetpris skal være et heltal på mindst 0 kr.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("facilitator_profiles")
    .update({
      auto_approve_events: formData.get("auto_approve_events") === "on",
      featured_sort_order: Number.isFinite(featuredSortOrder) ? featuredSortOrder : 0,
      is_active_host: formData.get("is_active_host") === "on",
      is_experienced_host: formData.get("is_experienced_host") === "on",
      is_featured: formData.get("is_featured") === "on",
      max_ticket_price_per_person: hasUnlimitedTicketPrice ? null : parsedMaxTicketPrice,
    })
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
  const parsedMaxTicketPrice = Number(rawMaxTicketPrice);
  const maxTicketPricePerPerson = hasUnlimitedTicketPrice ? null : parsedMaxTicketPrice;
  const categoryIds = getAllStrings(formData, "category_ids");

  if (!facilitatorId || !profileId) {
    adminRedirect("Arrangøren kunne ikke findes.");
  }

  if (!editableStatuses.includes(status)) {
    adminFacilitatorEditRedirect(facilitatorId, "Ugyldig arrangørtatus.");
  }

  if (!fullName) {
    adminFacilitatorEditRedirect(facilitatorId, "Navn skal udfyldes.");
  }

  if (!companyName) {
    adminFacilitatorEditRedirect(facilitatorId, "Vist navn skal udfyldes.");
  }

  if (!hasUnlimitedTicketPrice && (!rawMaxTicketPrice || !/^\d+$/.test(rawMaxTicketPrice) || !Number.isSafeInteger(parsedMaxTicketPrice) || parsedMaxTicketPrice < 0)) {
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
    max_ticket_price_per_person: maxTicketPricePerPerson,
  };

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
