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

const resendSendTimeoutMs = 15000;

function sanitizeMailErrorMessage(message: string | null | undefined) {
  return (message || "Ukendt mailfejl.").replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]").slice(0, 240);
}

function mailLogContext(input: SendLoggedEmailInput, details?: { errorCode?: string | null; errorMessage?: string | null; httpStatus?: number | null }) {
  return {
    bookingId: input.bookingId ?? null,
    eventId: input.eventId ?? null,
    errorCode: details?.errorCode ?? null,
    errorMessage: sanitizeMailErrorMessage(details?.errorMessage),
    httpStatus: details?.httpStatus ?? null,
    type: input.type,
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeout: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

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

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("email_logs").insert({
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

    if (error) {
      console.error("Mail log insert failed", {
        eventId: input.eventId ?? null,
        message: error.message,
        status: input.status,
        type: input.type,
      });
    }
  } catch (error) {
    console.error("Mail log insert failed unexpectedly", {
      eventId: input.eventId ?? null,
      message: error instanceof Error ? error.message : "Ukendt fejl.",
      status: input.status,
      type: input.type,
    });
  }
}

export async function sendLoggedEmail(input: SendLoggedEmailInput) {
  if (!input.to) {
    console.error("Mail delivery skipped: missing recipient", mailLogContext(input, { errorCode: "missing_recipient", errorMessage: "Modtager mangler." }));
    return false;
  }

  if (!env.resendApiKey || !env.resendFromEmail) {
    console.error("Mail delivery failed: missing Resend environment variables", mailLogContext(input, {
      errorCode: "missing_resend_environment",
      errorMessage: "Resend miljøvariabler mangler.",
      httpStatus: null,
    }));
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
    const result = await withTimeout(
      resend.emails.send({
        from: env.resendFromEmail,
        to: input.to,
        replyTo: input.replyTo || env.replyToEmail || undefined,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      resendSendTimeoutMs,
      "Resend-kaldet tog for lang tid.",
    );

    if (result.error) {
      console.error("Mail delivery failed: Resend returned an error", mailLogContext(input, {
        errorCode: result.error.name ?? null,
        errorMessage: result.error.message,
        httpStatus: result.error.statusCode ?? null,
      }));
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
    console.error("Mail delivery failed: unexpected exception", mailLogContext(input, {
      errorCode: typeof mailError.code === "string" ? mailError.code : null,
      errorMessage: error instanceof Error ? error.message : "Ukendt mailfejl.",
      httpStatus:
        typeof mailError.statusCode === "number"
          ? mailError.statusCode
          : typeof mailError.status === "number"
            ? mailError.status
            : null,
    }));
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
