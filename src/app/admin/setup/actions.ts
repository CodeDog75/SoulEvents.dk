"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export async function claimFirstAdminAction() {
  const profile = await requireProfile();
  const supabase = createAdminClient();

  const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");

  if ((count ?? 0) > 0 && profile.role !== "admin") {
    redirect("/dashboard");
  }

  const { error } = await supabase.from("profiles").update({ role: "admin" }).eq("id", profile.id);

  if (error) {
    redirect("/admin/setup?message=Adminadgang kunne ikke aktiveres.");
  }

  revalidatePath("/", "layout");
  redirect("/admin?message=Adminadgang er aktiveret.");
}
