import { renderEmailButton, renderEmailLayout, renderEmailTable, renderPlainTextFooter } from "@/lib/email/email-layout";
import { escapeHtml, formatDate, sendLoggedEmail } from "@/lib/email/resend-mail";
import type { BookingStatus } from "@/types/database";

type ParticipantBookingResponseInput = {
  bookingId: string;
  eventId: string;
  status: BookingStatus;
  participantEmail: string;
  participantName: string;
  seats?: number | null;
  eventTitle: string;
  eventStartsAt: string;
  facilitatorName: string;
  eventUrl?: string | null;
};

const statusText: Partial<Record<BookingStatus, { subject: string; headline: string; body: string }>> = {
  confirmed: {
    subject: "Din tilmelding er bekræftet",
    headline: "Din tilmelding er bekræftet",
    body: "Arrangøren har nu bekræftet din tilmelding. Vi glæder os til, at du skal med.",
  },
  sold_out: {
    subject: "Eventet er udsolgt",
    headline: "Eventet er udsolgt",
    body: "Arrangøren har markeret eventet som udsolgt.",
  },
  cancelled: {
    subject: "Din tilmelding er blevet annulleret",
    headline: "Din tilmelding er blevet annulleret",
    body: "Arrangøren har annulleret din tilmelding. Eventet er ikke nødvendigvis aflyst.",
  },
};

function formatSeats(seats?: number | null) {
  if (!Number.isInteger(seats) || !seats || seats < 1) {
    return null;
  }

  return seats === 1 ? "1 plads" : `${seats} pladser`;
}

function getBody(input: ParticipantBookingResponseInput) {
  if (input.status !== "confirmed") {
    return statusText[input.status]?.body ?? "Der er nyt om din tilmelding.";
  }

  const seatsLabel = formatSeats(input.seats);

  return seatsLabel
    ? `Arrangøren har nu bekræftet din tilmelding til ${seatsLabel}.`
    : (statusText.confirmed?.body ?? "Arrangøren har nu bekræftet din tilmelding.");
}

async function buildHtml(input: ParticipantBookingResponseInput) {
  const copy = statusText[input.status] ?? statusText.confirmed;
  const seatsLabel = formatSeats(input.seats);
  const rows: Array<[string, string]> = [
    ["Event", input.eventTitle],
    ["Dato", formatDate(input.eventStartsAt)],
    ...(input.status === "confirmed" && seatsLabel ? [[input.seats === 1 ? "Bekræftet plads" : "Bekræftede pladser", seatsLabel]] as Array<[string, string]> : []),
    ["Arrangør", input.facilitatorName],
  ];

  return renderEmailLayout({
    title: copy?.headline ?? "Status på tilmelding",
    children: `
      <p style="margin: 0 0 16px;">Hej ${escapeHtml(input.participantName)}</p>
      <p style="margin: 0 0 20px;">${escapeHtml(getBody(input))}</p>
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
  const seatsLabel = formatSeats(input.seats);

  return [
    copy?.headline ?? "Status på tilmelding",
    "",
    `Hej ${input.participantName}`,
    getBody(input),
    "",
    `Event: ${input.eventTitle}`,
    `Dato: ${formatDate(input.eventStartsAt)}`,
    input.status === "confirmed" && seatsLabel ? `${input.seats === 1 ? "Bekræftet plads" : "Bekræftede pladser"}: ${seatsLabel}` : "",
    `Arrangør: ${input.facilitatorName}`,
    input.status === "confirmed" && input.eventUrl ? `Eventlink: ${input.eventUrl}` : "",
    ...renderPlainTextFooter(),
  ].join("\n");
}

export async function sendParticipantBookingResponse(input: ParticipantBookingResponseInput) {
  const copy = statusText[input.status];

  if (!copy) {
    return false;
  }

  const seatsLabel = formatSeats(input.seats);
  const subject =
    input.status === "confirmed" && seatsLabel
      ? `Din tilmelding til ${seatsLabel} er bekræftet`
      : copy.subject;

  return sendLoggedEmail({
    type: `booking_${input.status}_participant`,
    to: input.participantEmail,
    subject: `${subject}: ${input.eventTitle}`,
    html: await buildHtml(input),
    text: buildText(input),
    bookingId: input.bookingId,
    eventId: input.eventId,
  });
}
