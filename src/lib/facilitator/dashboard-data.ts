import { requireRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getFacilitatorDashboardContext() {
  const profile = await requireRole("facilitator");
  const supabase = createAdminClient();
  const { data: facilitatorProfile } = await supabase
    .from("facilitator_profiles")
    .select("id, is_paused")
    .eq("profile_id", profile.id)
    .single();

  if (!facilitatorProfile) {
    return { facilitatorProfile: null, profile, supabase };
  }

  return { facilitatorProfile, profile, supabase };
}

export async function getFacilitatorAdminMessages(facilitatorId: string, limit = 20) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("facilitator_admin_messages")
    .select("id, subject, message, type, status, created_at")
    .eq("facilitator_id", facilitatorId)
    .is("facilitator_hidden_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[facilitator-messages] Message history could not be loaded", {
      code: error.code,
      details: error.details,
      facilitatorId,
      hint: error.hint,
      message: error.message,
    });
  }

  return data ?? [];
}

export async function getFacilitatorUnreadAdminMessageCount(facilitatorId: string) {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("facilitator_admin_messages")
    .select("id", { count: "exact", head: true })
    .eq("facilitator_id", facilitatorId)
    .eq("type", "admin_reply")
    .eq("status", "unread")
    .is("facilitator_hidden_at", null);

  if (error) {
    console.error(
      "[facilitator-messages] unread-count failed",
      JSON.stringify(
        {
          code: error.code,
          details: error.details,
          facilitatorId,
          hint: error.hint,
          message: error.message,
        },
        null,
        2,
      ),
    );
  }

  return count ?? 0;
}
