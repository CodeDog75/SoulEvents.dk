import { renderEmailButton, renderEmailLayout, renderEmailTable, renderPlainTextFooter } from "@/lib/email/email-layout";
import { escapeHtml, formatDate, sendLoggedEmail } from "@/lib/email/resend-mail";

type BookingNotificationInput = {
  bookingId: string;
  eventId: string;
  eventTitle: string;
  eventStartsAt: string;
  facilitatorEmail: string | null;
  facilitatorName: string;
  bookingsUrl: string;
  participantName: string;
  participantEmail: string;
  participantPhone: string | null;
  seats: number;
};

function formatSeats(seats: number) {
  return seats === 1 ? "1 plads" : `${seats} pladser`;
}

function buildHtml(input: BookingNotificationInput) {
  const rows: Array<[string, string]> = [
    ["Tilmeldt af", input.participantName],
    ["Antal reserverede pladser", String(input.seats)],
    ["E-mailadresse", input.participantEmail],
    ["Telefonnummer", input.participantPhone || "Ikke angivet"],
    ["Event", input.eventTitle],
    ["Dato", formatDate(input.eventStartsAt)],
  ];

  return renderEmailLayout({
    title: "Du har modtaget en ny tilmelding",
    children: `
      <p style="margin: 0 0 16px;">Hej ${escapeHtml(input.facilitatorName)}, der er kommet en ny tilmelding til dit event.</p>
      ${renderEmailTable(rows)}
      <p style="margin: 20px 0 0;">Log ind på SoulEvents for at se tilmeldingen og husk at bekræfte den.</p>
      ${renderEmailButton(input.bookingsUrl, "Se og bekræft tilmelding")}
    `,
  });
}

function buildText(input: BookingNotificationInput) {
  return [
    "Du har modtaget en ny tilmelding",
    "",
    `Hej ${input.facilitatorName}, der er kommet en ny tilmelding til:`,
    "",
    `Tilmeldt af: ${input.participantName}`,
    `Antal reserverede pladser: ${input.seats}`,
    `E-mailadresse: ${input.participantEmail}`,
    `Telefonnummer: ${input.participantPhone || "Ikke angivet"}`,
    `Event: ${input.eventTitle}`,
    `Dato: ${formatDate(input.eventStartsAt)}`,
    "",
    "Log ind på SoulEvents for at se tilmeldingen og husk at bekræfte den:",
    input.bookingsUrl,
    ...renderPlainTextFooter(),
  ].join("\n");
}

export async function sendBookingNotification(input: BookingNotificationInput) {
  const subject = input.seats === 1
    ? `Ny tilmelding til ${input.eventTitle}`
    : `Ny tilmelding: ${formatSeats(input.seats)} til ${input.eventTitle}`;

  return sendLoggedEmail({
    type: "booking_created_facilitator",
    to: input.facilitatorEmail,
    subject,
    html: buildHtml(input),
    text: buildText(input),
    bookingId: input.bookingId,
    eventId: input.eventId,
  });
}
