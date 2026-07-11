import { renderEmailLayout, renderPlainTextFooter } from "@/lib/email/email-layout";
import { escapeHtml, formatDate, formatMoney, sendLoggedEmail } from "@/lib/email/resend-mail";

type EventUpdateField = {
  label: string;
  nextValue: string;
  previousValue: string;
};

type EventUpdateRecipient = {
  bookingId: string;
  email: string;
  name: string;
  seats: number;
};

type EventUpdateNotificationInput = {
  eventId: string;
  eventStartsAt: string;
  eventTitle: string;
  eventUrl: string;
  facilitatorName: string;
  fields: EventUpdateField[];
  location: string;
  personalMessage?: string | null;
  recipients: EventUpdateRecipient[];
};

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function formatEventDateOnly(value: string) {
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "full" }).format(new Date(value));
}

function formatEventTimeOnly(value: string) {
  return new Intl.DateTimeFormat("da-DK", { timeStyle: "short" }).format(new Date(value));
}

function formatSeatLabel(seats: number) {
  return seats === 1 ? "1 plads" : `${seats} pladser`;
}

function buildHtml(input: EventUpdateNotificationInput, recipient: EventUpdateRecipient) {
  const rows = input.fields
    .map(
      (field) => `
        <tr>
          <td style="border-bottom: 1px solid #E9DFF2; padding: 10px 8px 10px 0; color: #2F2633; font-weight: 700; vertical-align: top;">${escapeHtml(field.label)}</td>
          <td style="border-bottom: 1px solid #E9DFF2; padding: 10px 0 10px 8px; color: #2F2633; vertical-align: top;">
            <div><strong>Før:</strong> ${escapeHtml(field.previousValue)}</div>
            <div><strong>Nu:</strong> ${escapeHtml(field.nextValue)}</div>
          </td>
        </tr>
      `,
    )
    .join("");

  return renderEmailLayout({
    title: "Der er nyt om " + input.eventTitle,
    children: `
      <p style="margin: 0 0 16px;">Hej ${escapeHtml(firstName(recipient.name))}</p>
      <p style="margin: 0 0 12px;">Arrangøren har opdateret nogle oplysninger om:</p>
      <p style="margin: 0 0 18px; font-weight: 700;">${escapeHtml(input.eventTitle)}</p>
      <p style="margin: 0 0 18px;">Vi anbefaler, at du ser eventet igen, så du har de nyeste praktiske informationer.</p>
      ${
        input.personalMessage
          ? `<div style="margin: 18px 0; border-radius: 16px; background: #F7F2FB; padding: 14px 16px;"><strong>Personlig besked fra arrangøren</strong><p style="margin: 8px 0 0;">${escapeHtml(input.personalMessage)}</p></div>`
          : ""
      }
      <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse: collapse; width: 100%; margin: 20px 0 0;">
        <tbody>
          <tr>
            <td style="border-bottom: 1px solid #E9DFF2; padding: 10px 8px 10px 0; color: #2F2633; font-weight: 700; vertical-align: top;">Dato</td>
            <td style="border-bottom: 1px solid #E9DFF2; padding: 10px 0 10px 8px; color: #2F2633; vertical-align: top;">${escapeHtml(formatEventDateOnly(input.eventStartsAt))}</td>
          </tr>
          <tr>
            <td style="border-bottom: 1px solid #E9DFF2; padding: 10px 8px 10px 0; color: #2F2633; font-weight: 700; vertical-align: top;">Tid</td>
            <td style="border-bottom: 1px solid #E9DFF2; padding: 10px 0 10px 8px; color: #2F2633; vertical-align: top;">${escapeHtml(formatEventTimeOnly(input.eventStartsAt))}</td>
          </tr>
          <tr>
            <td style="border-bottom: 1px solid #E9DFF2; padding: 10px 8px 10px 0; color: #2F2633; font-weight: 700; vertical-align: top;">Sted</td>
            <td style="border-bottom: 1px solid #E9DFF2; padding: 10px 0 10px 8px; color: #2F2633; vertical-align: top;">${escapeHtml(input.location)}</td>
          </tr>
          <tr>
            <td style="border-bottom: 1px solid #E9DFF2; padding: 10px 8px 10px 0; color: #2F2633; font-weight: 700; vertical-align: top;">Du har reserveret</td>
            <td style="border-bottom: 1px solid #E9DFF2; padding: 10px 0 10px 8px; color: #2F2633; vertical-align: top;">${escapeHtml(formatSeatLabel(recipient.seats))}</td>
          </tr>
        </tbody>
      </table>
      ${rows ? `<h2 style="font-size: 16px; margin: 24px 0 8px; color: #2F2633;">Dette er ændret</h2><table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse: collapse; width: 100%; margin: 0;"><tbody>${rows}</tbody></table>` : ""}
      <p style="margin: 20px 0 0;">Har du spørgsmål, kan du kontakte arrangøren direkte.</p>
      <p style="margin: 20px 0 0;"><a href="${escapeHtml(input.eventUrl)}" style="display: inline-block; border-radius: 999px; background: #7A4EAB; color: #ffffff; font-weight: 700; padding: 12px 22px; text-decoration: none;">Vis event</a></p>
    `,
  });
}

function buildText(input: EventUpdateNotificationInput, recipient: EventUpdateRecipient) {
  return [
    "Der er ændringer til dit event",
    "",
    "Hej " + recipient.name,
    "",
    "Arrangøren har opdateret nogle oplysninger om:",
    "",
    input.eventTitle,
    "",
    "Vi anbefaler, at du ser eventet igen, så du har de nyeste praktiske informationer.",
    ...(input.personalMessage ? ["", input.personalMessage] : []),
    "",
    "Dato:",
    formatEventDateOnly(input.eventStartsAt),
    "",
    "Tid:",
    formatEventTimeOnly(input.eventStartsAt),
    "",
    "Sted:",
    input.location,
    "",
    "Du har reserveret:",
    formatSeatLabel(recipient.seats),
    "",
    input.eventUrl,
    "",
    ...input.fields.flatMap((field) => [
      field.label + ":",
      "Før: " + field.previousValue,
      "Nu: " + field.nextValue,
      "",
    ]),
    "Har du spørgsmål, kan du kontakte arrangøren direkte.",
    ...renderPlainTextFooter(),
  ].join("\n");
}

export function formatEventUpdateDate(value: string | null) {
  return value ? formatDate(value) : "Ikke angivet";
}

export function formatEventUpdateMoney(cents: number | null) {
  return cents === null ? "Ikke angivet" : formatMoney(cents);
}

export async function sendEventUpdateNotifications(input: EventUpdateNotificationInput) {
  if (input.recipients.length === 0) {
    return { failed: 0, sent: 0, total: 0 };
  }

  const results = await Promise.allSettled(
    input.recipients.map((recipient) =>
      sendLoggedEmail({
        type: "event_updated_participant",
        to: recipient.email,
        subject: "Der er nyt om " + input.eventTitle + " 💜",
        html: buildHtml(input, recipient),
        text: buildText(input, recipient),
        bookingId: recipient.bookingId,
        eventId: input.eventId,
      }),
    ),
  );

  return {
    failed: results.filter((result) => result.status === "rejected" || !result.value).length,
    sent: results.filter((result) => result.status === "fulfilled" && result.value).length,
    total: input.recipients.length,
  };
}
