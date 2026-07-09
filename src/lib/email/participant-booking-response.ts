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
  eventUrl?: string | null;
};

const statusText: Partial<Record<BookingStatus, { subject: string; headline: string; body: string }>> = {
  confirmed: {
    subject: "Din tilmelding er bekræftet",
    headline: "Din tilmelding er bekræftet",
    body: "Arrangøren har bekræftet din tilmelding.",
  },
  sold_out: {
    subject: "Arrangementet er udsolgt",
    headline: "Arrangementet er udsolgt",
    body: "Arrangøren har markeret arrangementet som udsolgt.",
  },
  cancelled: {
    subject: "Din tilmelding er blevet annulleret",
    headline: "Din tilmelding er blevet annulleret",
    body: "Arrangøren har annulleret din tilmelding. Eventet er ikke nødvendigvis aflyst.",
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
            <td style="border-bottom: 1px solid #e9ddc9; padding: 8px 10px; font-weight: 700;">Periode</td>
            <td style="border-bottom: 1px solid #e9ddc9; padding: 8px 10px;">${escapeHtml(formatDate(input.eventStartsAt))}</td>
          </tr>
          <tr>
            <td style="border-bottom: 1px solid #e9ddc9; padding: 8px 10px; font-weight: 700;">Arrangør</td>
            <td style="border-bottom: 1px solid #e9ddc9; padding: 8px 10px;">${escapeHtml(input.facilitatorName)}</td>
          </tr>
        </tbody>
      </table>
      ${
        input.status === "confirmed" && input.eventUrl
          ? `<p style="margin: 24px 0 0;"><a href="${escapeHtml(input.eventUrl)}" style="display: inline-block; border-radius: 999px; background: #4b5645; color: #ffffff; font-weight: 700; padding: 12px 20px; text-decoration: none;">Se eventet</a></p>`
          : ""
      }
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
    `Arrangør: ${input.facilitatorName}`,
    input.status === "confirmed" && input.eventUrl ? `Eventlink: ${input.eventUrl}` : "",
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
