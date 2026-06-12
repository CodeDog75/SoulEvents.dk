"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { getAllStrings, getOptionalString, getString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FacilitatorStatus } from "@/types/database";

const allowedStatuses: FacilitatorStatus[] = ["pending", "approved", "disabled"];

function adminRedirect(message: string): never {
  redirect(`/admin?message=${encodeURIComponent(message)}`);
}

function adminFacilitatorEditRedirect(facilitatorId: string, message: string): never {
  redirect(`/admin/facilitators/${facilitatorId}/edit?message=${encodeURIComponent(message)}`);
}


export async function updateFacilitatorStatusAction(formData: FormData) {
  await requireRole("admin");

  const facilitatorId = getString(formData, "facilitator_id");
  const status = getString(formData, "status") as FacilitatorStatus;

  if (!facilitatorId || !allowedStatuses.includes(status)) {
    adminRedirect("Ugyldig værthandling.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("facilitator_profiles")
    .update({ status })
    .eq("id", facilitatorId);

  if (error) {
    adminRedirect("Værtstatus kunne ikke opdateres.");
  }

  revalidatePath("/admin");
  revalidatePath("/facilitator");
  revalidatePath("/facilitator/profile");

  const labels: Record<FacilitatorStatus, string> = {
    pending: "sat tilbage til afventer",
    approved: "godkendt",
    disabled: "deaktiveret",
  };

  adminRedirect(`Vært er ${labels[status]}.`);
}


export async function updateAdminFacilitatorProfileAction(formData: FormData) {
  await requireRole("admin");

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
  const featuredSortOrder = Number(getOptionalString(formData, "featured_sort_order") ?? 0);
  const categoryIds = getAllStrings(formData, "category_ids");
  const tagIds = Array.from(new Set(getAllStrings(formData, "tag_ids")));

  if (!facilitatorId || !profileId) {
    adminRedirect("Værten kunne ikke findes.");
  }

  if (!allowedStatuses.includes(status)) {
    adminFacilitatorEditRedirect(facilitatorId, "Ugyldig værtstatus.");
  }

  if (!fullName) {
    adminFacilitatorEditRedirect(facilitatorId, "Navn skal udfyldes.");
  }

  if (!companyName) {
    adminFacilitatorEditRedirect(facilitatorId, "Vist navn skal udfyldes.");
  }

  if (tagIds.length < 1 || tagIds.length > 5) {
    adminFacilitatorEditRedirect(facilitatorId, "Vælg mindst ét tag og højst fem tags.");
  }

  const supabase = createAdminClient();
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

  const { error: facilitatorError } = await supabase
    .from("facilitator_profiles")
    .update({
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
      featured_sort_order: Number.isFinite(featuredSortOrder) ? featuredSortOrder : 0,
    })
    .eq("id", facilitatorId);

  if (facilitatorError) {
    adminFacilitatorEditRedirect(facilitatorId, "Værtsprofilen kunne ikke gemmes.");
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
      adminFacilitatorEditRedirect(facilitatorId, "Kategorier kunne ikke gemmes.");
    }
  }

  await supabase.from("facilitator_tags").delete().eq("facilitator_id", facilitatorId);
  if (tagIds.length > 0) {
    const { error } = await supabase.from("facilitator_tags").insert(
      tagIds.map((tagId) => ({
        facilitator_id: facilitatorId,
        tag_id: tagId,
      })),
    );

    if (error) {
      adminFacilitatorEditRedirect(facilitatorId, "Tags kunne ikke gemmes. Tjek at migration 015_facilitator_tags.sql er kørt.");
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/featured-facilitators");
  revalidatePath("/facilitators");
  revalidatePath("/facilitators/" + facilitatorId);
  revalidatePath("/admin/facilitators/" + facilitatorId + "/edit");

  adminFacilitatorEditRedirect(facilitatorId, "Værtsprofilen er gemt.");
}
