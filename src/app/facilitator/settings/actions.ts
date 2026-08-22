"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateFacilitatorNewsletterPreferenceAction(formData: FormData) {
  const profile = await requireProfile();
  if (profile.role !== "facilitator") {
    redirect("/dashboard");
  }

  const wantsNewsletter = formData.get("newsletter_subscribed") === "on";
  const supabase = createAdminClient();
  const { data: facilitator } = await supabase
    .from("facilitator_profiles")
    .select("id, profile_id")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!facilitator?.id) {
    redirect("/facilitator/settings?message=" + encodeURIComponent("Arrangørprofilen blev ikke fundet."));
  }

  const now = new Date().toISOString();
  await supabase.from("facilitator_newsletter_preferences").upsert({
    consent_source: wantsNewsletter ? "account_settings" : null,
    consented_at: wantsNewsletter ? now : null,
    facilitator_id: facilitator.id,
    profile_id: profile.id,
    status: wantsNewsletter ? "subscribed" : "unsubscribed",
    unsubscribe_source: wantsNewsletter ? null : "account_settings",
    unsubscribed_at: wantsNewsletter ? null : now,
  }, { onConflict: "profile_id" });
  await supabase.from("facilitator_newsletter_consent_events").insert({
    action: wantsNewsletter ? "subscribed" : "unsubscribed",
    actor_profile_id: profile.id,
    facilitator_id: facilitator.id,
    profile_id: profile.id,
    source: "account_settings",
  });

  revalidatePath("/facilitator/settings");
  redirect("/facilitator/settings?message=" + encodeURIComponent(wantsNewsletter ? "Du er tilmeldt nyhedsmails." : "Du er afmeldt nyhedsmails."));
}
