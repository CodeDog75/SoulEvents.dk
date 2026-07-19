import { createAdminClient } from "@/lib/supabase/admin";

type EmailChangeSyncResult = {
  message: string;
  status: "error" | "success";
};

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function shortProfileId(value: string) {
  return value.slice(0, 8);
}

async function revertAuthEmail(input: { profileId: string; email: string; reason: string }) {
  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(input.profileId, {
      email: input.email,
      email_confirm: true,
    });

    if (error) {
      console.error("[email-change] Auth email revert failed", {
        message: error.message,
        profileRef: shortProfileId(input.profileId),
        reason: input.reason,
      });
    }
  } catch (error) {
    console.error("[email-change] Auth email revert failed unexpectedly", {
      message: error instanceof Error ? error.message : "Ukendt fejl.",
      profileRef: shortProfileId(input.profileId),
      reason: input.reason,
    });
  }
}

export async function syncConfirmedEmailChange(user: { email?: string | null; id: string }): Promise<EmailChangeSyncResult> {
  const confirmedEmail = normalizeEmail(user.email);

  if (!confirmedEmail) {
    return {
      message: "Mailændringen kunne ikke gennemføres, fordi den nye mailadresse mangler.",
      status: "error",
    };
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    console.error("[email-change] Profile lookup failed after confirmation", {
      message: profileError?.message ?? "Profilen blev ikke fundet.",
      profileRef: shortProfileId(user.id),
    });
    return {
      message: "Mailændringen kunne ikke kobles til din SoulEvents-konto.",
      status: "error",
    };
  }

  const currentProfileEmail = normalizeEmail(profile.email);

  if (currentProfileEmail === confirmedEmail) {
    return {
      message: "Din mailadresse er allerede opdateret.",
      status: "success",
    };
  }

  const { data: pendingRequest, error: pendingError } = await admin
    .from("email_change_requests")
    .select("id, facilitator_id, old_email, new_email, requested_by_profile_id, requested_by_role, expires_at, status")
    .eq("profile_id", user.id)
    .eq("status", "pending")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingError) {
    console.error("[email-change] Pending request lookup failed", {
      message: pendingError.message,
      profileRef: shortProfileId(user.id),
    });
    await revertAuthEmail({ email: profile.email, profileId: user.id, reason: "pending_lookup_failed" });
    return {
      message: "Mailændringen kunne ikke bekræftes. Din gamle mailadresse er stadig den gyldige kontaktmail.",
      status: "error",
    };
  }

  if (!pendingRequest) {
    console.warn("[email-change] Confirmed auth email without a pending app request", {
      profileRef: shortProfileId(user.id),
    });
    await revertAuthEmail({ email: profile.email, profileId: user.id, reason: "missing_pending_request" });
    return {
      message: "Mailændringen er ikke længere aktiv. Din gamle mailadresse er stadig den gyldige kontaktmail.",
      status: "error",
    };
  }

  const pendingNewEmail = normalizeEmail(pendingRequest.new_email);
  if (pendingNewEmail !== confirmedEmail) {
    console.warn("[email-change] Confirmed email did not match pending request", {
      profileRef: shortProfileId(user.id),
      requestId: pendingRequest.id,
    });
    await revertAuthEmail({ email: profile.email, profileId: user.id, reason: "pending_email_mismatch" });
    return {
      message: "Mailændringen matcher ikke den aktive anmodning. Din gamle mailadresse er stadig den gyldige kontaktmail.",
      status: "error",
    };
  }

  if (new Date(pendingRequest.expires_at).getTime() < Date.now()) {
    await admin
      .from("email_change_requests")
      .update({ status: "expired" })
      .eq("id", pendingRequest.id);
    await revertAuthEmail({ email: profile.email, profileId: user.id, reason: "pending_expired" });
    return {
      message: "Bekræftelseslinket er udløbet. Din gamle mailadresse er stadig aktiv.",
      status: "error",
    };
  }

  const { data: duplicateProfile, error: duplicateError } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", confirmedEmail)
    .neq("id", user.id)
    .maybeSingle();

  if (duplicateError) {
    console.error("[email-change] Duplicate email lookup failed", {
      message: duplicateError.message,
      profileRef: shortProfileId(user.id),
    });
    await revertAuthEmail({ email: profile.email, profileId: user.id, reason: "duplicate_lookup_failed" });
    return {
      message: "Mailændringen kunne ikke gennemføres sikkert. Prøv igen senere.",
      status: "error",
    };
  }

  if (duplicateProfile) {
    await revertAuthEmail({ email: profile.email, profileId: user.id, reason: "duplicate_profile_email" });
    return {
      message: "Mailadressen bruges allerede af en anden SoulEvents-konto.",
      status: "error",
    };
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({ email: confirmedEmail })
    .eq("id", user.id);

  if (updateError) {
    console.error("[email-change] Profile email update failed", {
      message: updateError.message,
      profileRef: shortProfileId(user.id),
      requestId: pendingRequest.id,
    });
    await revertAuthEmail({ email: profile.email, profileId: user.id, reason: "profile_update_failed" });
    return {
      message: "Mailændringen kunne ikke gemmes i SoulEvents. Din gamle mailadresse er stadig aktiv.",
      status: "error",
    };
  }

  await admin
    .from("email_change_requests")
    .update({ confirmed_at: new Date().toISOString(), status: "completed" })
    .eq("id", pendingRequest.id);

  await admin.from("admin_audit_log").insert({
    action: "profile_email_changed",
    actor_profile_id: pendingRequest.requested_by_profile_id,
    facilitator_id: pendingRequest.facilitator_id,
    new_value: "email_change_completed",
    old_value: "email_change_pending",
    reason: pendingRequest.requested_by_role === "admin" ? "Admin-startet mailændring bekræftet" : "Arrangør bekræftede mailændring",
  });

  return {
    message: "Din mailadresse er opdateret.",
    status: "success",
  };
}
