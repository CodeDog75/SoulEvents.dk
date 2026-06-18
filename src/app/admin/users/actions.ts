"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { getString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppRole } from "@/types/database";

function usersRedirect(message: string): never {
  redirect(`/admin/users?message=${encodeURIComponent(message)}`);
}

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

  if (!profileId || !["admin", "facilitator"].includes(role)) {
    usersRedirect("Ugyldig brugerhandling.");
  }

  if (role === "facilitator") {
    const anotherAdminExists = await ensureAnotherAdminIsLeft(profileId);

    if (!anotherAdminExists) {
      usersRedirect("Der skal altid være mindst én administrator.");
    }
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", profileId);

  if (error) {
    usersRedirect("Rollen kunne ikke opdateres.");
  }

  if (role === "facilitator") {
    await ensureFacilitatorProfileExists(profileId);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/dashboard");
  usersRedirect(role === "admin" ? "Brugeren er nu administrator." : "Brugeren er nu arrangør.");
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
