import { redirect } from "next/navigation";
import {
  disabledFacilitatorLoginMessage,
  ensureAppProfileForAuthUser,
  type AppProfile,
} from "@/lib/auth/post-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/database";

export type AuthProfile = AppProfile;

export async function getCurrentProfile() {
  const supabase = await createClient();
  let user;
  try {
    const result = await supabase.auth.getUser();
    if (result.error) {
      console.warn("Supabase auth session is invalid", {
        message: result.error.message,
      });
      return null;
    }
    user = result.data.user;
  } catch (error) {
    console.warn("Supabase auth session could not be refreshed", {
      message: error instanceof Error ? error.message : "Unknown auth error",
    });
    return null;
  }

  if (!user) {
    return null;
  }

  try {
    const { profile } = await ensureAppProfileForAuthUser(user);
    return profile;
  } catch (error) {
    console.warn("App profile could not be prepared", {
      message: error instanceof Error ? error.message : "Unknown profile error",
    });
    return null;
  }
}

export async function requireProfile() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/auth/login");
  }

  if (profile.role === "facilitator") {
    const admin = createAdminClient();
    const { data: facilitator } = await admin
      .from("facilitator_profiles")
      .select("is_disabled")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (facilitator?.is_disabled) {
      const supabase = await createClient();
      await supabase.auth.signOut();
      redirect("/auth/login?message=" + encodeURIComponent(disabledFacilitatorLoginMessage));
    }
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
