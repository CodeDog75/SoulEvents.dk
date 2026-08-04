import { renderEmailLayout, renderEmailTable, renderPlainTextFooter } from "@/lib/email/email-layout";
import { escapeHtml, formatDate, sendLoggedEmail } from "@/lib/email/resend-mail";

type ParticipantBookingReceiptInput = {
  bookingId: string;
  cancelUrl?: string | null;
  eventId: string;
  participantEmail: string;
  participantName: string;
  eventTitle: string;
  eventStartsAt: string;
  facilitatorName: string;
  seats: number;
};

const guidelines = [
  "SoulEvents.dk formidler events mellem deltagere og arrangører og er ikke arrangør af det enkelte event.",
  "SoulEvents.dk kan ikke stilles til ansvar for betaling, ændringer, aflysning eller kvaliteten af eventet.",
  "Kontakt arrangøren direkte, hvis du har spørgsmål til praktiske forhold, betaling, ændringer eller aflysning.",
];

async function buildHtml(input: ParticipantBookingReceiptInput) {
  const rows: Array<[string, string]> = [
    ["Event", input.eventTitle],
    ["Dato", formatDate(input.eventStartsAt)],
    ["Arrangør", input.facilitatorName],
    ["Antal pladser", String(input.seats)],
  ];

  return renderEmailLayout({
    title: "Tak for din tilmelding",
    children: [
      '<p style="margin: 0 0 16px;">Hej ' + escapeHtml(input.participantName) + '</p>',
      '<p style="margin: 0 0 12px;">Tak for din tilmelding til ' + escapeHtml(input.eventTitle) + '.</p>',
      '<div style="margin: 0 0 22px; padding: 16px; border: 1px solid #E5D4F7; border-radius: 14px; background: #FAF7FE;">',
      '<p style="margin: 0 0 8px; font-weight: 700; color: #4F3A63;">Din tilmelding er bekræftet</p>',
      '<p style="margin: 0 0 8px;">Din tilmelding er registreret hos SoulEvents.</p>',
      '<p style="margin: 0;">Kontakt arrangøren direkte, hvis du har spørgsmål til betaling eller praktiske forhold.</p>',
      "</div>",
      renderEmailTable(rows),
      '<h2 style="font-size: 16px; margin: 24px 0 8px; color: #2F2633;">Vigtigt om din tilmelding</h2>',
      '<ul style="padding-left: 20px; margin: 0;">',
      guidelines.map((item) => '<li style="margin-bottom: 8px;">' + escapeHtml(item) + "</li>").join(""),
      "</ul>",
      '<p style="margin: 20px 0 0;">Gem denne mail som kvittering for din tilmelding.</p>',
      input.cancelUrl
        ? '<div style="margin: 22px 0 0; padding-top: 16px; border-top: 1px solid #E9DFF2;"><p style="margin: 0 0 8px; color: #6E6475;">Har du fortrudt din tilmelding?</p><a href="' +
          escapeHtml(input.cancelUrl) +
          '" style="color: #7A4EAB; font-weight: 700;">Afmeld tilmelding</a></div>'
        : "",
    ].join(""),
  });
}

function buildText(input: ParticipantBookingReceiptInput) {
  return [
    "Vi har modtaget din tilmelding",
    "",
    "Hej " + input.participantName,
    "",
    "Tak for din tilmelding til " + input.eventTitle + ".",
    "Din tilmelding er bekræftet",
    "Din tilmelding er registreret hos SoulEvents.",
    "Kontakt arrangøren direkte, hvis du har spørgsmål til betaling eller praktiske forhold.",
    "",
    "Event: " + input.eventTitle,
    "Dato: " + formatDate(input.eventStartsAt),
    "Arrangør: " + input.facilitatorName,
    "Antal pladser: " + input.seats,
    "",
    "Vigtigt om din tilmelding:",
    ...guidelines.map((item) => "- " + item),
    "",
    "Gem denne mail som kvittering for din tilmelding.",
    input.cancelUrl ? "" : "",
    input.cancelUrl ? "Har du fortrudt din tilmelding?" : "",
    input.cancelUrl ? input.cancelUrl : "",
    ...renderPlainTextFooter(),
  ].filter((line, index, lines) => line || lines[index - 1] || lines[index + 1]).join("\n");
}

export async function sendParticipantBookingReceipt(input: ParticipantBookingReceiptInput) {
  return sendLoggedEmail({
    type: "booking_created_participant_receipt",
    to: input.participantEmail,
    subject: "Din tilmelding er bekræftet: " + input.eventTitle,
    html: await buildHtml(input),
    text: buildText(input),
    bookingId: input.bookingId,
    eventId: input.eventId,
  });
}
