import { renderEmailButton, renderEmailLayout, renderPlainTextFooter } from "@/lib/email/email-layout";
import { escapeHtml, sendLoggedEmail } from "@/lib/email/resend-mail";

type OauthPasswordSetupEmailInput = {
  actionUrl: string;
  email: string;
  providerLabels: string[];
};

function providerText(providers: string[]) {
  if (providers.length === 0) return "Facebook eller Google";
  if (providers.length === 1) return providers[0];

  const last = providers.at(-1);
  return `${providers.slice(0, -1).join(", ")} eller ${last}`;
}

export async function sendOauthPasswordSetupEmail(input: OauthPasswordSetupEmailInput) {
  const providers = providerText(input.providerLabels);
  const html = await renderEmailLayout({
    title: "Opret en personlig adgangskode",
    children: `
      <p style="margin: 0; color: #4B5645; font-size: 16px; line-height: 1.7;">
        Din SoulEvents-profil er oprettet med ${escapeHtml(providers)}, og du har derfor ikke en personlig adgangskode endnu.
      </p>
      <p style="margin: 14px 0 0; color: #4B5645; font-size: 16px; line-height: 1.7;">
        Du kan fortsat logge ind med din nuværende loginmetode eller oprette en personlig adgangskode via linket nedenfor.
      </p>
      ${renderEmailButton(input.actionUrl, "Opret adgangskode")}
      <p style="margin: 24px 0 0; color: #6E6475; font-size: 14px; line-height: 1.7;">
        Hvis knappen ikke virker, kan du kopiere linket her:
      </p>
      <p style="margin: 8px 0 0; color: #6E6475; font-size: 12px; line-height: 1.6; word-break: break-all;">
        ${escapeHtml(input.actionUrl)}
      </p>
      <p style="margin: 24px 0 0; color: #6E6475; font-size: 14px; line-height: 1.7;">
        Hvis du ikke har bedt om dette, kan du se bort fra denne e-mail.
      </p>
    `,
  });

  const text = [
    "Opret en personlig adgangskode",
    "",
    `Din SoulEvents-profil er oprettet med ${providers}, og du har derfor ikke en personlig adgangskode endnu.`,
    "Du kan fortsat logge ind med din nuværende loginmetode eller oprette en personlig adgangskode via linket nedenfor.",
    "",
    input.actionUrl,
    "",
    "Hvis du ikke har bedt om dette, kan du se bort fra denne e-mail.",
    ...renderPlainTextFooter(),
  ].join("\n");

  return sendLoggedEmail({
    html,
    subject: "Opret en personlig adgangskode",
    text,
    to: input.email,
    type: "oauth_password_setup",
  });
}
