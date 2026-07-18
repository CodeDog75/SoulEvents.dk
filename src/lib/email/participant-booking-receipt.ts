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

async function buildHtml(input: ParticipantBookingReceiptInput) {
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
      '<div style="margin: 0 0 22px; padding: 16px; border: 1px solid #E5D4F7; border-radius: 14px; background: #FAF7FE;">',
      '<p style="margin: 0 0 8px; font-weight: 700; color: #4F3A63;">Afventer arrangørens bekræftelse</p>',
      '<p style="margin: 0 0 8px;">Din tilmelding er endnu ikke endeligt bekræftet.</p>',
      '<p style="margin: 0;">Arrangøren gennemgår den nu, og du modtager en ny e-mail, så snart din plads er godkendt.</p>',
      "</div>",
      renderEmailTable(rows),
      '<h2 style="font-size: 16px; margin: 24px 0 8px; color: #2F2633;">Vigtigt om din tilmelding</h2>',
      '<ul style="padding-left: 20px; margin: 0;">',
      guidelines.map((item) => '<li style="margin-bottom: 8px;">' + escapeHtml(item) + "</li>").join(""),
      "</ul>",
      '<p style="margin: 20px 0 0;">Du behøver ikke foretage dig noget lige nu. Hold blot øje med din indbakke.</p>',
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
    "Afventer arrangørens bekræftelse",
    "Din tilmelding er endnu ikke endeligt bekræftet.",
    "Arrangøren gennemgår den nu, og du modtager en ny e-mail, så snart din plads er godkendt.",
    "",
    "Event: " + input.eventTitle,
    "Dato: " + formatDate(input.eventStartsAt),
    "Arrangør: " + input.facilitatorName,
    "Antal pladser: " + input.seats,
    "",
    "Vigtigt om din tilmelding:",
    ...guidelines.map((item) => "- " + item),
    "",
    "Du behøver ikke foretage dig noget lige nu. Hold blot øje med din indbakke.",
    ...renderPlainTextFooter(),
  ].join("\n");
}

export async function sendParticipantBookingReceipt(input: ParticipantBookingReceiptInput) {
  return sendLoggedEmail({
    type: "booking_created_participant_receipt",
    to: input.participantEmail,
    subject: "Vi har modtaget din tilmelding: " + input.eventTitle,
    html: await buildHtml(input),
    text: buildText(input),
    bookingId: input.bookingId,
    eventId: input.eventId,
  });
}
