import { renderEmailLayout, renderPlainTextFooter } from "@/lib/email/email-layout";
import { escapeHtml, sendLoggedEmail } from "@/lib/email/resend-mail";

type FacilitatorProfileDeactivatedInput = {
  adminMessage?: string | null;
  facilitatorEmail?: string | null;
  facilitatorName: string;
};

function buildText(input: FacilitatorProfileDeactivatedInput) {
  return [
    "Din arrangørprofil er deaktiveret",
    "",
    `Hej ${input.facilitatorName}`,
    "",
    "SoulEvents har deaktiveret din arrangørprofil. Det betyder, at arrangørområdet ikke længere er tilgængeligt, og profilen kan ikke offentliggøres eller bruges til at oprette events.",
    ...(input.adminMessage
      ? [
          "",
          "Besked fra SoulEvents",
          input.adminMessage,
        ]
      : []),
    "",
    "Hvis du har spørgsmål til beslutningen, er du velkommen til at kontakte os på hej@soulevents.dk.",
    ...renderPlainTextFooter(),
  ].join("\n");
}

export async function sendFacilitatorProfileDeactivatedEmail(input: FacilitatorProfileDeactivatedInput) {
  if (!input.facilitatorEmail) {
    return false;
  }

  const adminMessage = input.adminMessage?.trim() || null;
  const html = await renderEmailLayout({
    title: "Din arrangørprofil er deaktiveret",
    children: [
      `<p>Hej ${escapeHtml(input.facilitatorName)}</p>`,
      "<p>SoulEvents har deaktiveret din arrangørprofil. Det betyder, at arrangørområdet ikke længere er tilgængeligt, og profilen kan ikke offentliggøres eller bruges til at oprette events.</p>",
      adminMessage
        ? [
            '<div style="margin: 18px 0; border-radius: 16px; background: #FFF7E8; border: 1px solid #E8D6A8; padding: 14px 16px;">',
            '<p style="margin: 0 0 8px; font-weight: 700; color: #6F5A35;">Besked fra SoulEvents</p>',
            '<p style="margin: 0; color: #2F2633; white-space: pre-line;">' + escapeHtml(adminMessage) + "</p>",
            "</div>",
          ].join("")
        : "",
      '<p>Hvis du har spørgsmål til beslutningen, er du velkommen til at kontakte os på <a href="mailto:hej@soulevents.dk" style="color: #6F5A35;">hej@soulevents.dk</a>.</p>',
    ].join(""),
  });

  return sendLoggedEmail({
    type: "facilitator_profile_deactivated",
    to: input.facilitatorEmail,
    subject: "Din arrangørprofil på SoulEvents er deaktiveret",
    html,
    text: buildText({ ...input, adminMessage }),
  });
}
