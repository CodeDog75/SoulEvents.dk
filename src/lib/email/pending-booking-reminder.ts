import { renderEmailButton, renderEmailLayout, renderPlainTextFooter } from "@/lib/email/email-layout";
import { escapeHtml, sendLoggedEmail } from "@/lib/email/resend-mail";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const reminderType = "booking_pending_facilitator_reminder";
const firstReminderDelayHours = 24;
const reminderIntervalHours = 24;

type PendingBookingRow = {
  created_at: string;
  event_id: string;
  events?:
    | {
        ends_at?: string | null;
        facilitator_profiles?:
          | {
              company_name?: string | null;
              profiles?: { email?: string | null; full_name?: string | null } | Array<{ email?: string | null; full_name?: string | null }> | null;
            }
          | Array<{
              company_name?: string | null;
              profiles?: { email?: string | null; full_name?: string | null } | Array<{ email?: string | null; full_name?: string | null }> | null;
            }>
          | null;
        id: string;
        starts_at?: string | null;
        title?: string | null;
      }
    | Array<{
        ends_at?: string | null;
        facilitator_profiles?:
          | {
              company_name?: string | null;
              profiles?: { email?: string | null; full_name?: string | null } | Array<{ email?: string | null; full_name?: string | null }> | null;
            }
          | Array<{
              company_name?: string | null;
              profiles?: { email?: string | null; full_name?: string | null } | Array<{ email?: string | null; full_name?: string | null }> | null;
            }>
          | null;
        id: string;
        starts_at?: string | null;
        title?: string | null;
      }>
    | null;
  id: string;
};

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function appUrl() {
  return (env.appUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://www.soulevents.dk").replace(/\/$/, "");
}

function bookingsUrl(eventId: string) {
  return appUrl() + "/facilitator/bookings?event=" + encodeURIComponent(eventId);
}

async function hasRecentReminder(eventId: string, thresholdIso: string) {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("email_logs")
    .select("id", { count: "exact", head: true })
    .eq("type", reminderType)
    .eq("event_id", eventId)
    .eq("status", "sent")
    .gte("sent_at", thresholdIso);

  if (error) {
    console.error("Pending booking reminder throttle lookup failed", {
      errorCode: error.code ?? null,
      errorMessage: error.message,
      eventId,
      type: reminderType,
    });
    return true;
  }

  return (count ?? 0) > 0;
}

async function sendPendingBookingReminder(input: {
  bookingId: string;
  eventId: string;
  eventTitle: string;
  facilitatorEmail?: string | null;
  facilitatorName: string;
  pendingCount: number;
}) {
  const url = bookingsUrl(input.eventId);
  const countText = input.pendingCount === 1 ? "en tilmelding" : `${input.pendingCount} tilmeldinger`;
  const html = await renderEmailLayout({
    title: `Husk at behandle tilmeldingen til "${input.eventTitle}"`,
    children: [
      `<p>Hej ${escapeHtml(input.facilitatorName)}</p>`,
      `<p>Du har ${escapeHtml(countText)} til "${escapeHtml(input.eventTitle)}", som stadig afventer dit svar.</p>`,
      "<p>Deltageren venter på at få besked om, hvorvidt tilmeldingen er bekræftet.</p>",
      renderEmailButton(url, "Behandl tilmeldinger"),
    ].join(""),
  });
  const text = [
    `Hej ${input.facilitatorName}`,
    "",
    `Du har ${countText} til "${input.eventTitle}", som stadig afventer dit svar.`,
    "",
    "Deltageren venter på at få besked om, hvorvidt tilmeldingen er bekræftet.",
    "",
    "Behandl tilmeldinger:",
    url,
    ...renderPlainTextFooter(),
  ].join("\n");

  return sendLoggedEmail({
    bookingId: input.bookingId,
    eventId: input.eventId,
    html,
    subject: `Husk at behandle tilmeldingen til "${input.eventTitle}"`,
    text,
    to: input.facilitatorEmail ?? null,
    type: reminderType,
  });
}

export async function sendPendingBookingReminderBatch(now = new Date()) {
  const admin = createAdminClient();
  const firstReminderThreshold = new Date(now.getTime() - firstReminderDelayHours * 60 * 60 * 1000).toISOString();
  const recentReminderThreshold = new Date(now.getTime() - reminderIntervalHours * 60 * 60 * 1000).toISOString();
  const { data: bookings, error } = await admin
    .from("bookings")
    .select(
      "id, event_id, created_at, events!inner(id, title, starts_at, ends_at, status, facilitator_profiles!events_facilitator_id_fkey(company_name, profiles!facilitator_profiles_profile_id_fkey(email, full_name)))",
    )
    .eq("status", "pending")
    .lte("created_at", firstReminderThreshold)
    .in("events.status", ["active", "sold_out"]);

  if (error) {
    console.error("Pending booking reminder lookup failed", {
      errorCode: error.code ?? null,
      errorMessage: error.message,
      type: reminderType,
    });
    return { checked: 0, failed: 0, sent: 0, skipped: 0 };
  }

  const bookingsByEvent = new Map<string, PendingBookingRow[]>();
  for (const booking of (bookings ?? []) as PendingBookingRow[]) {
    const event = first(booking.events);
    const eventEndsAt = event?.ends_at ?? event?.starts_at;
    if (!event?.id || !eventEndsAt || new Date(eventEndsAt) < now) continue;
    const rows = bookingsByEvent.get(event.id) ?? [];
    rows.push(booking);
    bookingsByEvent.set(event.id, rows);
  }

  let failed = 0;
  let sent = 0;
  let skipped = 0;

  for (const [eventId, eventBookings] of bookingsByEvent.entries()) {
    if (await hasRecentReminder(eventId, recentReminderThreshold)) {
      skipped += 1;
      continue;
    }

    const firstBooking = eventBookings[0];
    const event = first(firstBooking.events);
    const facilitator = first(event?.facilitator_profiles);
    const profile = first(facilitator?.profiles);
    const ok = await sendPendingBookingReminder({
      bookingId: firstBooking.id,
      eventId,
      eventTitle: event?.title || "dit event",
      facilitatorEmail: profile?.email ?? null,
      facilitatorName: facilitator?.company_name || profile?.full_name || "arrangør",
      pendingCount: eventBookings.length,
    });

    if (ok) {
      sent += 1;
    } else {
      failed += 1;
    }
  }

  return {
    checked: bookingsByEvent.size,
    failed,
    sent,
    skipped,
  };
}
