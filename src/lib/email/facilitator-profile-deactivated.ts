import { renderEmailLayout, renderPlainTextFooter } from "@/lib/email/email-layout";
import { escapeHtml, sendLoggedEmail } from "@/lib/email/resend-mail";

type FacilitatorProfileDeactivatedInput = {
  adminMessage?: string | null;
  facilitatorEmail?: string | null;
  facilitatorName: string;
  reason?: string | null;
  variant?: "active_deactivated" | "pending_not_approved";
};

function mailCopy(input: FacilitatorProfileDeactivatedInput) {
  if (input.variant === "pending_not_approved") {
    return {
      body: [
        "Tak fordi du har oprettet en arrangørprofil på SoulEvents.",
        "Vi har nu gennemgået din profil, og vi har desværre valgt ikke at godkende den på nuværende tidspunkt.",
        "SoulEvents er skabt som en platform for events og arrangører, der passer ind i vores formål og retningslinjer. Beslutningen er ikke nødvendigvis en vurdering af dig eller dit arbejde, men handler om, hvorvidt profilen passer til platformens nuværende rammer.",
      ],
      subject: "Vedrørende din arrangørprofil på SoulEvents",
      title: "Vedrørende din arrangørprofil på SoulEvents",
    };
  }

  return {
    body: [
      "Din arrangørprofil på SoulEvents er blevet deaktiveret.",
      "Det betyder, at profilen og dine events ikke længere er offentligt synlige, og at du ikke kan bruge arrangørdashboardet, før profilen eventuelt bliver genaktiveret.",
      "Historik, events og tilmeldinger er bevaret.",
    ],
    subject: "Din arrangørprofil på SoulEvents er blevet deaktiveret",
    title: "Din arrangørprofil er blevet deaktiveret",
  };
}

function buildText(input: FacilitatorProfileDeactivatedInput) {
  const copy = mailCopy(input);
  const reason = input.reason?.trim() || null;
  const adminMessage = input.adminMessage?.trim() || null;

  return [
    copy.title,
    "",
    `Hej ${input.facilitatorName}`,
    "",
    ...copy.body,
    ...(reason
      ? [
          "",
          "Årsag",
          reason,
        ]
      : []),
    ...(adminMessage
      ? [
          "",
          "Besked fra SoulEvents",
          adminMessage,
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
  const reason = input.reason?.trim() || null;
  const copy = mailCopy(input);
  const html = await renderEmailLayout({
    title: copy.title,
    children: [
      `<p>Hej ${escapeHtml(input.facilitatorName)}</p>`,
      copy.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join(""),
      reason
        ? [
            '<div style="margin: 18px 0; border-radius: 16px; background: #F7F2FB; border: 1px solid #D8CBE4; padding: 14px 16px;">',
            '<p style="margin: 0 0 8px; font-weight: 700; color: #5F4678;">Årsag</p>',
            '<p style="margin: 0; color: #2F2633; white-space: pre-line;">' + escapeHtml(reason) + "</p>",
            "</div>",
          ].join("")
        : "",
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
    subject: copy.subject,
    html,
    text: buildText({ ...input, adminMessage, reason }),
  });
}
