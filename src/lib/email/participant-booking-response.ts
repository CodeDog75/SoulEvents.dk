import { escapeHtml, formatDate, sendLoggedEmail } from "@/lib/email/resend-mail";
import type { BookingStatus } from "@/types/database";

type ParticipantBookingResponseInput = {
  bookingId: string;
  eventId: string;
  status: BookingStatus;
  participantEmail: string;
  participantName: string;
  eventTitle: string;
  eventStartsAt: string;
  facilitatorName: string;
};

const statusText: Partial<Record<BookingStatus, { subject: string; headline: string; body: string }>> = {
  confirmed: {
    subject: "Din tilmelding er bekræftet",
    headline: "Din tilmelding er bekræftet",
    body: "Facilitatoren har bekræftet din tilmelding.",
  },
  sold_out: {
    subject: "Arrangementet er udsolgt",
    headline: "Arrangementet er udsolgt",
    body: "Facilitatoren har markeret arrangementet som udsolgt.",
  },
  cancelled: {
    subject: "Arrangementet er aflyst",
    headline: "Arrangementet er aflyst",
    body: "Facilitatoren har aflyst arrangementet.",
  },
};

function buildHtml(input: ParticipantBookingResponseInput) {
  const copy = statusText[input.status] ?? statusText.confirmed;

  return `
    <div style="font-family: Arial, sans-serif; color: #17243b; line-height: 1.5;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">${escapeHtml(copy?.headline ?? "Status på tilmelding")}</h1>
      <p style="margin: 0 0 16px;">Hej ${escapeHtml(input.participantName)}</p>
      <p style="margin: 0 0 20px;">${escapeHtml(copy?.body ?? "Der er nyt om din tilmelding.")}</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 620px;">
        <tbody>
          <tr>
            <td style="border-bottom: 1px solid #e9ddc9; padding: 8px 10px; font-weight: 700;">Event</td>
            <td style="border-bottom: 1px solid #e9ddc9; padding: 8px 10px;">${escapeHtml(input.eventTitle)}</td>
          </tr>
          <tr>
            <td style="border-bottom: 1px solid #e9ddc9; padding: 8px 10px; font-weight: 700;">Dato</td>
            <td style="border-bottom: 1px solid #e9ddc9; padding: 8px 10px;">${escapeHtml(formatDate(input.eventStartsAt))}</td>
          </tr>
          <tr>
            <td style="border-bottom: 1px solid #e9ddc9; padding: 8px 10px; font-weight: 700;">Facilitator</td>
            <td style="border-bottom: 1px solid #e9ddc9; padding: 8px 10px;">${escapeHtml(input.facilitatorName)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function buildText(input: ParticipantBookingResponseInput) {
  const copy = statusText[input.status] ?? statusText.confirmed;

  return [
    copy?.headline ?? "Status på tilmelding",
    "",
    `Hej ${input.participantName}`,
    copy?.body ?? "Der er nyt om din tilmelding.",
    "",
    `Event: ${input.eventTitle}`,
    `Dato: ${formatDate(input.eventStartsAt)}`,
    `Facilitator: ${input.facilitatorName}`,
  ].join("\n");
}

export async function sendParticipantBookingResponse(input: ParticipantBookingResponseInput) {
  const copy = statusText[input.status];

  if (!copy) {
    return;
  }

  await sendLoggedEmail({
    type: `booking_${input.status}_participant`,
    to: input.participantEmail,
    subject: `${copy.subject}: ${input.eventTitle}`,
    html: buildHtml(input),
    text: buildText(input),
    bookingId: input.bookingId,
    eventId: input.eventId,
  });
}
