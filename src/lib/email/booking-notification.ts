import { escapeHtml, formatDate, sendLoggedEmail } from "@/lib/email/resend-mail";

type BookingNotificationInput = {
  bookingId: string;
  eventId: string;
  eventTitle: string;
  eventStartsAt: string;
  facilitatorEmail: string | null;
  facilitatorName: string;
  bookingsUrl: string;
};

function buildHtml(input: BookingNotificationInput) {
  const rows = [
    ["Event", input.eventTitle],
    ["Dato", formatDate(input.eventStartsAt)],
    ["Status", "Afventer din bekræftelse"],
  ];

  return `
    <div style="font-family: Arial, sans-serif; color: #17243b; line-height: 1.5;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">Ny tilmelding</h1>
      <p style="margin: 0 0 16px;">Hej ${escapeHtml(input.facilitatorName)}, der er kommet en ny tilmelding til dit event.</p>
      <p style="margin: 0 0 20px;">Log ind på SoulEvents for at se tilmeldingen og bekræfte den.</p>
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
      <p style="margin: 24px 0 0;">
        <a href="${escapeHtml(input.bookingsUrl)}" style="display: inline-block; border-radius: 999px; background: #4b5645; color: #ffffff; font-weight: 700; padding: 12px 20px; text-decoration: none;">Log ind og behandl tilmeldingen</a>
      </p>
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
    "Status: Afventer din bekræftelse",
    "",
    "Log ind på SoulEvents for at se tilmeldingen og bekræfte den:",
    input.bookingsUrl,
  ].join("\n");
}

export async function sendBookingNotification(input: BookingNotificationInput) {
  if (!input.facilitatorEmail) {
    return false;
  }

  const subject = `Ny tilmelding: ${input.eventTitle}`;
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
