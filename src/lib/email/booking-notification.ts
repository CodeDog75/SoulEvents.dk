import { escapeHtml, formatDate, formatMoney, sendLoggedEmail } from "@/lib/email/resend-mail";

type BookingNotificationInput = {
  bookingId: string;
  eventId: string;
  eventTitle: string;
  eventStartsAt: string;
  facilitatorEmail: string | null;
  facilitatorName: string;
  participantName: string;
  participantEmail: string;
  participantPhone: string | null;
  seats: number;
  message: string | null;
  bookingValueCents: number;
  commissionCents: number;
};

function buildHtml(input: BookingNotificationInput) {
  const rows = [
    ["Event", input.eventTitle],
    ["Dato", formatDate(input.eventStartsAt)],
    ["Navn", input.participantName],
    ["E-mail", input.participantEmail],
    ["Telefon", input.participantPhone || "Ikke angivet"],
    ["Antal pladser", String(input.seats)],
    ["Bookingværdi", formatMoney(input.bookingValueCents)],
    ["Beregnet kommission", formatMoney(input.commissionCents)],
  ];

  return `
    <div style="font-family: Arial, sans-serif; color: #17243b; line-height: 1.5;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">Ny tilmelding</h1>
      <p style="margin: 0 0 20px;">Hej ${escapeHtml(input.facilitatorName)}, der er kommet en ny tilmelding.</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 620px;">
        <tbody>
          ${rows
            .map(
              ([label, value]) => `
                <tr>
                  <td style="border-bottom: 1px solid #e9ddc9; padding: 8px 10px; font-weight: 700;">${escapeHtml(label)}</td>
                  <td style="border-bottom: 1px solid #e9ddc9; padding: 8px 10px;">${escapeHtml(value)}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
      ${
        input.message
          ? `<h2 style="font-size: 16px; margin: 24px 0 8px;">Besked fra deltager</h2><p style="white-space: pre-line; margin: 0;">${escapeHtml(input.message)}</p>`
          : ""
      }
    </div>
  `;
}

function buildText(input: BookingNotificationInput) {
  return [
    "Ny tilmelding",
    "",
    `Hej ${input.facilitatorName}, der er kommet en ny tilmelding.`,
    "",
    `Event: ${input.eventTitle}`,
    `Dato: ${formatDate(input.eventStartsAt)}`,
    `Navn: ${input.participantName}`,
    `E-mail: ${input.participantEmail}`,
    `Telefon: ${input.participantPhone || "Ikke angivet"}`,
    `Antal pladser: ${input.seats}`,
    `Bookingværdi: ${formatMoney(input.bookingValueCents)}`,
    `Beregnet kommission: ${formatMoney(input.commissionCents)}`,
    "",
    input.message ? `Besked: ${input.message}` : "",
  ].join("\n");
}

export async function sendBookingNotification(input: BookingNotificationInput) {
  if (!input.facilitatorEmail) {
    return;
  }

  const subject = `Ny tilmelding: ${input.eventTitle}`;
  await sendLoggedEmail({
    type: "booking_created_facilitator",
    to: input.facilitatorEmail,
    replyTo: input.participantEmail,
    subject,
    html: buildHtml(input),
    text: buildText(input),
    bookingId: input.bookingId,
    eventId: input.eventId,
  });
}
