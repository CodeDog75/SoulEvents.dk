"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { getString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";

function go(message: string): never {
  redirect("/admin/featured-facilitators?message=" + encodeURIComponent(message));
}

export async function updateFeaturedFacilitatorAction(formData: FormData) {
  await requireRole("admin");

  const facilitatorId = getString(formData, "facilitator_id");
  const isFeatured = formData.get("is_featured") === "on";
  const sortOrder = Number(getString(formData, "featured_sort_order") || "0");

  if (!facilitatorId) {
    go("Facilitator mangler ID.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("facilitator_profiles")
    .update({
      is_featured: isFeatured,
      featured_sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    })
    .eq("id", facilitatorId);

  if (error) {
    go("Fremhævelse kunne ikke gemmes. Tjek at migration 011 er kørt i Supabase.");
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/featured-facilitators");
  go("Fremhævet facilitator er opdateret.");
}
