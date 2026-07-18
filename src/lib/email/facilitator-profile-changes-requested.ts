import { renderEmailButton, renderEmailLayout, renderEmailTable, renderPlainTextFooter } from "@/lib/email/email-layout";
import { escapeHtml, sendLoggedEmail } from "@/lib/email/resend-mail";
import { env } from "@/lib/env";

type FacilitatorProfileChangesRequestedInput = {
  comment: string;
  facilitatorEmail: string | null;
  facilitatorName: string;
  fields: string[];
  profileEditUrl: string;
};

function buildText(input: FacilitatorProfileChangesRequestedInput) {
  return [
    "Din arrangørprofil kræver et par ændringer",
    "",
    "Tak fordi du har sendt din profil til SoulEvents.",
    "Vi vil meget gerne hjælpe dig videre. Vi har gennemgået profilen og beder dig rette et par punkter, før vi kan godkende den.",
    "",
    "Ret disse punkter:",
    ...input.fields.map((field) => "- " + field),
    "",
    "Kommentar fra SoulEvents:",
    input.comment,
    "",
    "Du kan rette oplysningerne og sende profilen til godkendelse igen.",
    "",
    "Ret profil:",
    input.profileEditUrl,
    ...renderPlainTextFooter(),
  ].join("\n");
}

export async function sendFacilitatorProfileChangesRequestedEmail(input: FacilitatorProfileChangesRequestedInput) {
  const html = await renderEmailLayout({
    title: "Din arrangørprofil kræver et par ændringer",
    children: [
      "<p>Tak fordi du har sendt din profil til SoulEvents.</p>",
      "<p>Vi vil meget gerne hjælpe dig videre. Vi har gennemgået profilen og beder dig rette et par punkter, før vi kan godkende den.</p>",
      '<div style="margin: 18px 0; border-radius: 16px; background: #FFF8E8; border: 1px solid #E8D6A8; padding: 14px 16px;">',
      '<p style="margin: 0 0 8px; font-weight: 700; color: #6F5A35;">Ret disse punkter</p>',
      '<ul style="margin: 0; padding-left: 18px; color: #2F2633;">' + input.fields.map((field) => "<li>" + escapeHtml(field) + "</li>").join("") + "</ul>",
      "</div>",
      '<div style="margin: 18px 0; border-radius: 16px; background: #F7F2FB; border: 1px solid #D8CBE4; padding: 14px 16px;">',
      '<p style="margin: 0 0 8px; font-weight: 700; color: #5F4678;">Kommentar fra SoulEvents</p>',
      '<p style="margin: 0; color: #2F2633; white-space: pre-line;">' + escapeHtml(input.comment) + "</p>",
      "</div>",
      renderEmailTable([["Profil", input.facilitatorName]]),
      "<p>Du kan rette oplysningerne og sende profilen til ny godkendelse. Vi hjælper dig gerne videre.</p>",
      renderEmailButton(input.profileEditUrl, "Ret min profil"),
    ].join(""),
  });

  return sendLoggedEmail({
    type: "facilitator_profile_changes_requested",
    to: input.facilitatorEmail,
    subject: "Din SoulEvents-profil kræver et par ændringer",
    html,
    text: buildText(input),
  });
}

export function facilitatorProfileEditUrl() {
  return `${env.appUrl || "http://localhost:3001"}/facilitator/profile`;
}
