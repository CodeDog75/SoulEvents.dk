import { renderEmailButton, renderEmailLayout, renderEmailTable, renderPlainTextFooter } from "@/lib/email/email-layout";
import { escapeHtml, formatDate, sendLoggedEmail } from "@/lib/email/resend-mail";
import { formatPaymentAmount, formatPaymentDate, type PaymentInstructionsSnapshot } from "@/lib/payment-instructions";
import type { BookingStatus } from "@/types/database";

type ParticipantBookingResponseInput = {
  bookingId: string;
  calendarUrl?: string | null;
  cancelUrl?: string | null;
  eventId: string;
  status: BookingStatus;
  participantEmail: string;
  participantName: string;
  seats?: number | null;
  eventTitle: string;
  eventStartsAt: string;
  facilitatorName: string;
  eventUrl?: string | null;
  isDirectRegistration?: boolean;
  paymentInstructions?: PaymentInstructionsSnapshot | null;
};

type ParticipantBookingSeatsUpdatedInput = {
  bookingId: string;
  bookingReference: string | null;
  eventId: string;
  participantEmail: string;
  participantName: string;
  previousSeats: number;
  nextSeats: number;
  pricePerSeatCents: number;
  nextBookingValueCents: number;
  eventTitle: string;
  eventStartsAt: string;
  facilitatorName: string;
  paymentInstructions?: PaymentInstructionsSnapshot | null;
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

function buildPaymentHtml(snapshot?: PaymentInstructionsSnapshot | null) {
  if (!snapshot) {
    return "";
  }

  const dueDate = formatPaymentDate(snapshot.dueAt);
  const methodHeading = snapshot.methods.length > 1 ? "Vælg én af følgende betalingsmuligheder" : "Betalingsmulighed";

  return `
    <div style="margin: 22px 0 0; border-radius: 22px; background: #EEF7F0; padding: 18px;">
      <p style="margin: 0 0 8px; color: #4F654A; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">Betaling</p>
      <p style="margin: 0 0 10px; color: #2D2338; font-size: 16px; font-weight: 700;">Beløb: ${escapeHtml(formatPaymentAmount(snapshot.amountCents))}</p>
      <p style="margin: 0 0 10px; color: #4F654A; font-size: 14px; font-weight: 700;">Betalingsreference: ${escapeHtml(snapshot.reference)}</p>
      ${dueDate ? `<p style="margin: 0 0 14px; color: #4F654A; font-size: 14px;">Betalingsfrist: ${escapeHtml(dueDate)}</p>` : ""}
      ${
        snapshot.methods.length > 0
          ? `<p style="margin: 0 0 8px; color: #2D2338; font-size: 14px; font-weight: 700;">${methodHeading}</p>
             <ul style="margin: 0 0 12px; padding-left: 20px; color: #2D2338; font-size: 14px; line-height: 1.7;">
               ${snapshot.methods
                 .map((method) => {
                   const value =
                     method.url && method.type === "external_link"
                       ? `<a href="${escapeHtml(method.url)}" style="color: #7A4EAB; font-weight: 700;">${escapeHtml(method.value)}</a>`
                       : escapeHtml(method.value);
                   return `<li><strong>${escapeHtml(method.label)}:</strong> ${value}</li>`;
                 })
                 .join("")}
             </ul>`
          : ""
      }
      ${snapshot.note ? `<p style="margin: 0 0 12px; color: #2D2338; font-size: 14px; line-height: 1.7;">${escapeHtml(snapshot.note)}</p>` : ""}
      <p style="margin: 0; color: #4F654A; font-size: 12px; line-height: 1.6;">${escapeHtml(snapshot.disclaimer)}</p>
    </div>
  `;
}

function buildPaymentText(snapshot?: PaymentInstructionsSnapshot | null) {
  if (!snapshot) {
    return [];
  }

  const dueDate = formatPaymentDate(snapshot.dueAt);
  const lines = [
    "",
    "Betaling",
    `Beløb: ${formatPaymentAmount(snapshot.amountCents)}`,
    `Betalingsreference: ${snapshot.reference}`,
    dueDate ? `Betalingsfrist: ${dueDate}` : "",
    snapshot.methods.length > 1 ? "Vælg én af følgende betalingsmuligheder:" : snapshot.methods.length === 1 ? "Betalingsmulighed:" : "",
    ...snapshot.methods.map((method) => `${method.label}: ${method.value}`),
    snapshot.note ? `Note: ${snapshot.note}` : "",
    snapshot.disclaimer,
  ];

  return lines.filter(Boolean);
}

function getBody(input: ParticipantBookingResponseInput) {
  if (input.status !== "confirmed") {
    return statusText[input.status]?.body ?? "Der er nyt om din tilmelding.";
  }

  const seatsLabel = formatSeats(input.seats);

  if (input.isDirectRegistration) {
    return seatsLabel
      ? `Din tilmelding til ${seatsLabel} er registreret. Betaling håndteres direkte mellem dig og arrangøren.`
      : "Din tilmelding er registreret. Betaling håndteres direkte mellem dig og arrangøren.";
  }

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
    title: input.status === "confirmed" && input.isDirectRegistration ? "Din tilmelding er registreret" : (copy?.headline ?? "Status på tilmelding"),
    children: `
      <p style="margin: 0 0 16px;">Hej ${escapeHtml(input.participantName)}</p>
      <p style="margin: 0 0 20px;">${escapeHtml(getBody(input))}</p>
      ${renderEmailTable(rows)}
      ${input.status === "confirmed" ? buildPaymentHtml(input.paymentInstructions) : ""}
      ${
        input.status === "confirmed" && input.calendarUrl
          ? renderEmailButton(input.calendarUrl, "Tilføj til kalender")
          : ""
      }
      ${
        input.status === "confirmed" && input.eventUrl
          ? '<p style="margin: 18px 0 0;"><a href="' + escapeHtml(input.eventUrl) + '" style="color: #7A4EAB; font-weight: 700;">Se eventet på SoulEvents</a></p>'
          : ""
      }
      ${
        input.status === "confirmed" && input.cancelUrl
          ? '<p style="margin: 18px 0 0; color: #6E6475;">Kan du ikke deltage? <a href="' + escapeHtml(input.cancelUrl) + '" style="color: #7A4EAB; font-weight: 700;">Afmeld din tilmelding</a></p>'
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
    ...(input.status === "confirmed" ? buildPaymentText(input.paymentInstructions) : []),
    input.status === "confirmed" && input.calendarUrl ? `Tilføj til kalender: ${input.calendarUrl}` : "",
    input.status === "confirmed" && input.eventUrl ? `Eventlink: ${input.eventUrl}` : "",
    input.status === "confirmed" && input.cancelUrl ? `Afmeld tilmelding: ${input.cancelUrl}` : "",
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
    input.status === "confirmed" && input.isDirectRegistration && seatsLabel
      ? `Din tilmelding til ${seatsLabel} er registreret`
      : input.status === "confirmed" && input.isDirectRegistration
        ? "Din tilmelding er registreret"
        : input.status === "confirmed" && seatsLabel
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

async function buildSeatsUpdatedHtml(input: ParticipantBookingSeatsUpdatedInput) {
  const rows: Array<[string, string]> = [
    ["Event", input.eventTitle],
    ["Dato", formatDate(input.eventStartsAt)],
    ["Tidligere antal deltagere", formatSeats(input.previousSeats) ?? `${input.previousSeats}`],
    ["Nyt antal deltagere", formatSeats(input.nextSeats) ?? `${input.nextSeats}`],
    ["Pris pr. deltager", formatPaymentAmount(input.pricePerSeatCents)],
    ["Ny samlet pris", formatPaymentAmount(input.nextBookingValueCents)],
    ...(input.bookingReference ? [["Bookingreference", input.bookingReference] as [string, string]] : []),
    ["Arrangør", input.facilitatorName],
  ];

  return renderEmailLayout({
    title: "Din tilmelding er blevet opdateret",
    children: `
      <p style="margin: 0 0 16px;">Hej ${escapeHtml(input.participantName)}</p>
      <p style="margin: 0 0 20px;">Din tilmelding til <strong>${escapeHtml(input.eventTitle)}</strong> er blevet opdateret.</p>
      <p style="margin: 0 0 20px;">Antallet af deltagere er ændret fra <strong>${escapeHtml(String(input.previousSeats))}</strong> til <strong>${escapeHtml(String(input.nextSeats))}</strong>.</p>
      ${renderEmailTable(rows)}
      ${buildPaymentHtml(input.paymentInstructions)}
    `,
  });
}

function buildSeatsUpdatedText(input: ParticipantBookingSeatsUpdatedInput) {
  return [
    "Din tilmelding er blevet opdateret",
    "",
    `Hej ${input.participantName}`,
    "",
    `Din tilmelding til ${input.eventTitle} er blevet opdateret.`,
    `Antallet af deltagere er ændret fra ${input.previousSeats} til ${input.nextSeats}.`,
    "",
    `Event: ${input.eventTitle}`,
    `Dato: ${formatDate(input.eventStartsAt)}`,
    `Tidligere antal deltagere: ${formatSeats(input.previousSeats) ?? input.previousSeats}`,
    `Nyt antal deltagere: ${formatSeats(input.nextSeats) ?? input.nextSeats}`,
    `Pris pr. deltager: ${formatPaymentAmount(input.pricePerSeatCents)}`,
    `Ny samlet pris: ${formatPaymentAmount(input.nextBookingValueCents)}`,
    input.bookingReference ? `Bookingreference: ${input.bookingReference}` : "",
    `Arrangør: ${input.facilitatorName}`,
    ...buildPaymentText(input.paymentInstructions),
    ...renderPlainTextFooter(),
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendParticipantBookingSeatsUpdated(input: ParticipantBookingSeatsUpdatedInput) {
  return sendLoggedEmail({
    type: "booking_seats_updated_participant",
    to: input.participantEmail,
    subject: `Din tilmelding er opdateret: ${input.eventTitle}`,
    html: await buildSeatsUpdatedHtml(input),
    text: buildSeatsUpdatedText(input),
    bookingId: input.bookingId,
    eventId: input.eventId,
  });
}
