import { renderEmailButton, renderEmailLayout, renderPlainTextFooter } from "@/lib/email/email-layout";
import { escapeHtml, sendLoggedEmail } from "@/lib/email/resend-mail";

type EmailChangeSecurityNoticeInput = {
  newEmail: string;
  oldEmail: string;
  recipientName?: string | null;
  requestedBy: "admin" | "facilitator";
};

type EmailChangeConfirmationInput = {
  actionUrl: string;
  newEmail: string;
  recipientName?: string | null;
};

export async function sendEmailChangeSecurityNotice(input: EmailChangeSecurityNoticeInput) {
  const greeting = input.recipientName ? `Kære ${escapeHtml(input.recipientName)}` : "Hej";
  const requesterText =
    input.requestedBy === "admin"
      ? "SoulEvents administration har startet en ændring af login- og kontaktmailen på din konto."
      : "Der er anmodet om at ændre login- og kontaktmailen på din SoulEvents-konto.";

  const html = await renderEmailLayout({
    title: "Ændring af mailadresse",
    children: `
      <p>${greeting}</p>
      <p>${escapeHtml(requesterText)}</p>
      <p>Den gamle adresse forbliver aktiv, indtil den nye adresse er bekræftet.</p>
      <p><strong>Ny mailadresse:</strong> ${escapeHtml(input.newEmail)}</p>
      <p>Hvis du ikke har forventet denne ændring, så kontakt SoulEvents med det samme.</p>
    `,
  });

  const text = [
    greeting,
    "",
    requesterText,
    "Den gamle adresse forbliver aktiv, indtil den nye adresse er bekræftet.",
    `Ny mailadresse: ${input.newEmail}`,
    "",
    "Hvis du ikke har forventet denne ændring, så kontakt SoulEvents med det samme.",
    "",
    ...renderPlainTextFooter(),
  ].join("\n");

  return sendLoggedEmail({
    html,
    subject: "Ændring af din SoulEvents-mail",
    text,
    to: input.oldEmail,
    type: "email_change_security_notice",
  });
}

export async function sendAdminEmailChangeConfirmation(input: EmailChangeConfirmationInput) {
  const greeting = input.recipientName ? `Kære ${escapeHtml(input.recipientName)}` : "Hej";
  const html = await renderEmailLayout({
    title: "Bekræft ny mailadresse",
    children: `
      <p>${greeting}</p>
      <p>SoulEvents administration har startet en ændring af login- og kontaktmailen på din konto.</p>
      <p>Bekræft kun ændringen, hvis du selv har aftalt den med SoulEvents.</p>
      <p><strong>Ny mailadresse:</strong> ${escapeHtml(input.newEmail)}</p>
      ${renderEmailButton(input.actionUrl, "Bekræft ny mailadresse")}
      <p>Hvis du ikke har forventet denne mail, kan du ignorere den og kontakte SoulEvents.</p>
    `,
  });

  const text = [
    greeting,
    "",
    "SoulEvents administration har startet en ændring af login- og kontaktmailen på din konto.",
    "Bekræft kun ændringen, hvis du selv har aftalt den med SoulEvents.",
    `Ny mailadresse: ${input.newEmail}`,
    "",
    "Brug knappen i HTML-versionen af denne mail til at bekræfte ændringen.",
    "Hvis du ikke har forventet denne mail, kan du ignorere den og kontakte SoulEvents.",
    "",
    ...renderPlainTextFooter(),
  ].join("\n");

  return sendLoggedEmail({
    html,
    subject: "Bekræft ny mailadresse på SoulEvents",
    text,
    to: input.newEmail,
    type: "email_change_confirmation",
  });
}
