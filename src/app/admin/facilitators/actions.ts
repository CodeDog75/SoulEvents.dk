"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { getString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FacilitatorStatus } from "@/types/database";

const allowedStatuses: FacilitatorStatus[] = ["pending", "approved", "disabled"];

function adminRedirect(message: string): never {
  redirect(`/admin?message=${encodeURIComponent(message)}`);
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
