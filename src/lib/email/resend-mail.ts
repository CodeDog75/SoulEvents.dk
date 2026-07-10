import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { createResendClient } from "@/lib/resend";

type SendLoggedEmailInput = {
  type: string;
  to: string | null;
  replyTo?: string | null;
  subject: string;
  html: string;
  text: string;
  bookingId?: string | null;
  eventId?: string | null;
};

export function formatMoney(cents: number) {
  return `${new Intl.NumberFormat("da-DK").format(cents / 100)} kr.`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function logEmail(input: {
  type: string;
  bookingId?: string | null;
  eventId?: string | null;
  recipientEmail: string;
  subject: string;
  status: "queued" | "sent" | "failed";
  resendMessageId?: string | null;
  errorMessage?: string | null;
  sentAt?: string | null;
}) {
  if (!env.supabaseServiceRoleKey) {
    return;
  }

  const admin = createAdminClient();
  await admin.from("email_logs").insert({
    type: input.type,
    recipient_email: input.recipientEmail,
    subject: input.subject,
    status: input.status,
    resend_message_id: input.resendMessageId ?? null,
    booking_id: input.bookingId ?? null,
    event_id: input.eventId ?? null,
    error_message: input.errorMessage ?? null,
    sent_at: input.sentAt ?? null,
  });
}

export async function sendLoggedEmail(input: SendLoggedEmailInput) {
  if (!input.to) {
    console.error("Mail delivery skipped: missing recipient", {
      bookingId: input.bookingId ?? null,
      eventId: input.eventId ?? null,
      subject: input.subject,
      type: input.type,
    });
    return false;
  }

  if (!env.resendApiKey || !env.resendFromEmail) {
    console.error("Mail delivery failed: missing Resend environment variables", {
      bookingId: input.bookingId ?? null,
      eventId: input.eventId ?? null,
      hasResendApiKey: Boolean(env.resendApiKey),
      hasResendFromEmail: Boolean(env.resendFromEmail),
      recipientEmail: input.to,
      subject: input.subject,
      type: input.type,
    });
    await logEmail({
      type: input.type,
      bookingId: input.bookingId,
      eventId: input.eventId,
      recipientEmail: input.to,
      subject: input.subject,
      status: "failed",
      errorMessage: "Resend miljøvariabler mangler.",
    });
    return false;
  }

  try {
    const resend = createResendClient();
    const result = await resend.emails.send({
      from: env.resendFromEmail,
      to: input.to,
      replyTo: input.replyTo || undefined,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    if (result.error) {
      console.error("Mail delivery failed: Resend returned an error", {
        bookingId: input.bookingId ?? null,
        eventId: input.eventId ?? null,
        error: result.error.message,
        recipientEmail: input.to,
        subject: input.subject,
        type: input.type,
      });
      await logEmail({
        type: input.type,
        bookingId: input.bookingId,
        eventId: input.eventId,
        recipientEmail: input.to,
        subject: input.subject,
        status: "failed",
        errorMessage: result.error.message,
      });
      return false;
    }

    await logEmail({
      type: input.type,
      bookingId: input.bookingId,
      eventId: input.eventId,
      recipientEmail: input.to,
      subject: input.subject,
      status: "sent",
      resendMessageId: result.data?.id ?? null,
      sentAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error("Mail delivery failed: unexpected exception", {
      bookingId: input.bookingId ?? null,
      eventId: input.eventId ?? null,
      error: error instanceof Error ? error.message : "Ukendt mailfejl.",
      recipientEmail: input.to,
      subject: input.subject,
      type: input.type,
    });
    await logEmail({
      type: input.type,
      bookingId: input.bookingId,
      eventId: input.eventId,
      recipientEmail: input.to,
      subject: input.subject,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Ukendt mailfejl.",
    });
    return false;
  }
}
