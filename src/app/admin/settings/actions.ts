"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { getString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";

function go(message: string): never {
  redirect("/admin/settings?message=" + encodeURIComponent(message));
}

function getPositiveInteger(formData: FormData, key: string, label: string) {
  const value = Number(getString(formData, key));

  if (!Number.isInteger(value) || value < 1 || value > 100) {
    go(label + " skal være et helt tal mellem 1 og 100.");
  }

  return String(value);
}

export async function updateEventLimitSettingsAction(formData: FormData) {
  await requireRole("admin");

  const maxDraftEvents = getPositiveInteger(formData, "max_draft_events_per_facilitator", "Maks. kladder");
  const maxActiveEvents = getPositiveInteger(formData, "max_active_events_per_facilitator", "Maks. aktive events");
  const supabase = createAdminClient();

  const { error } = await supabase.from("site_settings").upsert(
    [
      { key: "max_draft_events_per_facilitator", value: maxDraftEvents },
      { key: "max_active_events_per_facilitator", value: maxActiveEvents },
    ],
    { onConflict: "key" },
  );

  if (error) {
    go("Indstillingerne kunne ikke gemmes. Tjek at database-migrationen er kørt.");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  revalidatePath("/facilitator");
  revalidatePath("/facilitator/events");
  go("Eventgrænser er gemt.");
}
