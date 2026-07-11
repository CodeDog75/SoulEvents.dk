import { renderEmailLayout, renderEmailTable, renderPlainTextFooter } from "@/lib/email/email-layout";
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
  "SoulEvents.dk formidler events mellem deltagere og arrangører og er ikke arrangør af det enkelte event.",
  "SoulEvents.dk kan ikke stilles til ansvar for manglende bekræftelse, manglende svar fra arrangør eller kvaliteten af eventet.",
  "Kontakt arrangøren direkte, hvis du har spørgsmål til praktiske forhold, betaling, ændringer eller aflysning.",
];

function buildHtml(input: ParticipantBookingReceiptInput) {
  const rows: Array<[string, string]> = [
    ["Event", input.eventTitle],
    ["Dato", formatDate(input.eventStartsAt)],
    ["Arrangør", input.facilitatorName],
    ["Antal pladser", String(input.seats)],
  ];

  return renderEmailLayout({
    title: "Vi har modtaget din tilmelding",
    children: [
      '<p style="margin: 0 0 16px;">Hej ' + escapeHtml(input.participantName) + '</p>',
      '<p style="margin: 0 0 12px;">Tak for din tilmelding til ' + escapeHtml(input.eventTitle) + '.</p>',
      '<p style="margin: 0 0 20px;">Din tilmelding er modtaget og afventer arrangørens bekræftelse.</p>',
      renderEmailTable(rows),
      '<h2 style="font-size: 16px; margin: 24px 0 8px; color: #2F2633;">Vigtigt om din tilmelding</h2>',
      '<ul style="padding-left: 20px; margin: 0;">',
      guidelines.map((item) => '<li style="margin-bottom: 8px;">' + escapeHtml(item) + "</li>").join(""),
      "</ul>",
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
    "Din tilmelding er modtaget og afventer arrangørens bekræftelse.",
    "",
    "Event: " + input.eventTitle,
    "Dato: " + formatDate(input.eventStartsAt),
    "Arrangør: " + input.facilitatorName,
    "Antal pladser: " + input.seats,
    "",
    "Vigtigt om din tilmelding:",
    ...guidelines.map((item) => "- " + item),
    ...renderPlainTextFooter(),
  ].join("\n");
}

export async function sendParticipantBookingReceipt(input: ParticipantBookingReceiptInput) {
  return sendLoggedEmail({
    type: "booking_created_participant_receipt",
    to: input.participantEmail,
    subject: "Vi har modtaget din tilmelding: " + input.eventTitle,
    html: buildHtml(input),
    text: buildText(input),
    bookingId: input.bookingId,
    eventId: input.eventId,
  });
}
