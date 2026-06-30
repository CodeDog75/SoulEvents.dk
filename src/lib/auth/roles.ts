import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/database";

export type AuthProfile = {
  id: string;
  role: AppRole;
  full_name: string;
  email: string;
  phone: string | null;
};

async function ensureFacilitatorProfileExists(admin: ReturnType<typeof createAdminClient>, profileId: string) {
  const { data: facilitatorProfile } = await admin
    .from("facilitator_profiles")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!facilitatorProfile) {
    await admin.from("facilitator_profiles").insert({
      profile_id: profileId,
      status: "pending",
    });
  }
}

export async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const admin = createAdminClient();
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, role, full_name, email, phone")
    .eq("id", user.id)
    .maybeSingle();

  if (!existingProfile) {
    const { data: emailProfile } = user.email
      ? await admin
          .from("profiles")
          .select("id, role, full_name, email, phone")
          .eq("email", user.email)
          .maybeSingle()
      : { data: null };

    if (emailProfile) {
      if (emailProfile.role === "facilitator") {
        await ensureFacilitatorProfileExists(admin, emailProfile.id);
      }

      return emailProfile as AuthProfile;
    }

    const role = (user.user_metadata?.role === "admin" ? "admin" : "facilitator") satisfies AppRole;
    const { data: repairedProfile, error: repairError } = await admin
      .from("profiles")
      .insert({
        id: user.id,
        role,
        full_name: user.user_metadata?.full_name || user.email || "Bruger",
        email: user.email || "",
        phone: null,
      })
      .select("id, role, full_name, email, phone")
      .single();

    if (repairError || !repairedProfile) {
      return null;
    }

    if (role === "facilitator") {
      await ensureFacilitatorProfileExists(admin, user.id);
    }

    return repairedProfile as AuthProfile;
  }

  if (existingProfile.role === "facilitator") {
    await ensureFacilitatorProfileExists(admin, user.id);
  }

  return existingProfile as AuthProfile;
}

export async function requireProfile() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/auth/login");
  }

  return profile;
}

export async function requireRole(role: AppRole) {
  const profile = await requireProfile();

  if (profile.role !== role) {
    redirect("/dashboard");
  }

  return profile;
}

export function getDashboardPath(role: AppRole) {
  return role === "admin" ? "/admin" : "/facilitator";
}
