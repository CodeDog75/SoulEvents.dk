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
          <td style="border-bottom: 1px solid #e9ddc9; padding: 8px 10px; font-weight: 700;">${escapeHtml(field.label)}</td>
          <td style="border-bottom: 1px solid #e9ddc9; padding: 8px 10px;">
            <div><strong>Før:</strong> ${escapeHtml(field.previousValue)}</div>
            <div><strong>Nu:</strong> ${escapeHtml(field.nextValue)}</div>
          </td>
        </tr>
      `,
    )
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; color: #17243b; line-height: 1.5;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">Der er ændringer til dit event</h1>
      <p style="margin: 0 0 16px;">Hej ${escapeHtml(recipient.name)}</p>
      <p style="margin: 0 0 20px;">Arrangøren har opdateret ${escapeHtml(input.eventTitle)}. Her er de vigtigste ændringer.</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 620px;">
        <tbody>${rows}</tbody>
      </table>
      <p style="margin: 20px 0 0;">Har du spørgsmål, kan du kontakte arrangøren direkte.</p>
      <p style="margin: 16px 0 0;">Kærlig hilsen<br> SoulEvents.dk</p>
    </div>
  `;
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
    "",
    "Kærlig hilsen",
    "SoulEvents.dk",
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
