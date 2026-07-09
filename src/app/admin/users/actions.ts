"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { getString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppRole, FacilitatorStatus } from "@/types/database";

function usersRedirect(message: string, returnTo = "/admin/users"): never {
  const safeReturnTo = returnTo.startsWith("/admin/users") ? returnTo : "/admin/users";
  const separator = safeReturnTo.includes("?") ? "&" : "?";
  redirect(`${safeReturnTo}${separator}message=${encodeURIComponent(message)}`);
}

const overviewBooleanFields = ["auto_approve_events", "is_active_host", "is_experienced_host", "is_featured"] as const;
const overviewStatuses: FacilitatorStatus[] = ["approved", "disabled", "pending"];
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
  await requireRole("admin");

  const facilitatorId = getString(formData, "facilitator_id");
  const field = getString(formData, "field");
  const value = getString(formData, "value");
  const returnTo = getString(formData, "return_to") || "/admin/users";

  if (!facilitatorId || !field) {
    usersRedirect("Arrangørhandlingen kunne ikke udføres.", returnTo);
  }

  const update: Record<string, boolean | number | string> = {};

  if (overviewBooleanFields.includes(field as (typeof overviewBooleanFields)[number])) {
    update[field] = value === "true";
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
  const { error } = await supabase.from("facilitator_profiles").update(update).eq("id", facilitatorId);

  if (error) {
    usersRedirect(
      missingColumnErrorCodes.includes(error.code ?? "")
        ? "Databasen mangler feltet til denne handling. Kør migration 046_admin_facilitator_overview_fields.sql og prøv igen."
        : "Arrangøren kunne ikke opdateres.",
      returnTo,
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/featured-facilitators");
  revalidatePath("/facilitators");
  revalidatePath("/facilitators/" + facilitatorId);
  usersRedirect("Arrangøren er opdateret.", returnTo);
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
    .select("id, profile_id, host_reference_id, company_name, profiles(email)")
    .eq("id", facilitatorId)
    .maybeSingle();
  const profile = Array.isArray(facilitator?.profiles) ? facilitator?.profiles[0] : facilitator?.profiles;
  const expectedConfirmation = "SLET " + (facilitator?.host_reference_id || profile?.email || "");

  if (!facilitator || facilitator.profile_id !== profileId || confirmation !== expectedConfirmation) {
    usersRedirect("Sletning blev ikke bekræftet korrekt.", returnTo);
  }

  const [{ count: bookings }, { count: reports }, { count: invoices }] = await Promise.all([
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("facilitator_id", facilitatorId),
    supabase.from("monthly_reports").select("id", { count: "exact", head: true }).eq("facilitator_id", facilitatorId),
    supabase.from("invoice_drafts").select("id", { count: "exact", head: true }).eq("facilitator_id", facilitatorId),
  ]);

  if ((bookings ?? 0) > 0 || (reports ?? 0) > 0 || (invoices ?? 0) > 0) {
    usersRedirect("Arrangøren har bookings, rapporter eller fakturadata. Brug Pause i stedet, så historikken bevares.", returnTo);
  }

  await Promise.all([
    supabase.from("facilitator_admin_messages").update({ facilitator_id: null, profile_id: null }).eq("facilitator_id", facilitatorId),
    supabase.from("admin_audit_log").update({ facilitator_id: null }).eq("facilitator_id", facilitatorId),
  ]);

  const { error } = await supabase.auth.admin.deleteUser(profileId);

  if (error) {
    usersRedirect("Arrangøren kunne ikke slettes.", returnTo);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/facilitators");
  usersRedirect("Arrangøren er slettet.", returnTo);
}
