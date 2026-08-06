import { createHash, randomBytes } from "crypto";
import { getUserFacingEventStatus } from "@/lib/events/user-facing-status";
import { publicEventPath } from "@/lib/slug";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export const activeExternalCoHostInvitationStatuses = ["pending", "accepted_pending_profile_approval"] as const;

export function normalizeInvitationEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidInvitationEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function createExternalInvitationToken() {
  return randomBytes(32).toString("base64url");
}

export function hashExternalInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function externalCoHostInvitationUrl(token: string) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.soulevents.dk").trim().replace(/\/$/, "");
  return base + "/facilitator/co-organizer-invitations/external/" + encodeURIComponent(token);
}

export function maskInvitationEmail(email?: string | null) {
  if (!email) return "";
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return email;
  return localPart.slice(0, Math.min(2, localPart.length)) + "***@" + domain;
}

export function externalInvitationLoginHref(token: string, email?: string | null) {
  const next = "/facilitator/co-organizer-invitations/external/" + encodeURIComponent(token);
  const params = new URLSearchParams({
    message: "Log ind eller opret en gratis arrangørprofil for at se invitationen.",
    next,
  });
  if (email) params.set("email", email);
  return "/auth/login?" + params.toString();
}

export function externalInvitationSignupHref(token: string, email?: string | null) {
  const next = "/facilitator/co-organizer-invitations/external/" + encodeURIComponent(token);
  const params = new URLSearchParams({
    next,
    step: "signup",
  });
  if (email) params.set("email", email);
  return "/auth/login?" + params.toString();
}

export function publicEventUrl(eventId: string, eventSlug?: string | null) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.soulevents.dk").trim().replace(/\/$/, "");
  return base + publicEventPath(eventSlug || eventId);
}

export async function findFacilitatorByEmail(supabase: AdminClient, email: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, facilitator_profiles(id, status, is_paused, is_disabled, company_name)")
    .ilike("email", normalizeInvitationEmail(email))
    .maybeSingle();

  const facilitatorProfile = Array.isArray((profile as any)?.facilitator_profiles)
    ? (profile as any).facilitator_profiles[0]
    : (profile as any)?.facilitator_profiles;

  return {
    facilitatorProfile: facilitatorProfile ?? null,
    profile: profile ?? null,
  };
}

export function isActivePublicEventForExternalInvitation(event: {
  ends_at?: string | null;
  starts_at?: string | null;
  status?: string | null;
} | null | undefined) {
  if (!event?.status) return false;
  const status = getUserFacingEventStatus({
    ends_at: event.ends_at,
    starts_at: event.starts_at,
    status: event.status,
  });
  return status === "active" || status === "sold_out";
}

export async function activateAcceptedExternalInvitationsForFacilitator(
  supabase: AdminClient,
  facilitatorId: string,
) {
  const { data: facilitator } = await supabase
    .from("facilitator_profiles")
    .select("id, profile_id, status, is_paused, is_disabled")
    .eq("id", facilitatorId)
    .maybeSingle();

  if (!facilitator || facilitator.status !== "approved" || facilitator.is_paused || facilitator.is_disabled) {
    return;
  }

  const { data: invitations } = await (supabase as any)
    .from("event_cohost_invitations")
    .select("id, event_id, inviter_profile_id, inviter_facilitator_id, status, events(id, starts_at, ends_at, status, facilitator_id)")
    .eq("invited_facilitator_id", facilitatorId)
    .eq("status", "accepted_pending_profile_approval");

  for (const invitation of invitations ?? []) {
    const event = Array.isArray(invitation.events) ? invitation.events[0] : invitation.events;
    if (!event || event.facilitator_id !== invitation.inviter_facilitator_id || !isActivePublicEventForExternalInvitation(event)) {
      continue;
    }

    const { error } = await supabase.from("event_co_organizers").insert({
      co_organizer_profile_id: facilitatorId,
      event_id: invitation.event_id,
      invited_by_user_id: invitation.inviter_profile_id,
      primary_organizer_profile_id: invitation.inviter_facilitator_id,
      responded_at: new Date().toISOString(),
      status: "accepted",
    });

    if (!error || error.code === "23505") {
      await (supabase as any)
        .from("event_cohost_invitations")
        .update({ status: "accepted" })
        .eq("id", invitation.id);
    }
  }
}
