import { renderEmailLayout, renderEmailTable, renderPlainTextFooter } from "@/lib/email/email-layout";
import { escapeHtml, formatDate, sendLoggedEmail } from "@/lib/email/resend-mail";
import { formatPaymentAmount, formatPaymentDate, type PaymentInstructionsSnapshot } from "@/lib/payment-instructions";

type BookingPaymentReminderInput = {
  bookingId: string;
  eventId: string;
  participantEmail: string;
  participantName: string;
  seats: number;
  eventTitle: string;
  eventStartsAt: string;
  facilitatorName: string;
  paymentInstructions: PaymentInstructionsSnapshot;
};

function formatSeats(seats: number) {
  return seats === 1 ? "1 plads" : `${seats} pladser`;
}

function buildPaymentMethodsHtml(snapshot: PaymentInstructionsSnapshot) {
  if (snapshot.methods.length === 0) {
    return snapshot.note
      ? `<p style="margin: 0; color: #2D2338; font-size: 14px; line-height: 1.7;">${escapeHtml(snapshot.note)}</p>`
      : "";
  }

  return `
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
    </ul>
    ${snapshot.note ? `<p style="margin: 0 0 12px; color: #2D2338; font-size: 14px; line-height: 1.7;">${escapeHtml(snapshot.note)}</p>` : ""}
  `;
}

async function buildHtml(input: BookingPaymentReminderInput) {
  const dueDate = formatPaymentDate(input.paymentInstructions.dueAt);
  const rows: Array<[string, string]> = [
    ["Event", input.eventTitle],
    ["Dato", formatDate(input.eventStartsAt)],
    ["Pladser", formatSeats(input.seats)],
    ["Bookingværdi", formatPaymentAmount(input.paymentInstructions.amountCents)],
    ["Reference", input.paymentInstructions.reference],
    ...(dueDate ? [["Betalingsfrist", dueDate] as [string, string]] : []),
  ];

  return renderEmailLayout({
    title: "Påmindelse om betaling",
    children: `
      <p style="margin: 0 0 16px;">Kære ${escapeHtml(input.participantName)}</p>
      <p style="margin: 0 0 20px;">Dette er en venlig påmindelse om betaling for din tilmelding.</p>
      ${renderEmailTable(rows)}
      <div style="margin: 22px 0 0; border-radius: 22px; background: #EEF7F0; padding: 18px;">
        <p style="margin: 0 0 8px; color: #4F654A; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">Betalingsmuligheder</p>
        ${buildPaymentMethodsHtml(input.paymentInstructions)}
        <p style="margin: 0; color: #4F654A; font-size: 12px; line-height: 1.6;">${escapeHtml(input.paymentInstructions.disclaimer)}</p>
      </div>
      <p style="margin: 22px 0 0;">De bedste hilsner<br><strong>${escapeHtml(input.facilitatorName)}</strong><br>via SoulEvents</p>
    `,
  });
}

function buildText(input: BookingPaymentReminderInput) {
  const dueDate = formatPaymentDate(input.paymentInstructions.dueAt);

  return [
    "Påmindelse om betaling",
    "",
    `Kære ${input.participantName}`,
    "",
    "Dette er en venlig påmindelse om betaling for din tilmelding til:",
    "",
    input.eventTitle,
    formatDate(input.eventStartsAt),
    formatSeats(input.seats),
    `Bookingværdi: ${formatPaymentAmount(input.paymentInstructions.amountCents)}`,
    dueDate ? `Betalingsfrist: ${dueDate}` : "",
    `Reference: ${input.paymentInstructions.reference}`,
    "",
    "Betalingsmuligheder:",
    ...input.paymentInstructions.methods.map((method) => `${method.label}: ${method.value}`),
    input.paymentInstructions.note ? input.paymentInstructions.note : "",
    "",
    input.paymentInstructions.disclaimer,
    "",
    "De bedste hilsner",
    input.facilitatorName,
    "via SoulEvents",
    ...renderPlainTextFooter(),
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendBookingPaymentReminder(input: BookingPaymentReminderInput) {
  return sendLoggedEmail({
    type: "booking_payment_reminder_participant",
    to: input.participantEmail,
    subject: `Påmindelse om betaling – ${input.eventTitle}`,
    html: await buildHtml(input),
    text: buildText(input),
    bookingId: input.bookingId,
    eventId: input.eventId,
  });
}
