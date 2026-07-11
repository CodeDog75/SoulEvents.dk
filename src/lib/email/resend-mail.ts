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

type UnknownMailError = {
  code?: unknown;
  message?: unknown;
  name?: unknown;
  stack?: unknown;
  status?: unknown;
  statusCode?: unknown;
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
      errorCode: "missing_resend_environment",
      errorMessage: "Resend miljøvariabler mangler.",
      errorStack: null,
      hasResendApiKey: Boolean(env.resendApiKey),
      hasResendFromEmail: Boolean(env.resendFromEmail),
      httpStatus: null,
      recipientEmail: input.to,
      resendCalled: false,
      resendResponse: null,
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
        errorCode: result.error.name ?? null,
        errorMessage: result.error.message,
        errorStack: null,
        httpStatus: result.error.statusCode ?? null,
        recipientEmail: input.to,
        resendCalled: true,
        resendResponse: {
          data: result.data ?? null,
          error: result.error,
          headers: result.headers ?? null,
        },
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
    const mailError = error as UnknownMailError;
    console.error("Mail delivery failed: unexpected exception", {
      bookingId: input.bookingId ?? null,
      eventId: input.eventId ?? null,
      errorCode: typeof mailError.code === "string" ? mailError.code : null,
      errorMessage: error instanceof Error ? error.message : "Ukendt mailfejl.",
      errorName: error instanceof Error ? error.name : typeof mailError.name === "string" ? mailError.name : null,
      errorStack: error instanceof Error ? error.stack : typeof mailError.stack === "string" ? mailError.stack : null,
      fullException: error,
      httpStatus:
        typeof mailError.statusCode === "number"
          ? mailError.statusCode
          : typeof mailError.status === "number"
            ? mailError.status
            : null,
      recipientEmail: input.to,
      resendCalled: true,
      resendResponse: null,
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
