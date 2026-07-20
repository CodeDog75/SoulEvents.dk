import { after } from "next/server";
import { getAppUrl } from "@/lib/app-url";
import { renderEmailButton, renderEmailLayout, renderEmailTable, renderPlainTextFooter } from "@/lib/email/email-layout";
import { escapeHtml, formatDate, sendLoggedEmail } from "@/lib/email/resend-mail";
import { publicFacilitatorPath } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";

const notificationType = "facilitator_profile_created_admin";
const notificationAuditAction = "facilitator_profile_created_admin_notification";
const internalAdminEmail = "hej@soulevents.dk";

type NewFacilitatorProfileAdminEmailInput = {
  city?: string | null;
  createdAt: string;
  displayName?: string | null;
  email?: string | null;
  fullName?: string | null;
  phone?: string | null;
  profileId: string;
  publicSlug?: string | null;
  status?: string | null;
};

function valueOrMissing(value: string | null | undefined) {
  return value?.trim() || "Ikke udfyldt endnu";
}

function buildUrls(input: NewFacilitatorProfileAdminEmailInput) {
  const appUrl = getAppUrl();
  return {
    adminProfileUrl: `${appUrl}/admin/facilitators/${input.profileId}/edit`,
    publicProfileUrl: input.publicSlug ? `${appUrl}${publicFacilitatorPath(input.publicSlug)}` : null,
  };
}

async function hasNotificationAlreadyBeenQueued(profileId: string) {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("admin_audit_log")
    .select("id", { count: "exact", head: true })
    .eq("facilitator_id", profileId)
    .eq("action", notificationAuditAction);

  if (error) {
    console.error("[facilitator-profile-created] Notification duplicate lookup failed", {
      errorCode: error.code ?? null,
      errorMessage: error.message,
      facilitatorId: profileId,
      type: notificationType,
    });
    return false;
  }

  return (count ?? 0) > 0;
}

async function markNotificationQueued(profileId: string) {
  const admin = createAdminClient();
  const { error } = await admin.from("admin_audit_log").insert({
    action: notificationAuditAction,
    facilitator_id: profileId,
    new_value: "internal_email_queued",
  });

  if (error) {
    console.error("[facilitator-profile-created] Notification audit insert failed", {
      errorCode: error.code ?? null,
      errorMessage: error.message,
      facilitatorId: profileId,
      type: notificationType,
    });
    return false;
  }

  return true;
}

async function sendNewFacilitatorProfileAdminEmail(input: NewFacilitatorProfileAdminEmailInput) {
  const { adminProfileUrl, publicProfileUrl } = buildUrls(input);
  const rows: Array<[string, string]> = [
    ["Navn", valueOrMissing(input.fullName)],
    ["Kaldenavn", valueOrMissing(input.displayName)],
    ["E-mail", valueOrMissing(input.email)],
    ["Telefon", valueOrMissing(input.phone)],
    ["By", valueOrMissing(input.city)],
    ["Status", valueOrMissing(input.status)],
    ["Oprettet", formatDate(input.createdAt)],
    ["Profil-ID", input.profileId],
  ];

  const publicProfileText = publicProfileUrl ?? "Offentlig profil findes ikke endnu.";
  const html = await renderEmailLayout({
    title: "🎉 Ny arrangør på SoulEvents",
    children: [
      '<p style="margin: 0 0 16px;">En ny arrangør har oprettet en profil på SoulEvents.</p>',
      renderEmailTable(rows),
      '<p style="margin: 24px 0 8px; font-weight: 700;">Direkte links:</p>',
      `<p style="margin: 0 0 10px;">• <a href="${escapeHtml(adminProfileUrl)}" style="color: #7A4EAB; font-weight: 700;">Åbn arrangøren i Admin</a><br>${escapeHtml(adminProfileUrl)}</p>`,
      publicProfileUrl
        ? `<p style="margin: 0 0 10px;">• <a href="${escapeHtml(publicProfileUrl)}" style="color: #7A4EAB; font-weight: 700;">Offentlig profil</a><br>${escapeHtml(publicProfileUrl)}</p>`
        : '<p style="margin: 0 0 10px;">• Offentlig profil<br>Offentlig profil findes ikke endnu.</p>',
      '<p style="margin: 18px 0 0;">Den nye arrangør er nu klar til onboarding eller den videre godkendelsesproces.</p>',
      renderEmailButton(adminProfileUrl, "Åbn arrangøren i Admin"),
    ].join(""),
  });

  const text = [
    "🎉 Ny arrangør på SoulEvents",
    "",
    "En ny arrangør har oprettet en profil på SoulEvents.",
    "",
    `Navn: ${valueOrMissing(input.fullName)}`,
    `Kaldenavn: ${valueOrMissing(input.displayName)}`,
    `E-mail: ${valueOrMissing(input.email)}`,
    `Telefon: ${valueOrMissing(input.phone)}`,
    `By: ${valueOrMissing(input.city)}`,
    `Status: ${valueOrMissing(input.status)}`,
    `Oprettet: ${formatDate(input.createdAt)}`,
    `Profil-ID: ${input.profileId}`,
    "",
    "Direkte links:",
    "",
    "• Åbn arrangøren i Admin",
    adminProfileUrl,
    "",
    "• Offentlig profil (hvis den findes)",
    publicProfileText,
    "",
    "Den nye arrangør er nu klar til onboarding eller den videre godkendelsesproces.",
    ...renderPlainTextFooter(),
  ].join("\n");

  return sendLoggedEmail({
    type: notificationType,
    to: internalAdminEmail,
    replyTo: input.email,
    subject: "🎉 Ny arrangør på SoulEvents",
    html,
    text,
  });
}

export function notifyInternalAdminOfNewFacilitatorProfile(input: NewFacilitatorProfileAdminEmailInput) {
  after(async () => {
    try {
      if (await hasNotificationAlreadyBeenQueued(input.profileId)) {
        return;
      }

      const marked = await markNotificationQueued(input.profileId);
      if (!marked) {
        return;
      }

      const sent = await sendNewFacilitatorProfileAdminEmail(input);
      if (!sent) {
        console.error("[facilitator-profile-created] Internal admin email failed", {
          facilitatorId: input.profileId,
          type: notificationType,
        });
      }
    } catch (error) {
      console.error("[facilitator-profile-created] Internal admin email failed unexpectedly", {
        errorMessage: error instanceof Error ? error.message : "Ukendt fejl.",
        facilitatorId: input.profileId,
        type: notificationType,
      });
    }
  });
}
