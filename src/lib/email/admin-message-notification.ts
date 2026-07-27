import { renderEmailButton, renderEmailLayout, renderPlainTextFooter } from "@/lib/email/email-layout";
import { escapeHtml, sendLoggedEmail } from "@/lib/email/resend-mail";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const notificationType = "admin_message_notification";
const notificationThrottleMinutes = 30;

type AdminMessageNotificationInput = {
  facilitatorId: string;
  firstName?: string | null;
  recipientEmail?: string | null;
  unreadCount?: number;
};

function appUrl() {
  const baseUrl = (env.appUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://www.soulevents.dk").trim().replace(/\/$/, "");

  if (baseUrl.startsWith("http://") && !baseUrl.includes("localhost") && !baseUrl.includes("127.0.0.1")) {
    return "https://" + baseUrl.slice("http://".length);
  }

  return baseUrl;
}

async function hasRecentNotification(recipientEmail: string) {
  const threshold = new Date(Date.now() - notificationThrottleMinutes * 60 * 1000).toISOString();
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("email_logs")
    .select("id", { count: "exact", head: true })
    .eq("type", notificationType)
    .eq("recipient_email", recipientEmail)
    .eq("status", "sent")
    .gte("sent_at", threshold);

  if (error) {
    console.error("Admin message notification throttle lookup failed", {
      errorCode: error.code ?? null,
      errorMessage: error.message,
      type: notificationType,
    });
    return false;
  }

  return (count ?? 0) > 0;
}

export async function sendAdminMessageNotificationEmail(input: AdminMessageNotificationInput) {
  if (!input.recipientEmail) {
    console.error("Admin message notification skipped: missing recipient", {
      facilitatorId: input.facilitatorId,
      type: notificationType,
    });
    return false;
  }

  if (await hasRecentNotification(input.recipientEmail)) {
    return true;
  }

  const greetingName = input.firstName?.trim() || "du";
  const escapedGreetingName = escapeHtml(greetingName);
  const unreadText =
    input.unreadCount && input.unreadCount > 1
      ? `Du har ${input.unreadCount} ulæste beskeder fra SoulEvents.`
      : "Du har modtaget en ny besked fra SoulEvents.";
  const messageCenterUrl = appUrl() + "/facilitator/messages";
  const html = await renderEmailLayout({
    title: "Du har modtaget en ny besked fra SoulEvents",
    children: [
      `<p style="margin: 0 0 14px;">Hej ${escapedGreetingName}</p>`,
      `<p style="margin: 0 0 14px;">${unreadText}</p>`,
      '<p style="margin: 0;">Log ind på din arrangørprofil for at læse beskeden.</p>',
      renderEmailButton(messageCenterUrl, "Læs beskeden"),
    ].join(""),
  });

  const text = [
    `Hej ${greetingName}`,
    "",
    unreadText,
    "",
    "Log ind på din arrangørprofil for at læse beskeden.",
    "",
    "Læs beskeden:",
    messageCenterUrl,
    ...renderPlainTextFooter(),
  ].join("\n");

  return sendLoggedEmail({
    type: notificationType,
    to: input.recipientEmail,
    subject: "Du har modtaget en ny besked fra SoulEvents",
    html,
    text,
  });
}
