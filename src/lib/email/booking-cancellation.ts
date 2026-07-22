import { renderEmailLayout, renderEmailTable, renderPlainTextFooter } from "@/lib/email/email-layout";
import { escapeHtml, formatDate, sendLoggedEmail } from "@/lib/email/resend-mail";

type ParticipantCancellationInput = {
  bookingId: string;
  eventId: string;
  eventStartsAt: string;
  eventTitle: string;
  participantEmail: string;
  participantName: string;
  seats: number;
};

type FacilitatorCancellationInput = ParticipantCancellationInput & {
  facilitatorEmail: string | null;
};

function formatSeats(seats: number) {
  return seats === 1 ? "1 plads" : `${seats} pladser`;
}

async function participantHtml(input: ParticipantCancellationInput) {
  return renderEmailLayout({
    title: "Din tilmelding er afmeldt",
    children: `
      <p style="margin: 0 0 16px;">Hej ${escapeHtml(input.participantName)}</p>
      <p style="margin: 0 0 18px;">Din tilmelding til <strong>${escapeHtml(input.eventTitle)}</strong> er nu afmeldt.</p>
      ${renderEmailTable([
        ["Event", input.eventTitle],
        ["Dato", formatDate(input.eventStartsAt)],
        ["Antal pladser", formatSeats(input.seats)],
      ])}
      <p style="margin: 20px 0 0;">Arrangøren har fået besked.</p>
    `,
  });
}

function participantText(input: ParticipantCancellationInput) {
  return [
    "Din tilmelding er afmeldt",
    "",
    `Hej ${input.participantName}`,
    "",
    `Din tilmelding til ${input.eventTitle} er nu afmeldt.`,
    "",
    `Event: ${input.eventTitle}`,
    `Dato: ${formatDate(input.eventStartsAt)}`,
    `Antal pladser: ${formatSeats(input.seats)}`,
    "",
    "Arrangøren har fået besked.",
    ...renderPlainTextFooter(),
  ].join("\n");
}

async function facilitatorHtml(input: FacilitatorCancellationInput) {
  return renderEmailLayout({
    title: "En deltager har afmeldt sin tilmelding",
    children: `
      <p style="margin: 0 0 16px;">${escapeHtml(input.participantName)} har afmeldt sin tilmelding.</p>
      ${renderEmailTable([
        ["Deltager", input.participantName],
        ["Event", input.eventTitle],
        ["Dato", formatDate(input.eventStartsAt)],
        ["Antal pladser", formatSeats(input.seats)],
      ])}
    `,
  });
}

function facilitatorText(input: FacilitatorCancellationInput) {
  return [
    "En deltager har afmeldt sin tilmelding",
    "",
    `${input.participantName} har afmeldt sin tilmelding.`,
    "",
    `Deltager: ${input.participantName}`,
    `Event: ${input.eventTitle}`,
    `Dato: ${formatDate(input.eventStartsAt)}`,
    `Antal pladser: ${formatSeats(input.seats)}`,
    ...renderPlainTextFooter(),
  ].join("\n");
}

export async function sendParticipantBookingCancellation(input: ParticipantCancellationInput) {
  return sendLoggedEmail({
    type: "booking_cancelled_by_participant_confirmation",
    to: input.participantEmail,
    subject: "Din tilmelding er afmeldt",
    html: await participantHtml(input),
    text: participantText(input),
    bookingId: input.bookingId,
    eventId: input.eventId,
  });
}

export async function sendFacilitatorBookingCancellation(input: FacilitatorCancellationInput) {
  return sendLoggedEmail({
    type: "booking_cancelled_by_participant_facilitator",
    to: input.facilitatorEmail,
    subject: "En deltager har afmeldt sin tilmelding",
    html: await facilitatorHtml(input),
    text: facilitatorText(input),
    bookingId: input.bookingId,
    eventId: input.eventId,
  });
}
