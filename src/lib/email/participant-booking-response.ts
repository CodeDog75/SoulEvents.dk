import { renderEmailButton, renderEmailLayout, renderEmailTable, renderPlainTextFooter } from "@/lib/email/email-layout";
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

async function buildHtml(input: ParticipantBookingResponseInput) {
  const copy = statusText[input.status] ?? statusText.confirmed;
  const rows: Array<[string, string]> = [
    ["Event", input.eventTitle],
    ["Dato", formatDate(input.eventStartsAt)],
    ["Arrangør", input.facilitatorName],
  ];

  return renderEmailLayout({
    title: copy?.headline ?? "Status på tilmelding",
    children: `
      <p style="margin: 0 0 16px;">Hej ${escapeHtml(input.participantName)}</p>
      <p style="margin: 0 0 20px;">${escapeHtml(copy?.body ?? "Der er nyt om din tilmelding.")}</p>
      ${renderEmailTable(rows)}
      ${
        input.status === "confirmed" && input.eventUrl
          ? renderEmailButton(input.eventUrl, "Se eventet")
          : ""
      }
    `,
  });
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
    ...renderPlainTextFooter(),
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
    html: await buildHtml(input),
    text: buildText(input),
    bookingId: input.bookingId,
    eventId: input.eventId,
  });
}
