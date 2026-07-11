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
};

type EventUpdateNotificationInput = {
  eventId: string;
  eventTitle: string;
  facilitatorName: string;
  fields: EventUpdateField[];
  recipients: EventUpdateRecipient[];
};

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
    title: "Der er ændringer til dit event",
    children: `
      <p style="margin: 0 0 16px;">Hej ${escapeHtml(recipient.name)}</p>
      <p style="margin: 0 0 20px;">Arrangøren har opdateret ${escapeHtml(input.eventTitle)}. Her er de vigtigste ændringer.</p>
      <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse: collapse; width: 100%; margin: 20px 0 0;">
        <tbody>${rows}</tbody>
      </table>
      <p style="margin: 20px 0 0;">Har du spørgsmål, kan du kontakte arrangøren direkte.</p>
    `,
  });
}

function buildText(input: EventUpdateNotificationInput, recipient: EventUpdateRecipient) {
  return [
    "Der er ændringer til dit event",
    "",
    "Hej " + recipient.name,
    "",
    "Arrangøren har opdateret " + input.eventTitle + ". Her er de vigtigste ændringer.",
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
  if (input.fields.length === 0 || input.recipients.length === 0) {
    return;
  }

  await Promise.all(
    input.recipients.map((recipient) =>
      sendLoggedEmail({
        type: "event_updated_participant",
        to: recipient.email,
        subject: "Ændring til event: " + input.eventTitle,
        html: buildHtml(input, recipient),
        text: buildText(input, recipient),
        bookingId: recipient.bookingId,
        eventId: input.eventId,
      }),
    ),
  );
}
