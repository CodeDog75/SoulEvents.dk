import { renderEmailButton, renderEmailLayout, renderPlainTextFooter } from "@/lib/email/email-layout";
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
  participantMessage?: string | null;
  registrationMode?: "direct" | "approval_required";
  seats: number;
};

function formatSeats(seats: number) {
  return seats === 1 ? "1 plads" : `${seats} pladser`;
}

async function buildHtml(input: BookingNotificationInput) {
  const rows: Array<[string, string]> = [
    ["Event", input.eventTitle],
    ["Dato", formatDate(input.eventStartsAt)],
    [input.registrationMode === "direct" ? "Antal tilmeldte pladser" : "Antal reserverede pladser", formatSeats(input.seats)],
  ];
  const isDirect = input.registrationMode === "direct";
  const heading = `${input.participantName} har ${isDirect ? "tilmeldt sig" : "reserveret"} ${formatSeats(input.seats)}`;

  return renderEmailLayout({
    title: heading,
    children: `
      <p style="margin: -6px 0 16px; color: #6E6475; font-size: 16px; font-weight: 700;">til ${escapeHtml(input.eventTitle)}</p>
      <p style="margin: 0 0 12px;">Du har modtaget en ny ${isDirect ? "tilmelding" : "reservationsforespørgsel"}.</p>
      ${
        isDirect
          ? '<p style="margin: 0 0 18px; color: #2F2633; font-size: 17px; font-weight: 800;">Tilmeldingen er registreret med det samme.</p><p style="margin: 0 0 18px;">Betaling håndteres uden for SoulEvents og kan markeres manuelt i deltageroversigten.</p>'
          : '<p style="margin: 0 0 18px; color: #2F2633; font-size: 17px; font-weight: 800;">Tilmeldingen er endnu ikke gyldig.</p><p style="margin: 0 0 18px;">Den bliver først endeligt bekræftet, når du aktivt godkender den i SoulEvents.</p>'
      }
      <div style="margin: 20px 0 0; border-radius: 16px; background: #F7F2FB; padding: 16px;">
        ${rows
          .map(
            ([label, value]) => `
              <p style="margin: 0 0 10px; color: #4A4050;">
                <span style="display: block; color: #2F2633; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;">${escapeHtml(label)}</span>
                <span style="font-size: 16px; font-weight: 700;">${escapeHtml(value)}</span>
              </p>
            `,
          )
          .join("")}
      </div>
      ${renderEmailButton(input.bookingsUrl, isDirect ? "Se tilmelding" : "Bekræft tilmelding")}
    `,
  });
}

function buildText(input: BookingNotificationInput) {
  const heading = `${input.participantName} har reserveret ${formatSeats(input.seats)}`;
  const isDirect = input.registrationMode === "direct";
  return [
    isDirect ? `${input.participantName} har tilmeldt sig ${formatSeats(input.seats)}` : heading,
    `til ${input.eventTitle}`,
    "",
    `Du har modtaget en ny ${isDirect ? "tilmelding" : "reservationsforespørgsel"}.`,
    "",
    ...(isDirect
      ? ["Tilmeldingen er registreret med det samme.", "Betaling håndteres uden for SoulEvents og kan markeres manuelt i deltageroversigten."]
      : ["Tilmeldingen er endnu ikke gyldig.", "Den bliver først endeligt bekræftet, når du aktivt godkender den i SoulEvents."]),
    "",
    `Event: ${input.eventTitle}`,
    `Dato: ${formatDate(input.eventStartsAt)}`,
    `${isDirect ? "Antal tilmeldte pladser" : "Antal reserverede pladser"}: ${formatSeats(input.seats)}`,
    "",
    isDirect ? "Se tilmelding:" : "Bekræft tilmelding:",
    input.bookingsUrl,
    ...renderPlainTextFooter(),
  ].join("\n");
}

export async function sendBookingNotification(input: BookingNotificationInput) {
  const subject = `${input.registrationMode === "direct" ? "Ny tilmelding" : "Ny reservation"}: ${formatSeats(input.seats)} til ${input.eventTitle}`;

  return sendLoggedEmail({
    type: "booking_created_facilitator",
    to: input.facilitatorEmail,
    subject,
    html: await buildHtml(input),
    text: buildText(input),
    bookingId: input.bookingId,
    eventId: input.eventId,
  });
}
