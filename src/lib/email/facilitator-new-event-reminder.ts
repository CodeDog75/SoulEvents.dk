import { env } from "@/lib/env";
import { escapeHtml, formatDate, formatMoney, sendLoggedEmail } from "@/lib/email/resend-mail";
import { createAdminClient } from "@/lib/supabase/admin";

type ReminderEvent = {
  id: string;
  title: string;
  short_description: string | null;
  ends_at: string;
  starts_at: string;
  price_cents: number | null;
  city: string | null;
  event_format: string | null;
  facilitator_id: string;
  facilitator_profiles:
    | {
        company_name: string | null;
        profiles: { full_name: string | null } | { full_name: string | null }[] | null;
      }
    | {
        company_name: string | null;
        profiles: { full_name: string | null } | { full_name: string | null }[] | null;
      }[]
    | null;
};

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function unsubscribeUrl(token: string) {
  const appUrl = env.appUrl || "https://www.soulevents.dk";
  return appUrl.replace(/\/$/, "") + "/reminders/unsubscribe?token=" + encodeURIComponent(token);
}

function eventUrl(eventId: string) {
  const appUrl = env.appUrl || "https://www.soulevents.dk";
  return appUrl.replace(/\/$/, "") + "/events/" + eventId;
}

function facilitatorName(event: ReminderEvent) {
  const facilitator = first(event.facilitator_profiles);
  const profile = first(facilitator?.profiles);
  return facilitator?.company_name || profile?.full_name || "Arrangøren";
}

function buildHtml(input: { event: ReminderEvent; name: string; url: string; unsubscribeUrl: string }) {
  const place = input.event.event_format === "online" ? "Online" : input.event.city || "Se lokation på eventsiden";
  return [
    '<div style="font-family: Arial, sans-serif; color: #2F2633; line-height: 1.55;">',
    '<p style="margin: 0 0 12px;">Hej</p>',
    '<h1 style="font-size: 24px; margin: 0 0 12px; color: #7A4EAB;">' + escapeHtml(input.name) + ' har oprettet et nyt event</h1>',
    '<p style="margin: 0 0 18px;">Du modtager denne mail, fordi du har tilmeldt dig påmindelser fra denne arrangør på SoulEvents.dk.</p>',
    '<div style="background: #FAF6EF; border: 1px solid #EDE4F7; border-radius: 18px; padding: 18px; max-width: 620px;">',
    '<h2 style="font-size: 20px; margin: 0 0 10px; color: #2F2633;">' + escapeHtml(input.event.title) + '</h2>',
    '<p style="margin: 0 0 8px;"><strong>Dato:</strong> ' + escapeHtml(formatDate(input.event.starts_at)) + '</p>',
    '<p style="margin: 0 0 8px;"><strong>Sted:</strong> ' + escapeHtml(place) + '</p>',
    '<p style="margin: 0 0 14px;"><strong>Pris:</strong> ' + escapeHtml(formatMoney(input.event.price_cents ?? 0)) + '</p>',
    input.event.short_description ? '<p style="margin: 0 0 16px;">' + escapeHtml(input.event.short_description) + '</p>' : '',
    '<a href="' + escapeHtml(input.url) + '" style="display: inline-block; background: #7A4EAB; color: #ffffff; padding: 11px 18px; border-radius: 999px; text-decoration: none; font-weight: 700;">Se event</a>',
    '<p style="margin: 18px 0 0; font-size: 12px; color: #6f6a73;">Vil du ikke længere have påmindelser fra denne arrangør? <a href="' + escapeHtml(input.unsubscribeUrl) + '" style="color: #7A4EAB;">Afmeld her</a>.</p>',
    '</div>',
    '</div>',
  ].join("");
}

function buildText(input: { event: ReminderEvent; name: string; url: string; unsubscribeUrl: string }) {
  const place = input.event.event_format === "online" ? "Online" : input.event.city || "Se lokation på eventsiden";
  return [
    input.name + " har oprettet et nyt event",
    "",
    "Du modtager denne mail, fordi du har tilmeldt dig påmindelser fra denne arrangør på SoulEvents.dk.",
    "",
    "Event: " + input.event.title,
    "Dato: " + formatDate(input.event.starts_at),
    "Sted: " + place,
    "Pris: " + formatMoney(input.event.price_cents ?? 0),
    "",
    input.event.short_description || "",
    "",
    "Se event: " + input.url,
    "",
    "Afmeld påmindelser fra denne arrangør: " + input.unsubscribeUrl,
  ].join("\n");
}

export async function notifyFacilitatorEventReminderSubscribers(eventId: string) {
  if (!env.supabaseServiceRoleKey) {
    return;
  }

  const admin = createAdminClient();
  const { data: event } = await admin
    .from("events")
    .select("id, title, short_description, starts_at, ends_at, price_cents, city, event_format, facilitator_id, facilitator_profiles(company_name, profiles(full_name))")
    .eq("id", eventId)
    .eq("status", "active")
    .gte("ends_at", new Date().toISOString())
    .maybeSingle();

  if (!event) {
    return;
  }

  const { data: reminders } = await admin
    .from("facilitator_event_reminders")
    .select("id, email, unsubscribe_token")
    .eq("facilitator_id", event.facilitator_id)
    .eq("status", "active");

  if (!reminders || reminders.length === 0) {
    return;
  }

  const typedEvent = event as ReminderEvent;
  const name = facilitatorName(typedEvent);
  const url = eventUrl(typedEvent.id);

  for (const reminder of reminders) {
    const { error: notificationError } = await admin
      .from("facilitator_event_reminder_notifications")
      .insert({
        reminder_id: reminder.id,
        event_id: typedEvent.id,
      });

    if (notificationError) {
      continue;
    }

    await sendLoggedEmail({
      type: "facilitator_new_event_reminder",
      to: reminder.email,
      subject: name + " har oprettet et nyt event på SoulEvents.dk",
      html: buildHtml({ event: typedEvent, name, url, unsubscribeUrl: unsubscribeUrl(reminder.unsubscribe_token) }),
      text: buildText({ event: typedEvent, name, url, unsubscribeUrl: unsubscribeUrl(reminder.unsubscribe_token) }),
      eventId: typedEvent.id,
    });

    await admin
      .from("facilitator_event_reminder_notifications")
      .update({ sent_at: new Date().toISOString() })
      .eq("reminder_id", reminder.id)
      .eq("event_id", typedEvent.id);
  }
}
