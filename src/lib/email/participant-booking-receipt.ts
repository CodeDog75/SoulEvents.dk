import { escapeHtml, formatDate, sendLoggedEmail } from "@/lib/email/resend-mail";

type ParticipantBookingReceiptInput = {
  bookingId: string;
  eventId: string;
  participantEmail: string;
  participantName: string;
  eventTitle: string;
  eventStartsAt: string;
  facilitatorName: string;
  seats: number;
};

const guidelines = [
  "Din tilmelding er modtaget, men den er ikke en garanti for deltagelse, før arrangøren har bekræftet den.",
  "SoulEvents.dk formidler events mellem deltagere og arrangører og er ikke arrangør af det enkelte event.",
  "SoulEvents.dk kan ikke stilles til ansvar for manglende bekræftelse, manglende svar fra arrangør eller kvaliteten af eventet.",
  "Kontakt arrangøren direkte, hvis du har spørgsmål til praktiske forhold, betaling, ændringer eller aflysning.",
];

function buildHtml(input: ParticipantBookingReceiptInput) {
  const rows = [
    ["Event", input.eventTitle],
    ["Dato", formatDate(input.eventStartsAt)],
    ["Arrangør", input.facilitatorName],
    ["Antal pladser", String(input.seats)],
  ];

  return [
    '<div style="font-family: Arial, sans-serif; color: #17243b; line-height: 1.5;">',
    '<h1 style="font-size: 22px; margin: 0 0 12px;">Vi har modtaget din tilmelding</h1>',
    '<p style="margin: 0 0 16px;">Hej ' + escapeHtml(input.participantName) + '</p>',
    '<p style="margin: 0 0 20px;">Tak for din tilmelding til ' + escapeHtml(input.eventTitle) + '. Din tilmelding er sendt videre til arrangøren.</p>',
    '<table style="border-collapse: collapse; width: 100%; max-width: 620px; margin-bottom: 22px;"><tbody>',
    rows
      .map(
        ([label, value]) =>
          '<tr><td style="border-bottom: 1px solid #e9ddc9; padding: 8px 10px; font-weight: 700;">' +
          escapeHtml(label) +
          '</td><td style="border-bottom: 1px solid #e9ddc9; padding: 8px 10px;">' +
          escapeHtml(value) +
          '</td></tr>',
      )
      .join(""),
    "</tbody></table>",
    '<h2 style="font-size: 16px; margin: 0 0 8px;">Vigtigt om din tilmelding</h2>',
    '<ul style="padding-left: 20px; margin: 0;">',
    guidelines.map((item) => '<li style="margin-bottom: 8px;">' + escapeHtml(item) + "</li>").join(""),
    "</ul>",
    "</div>",
  ].join("");
}

function buildText(input: ParticipantBookingReceiptInput) {
  return [
    "Vi har modtaget din tilmelding",
    "",
    "Hej " + input.participantName,
    "",
    "Tak for din tilmelding til " + input.eventTitle + ". Din tilmelding er sendt videre til arrangøren.",
    "",
    "Event: " + input.eventTitle,
    "Dato: " + formatDate(input.eventStartsAt),
    "Arrangør: " + input.facilitatorName,
    "Antal pladser: " + input.seats,
    "",
    "Vigtigt om din tilmelding:",
    ...guidelines.map((item) => "- " + item),
  ].join("\n");
}

export async function sendParticipantBookingReceipt(input: ParticipantBookingReceiptInput) {
  await sendLoggedEmail({
    type: "booking_created_participant_receipt",
    to: input.participantEmail,
    subject: "Vi har modtaget din tilmelding: " + input.eventTitle,
    html: buildHtml(input),
    text: buildText(input),
    bookingId: input.bookingId,
    eventId: input.eventId,
  });
}
