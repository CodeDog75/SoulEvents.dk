"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { getString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventStatus } from "@/types/database";

const allowedStatuses: EventStatus[] = ["draft", "pending_review", "active", "rejected", "completed", "archived"];

function go(message: string): never {
  redirect("/admin/events?message=" + encodeURIComponent(message));
}

export async function updateAdminEventStatusAction(formData: FormData) {
  await requireRole("admin");

  const eventId = getString(formData, "event_id");
  const status = getString(formData, "status") as EventStatus;

  if (!eventId || !allowedStatuses.includes(status)) {
    go("Ugyldig eventhandling.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("events").update({ status }).eq("id", eventId);

  if (error) {
    go("Eventstatus kunne ikke opdateres.");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/events");
  revalidatePath("/");
  go("Eventstatus er opdateret.");
}
