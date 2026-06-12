import { escapeHtml, sendLoggedEmail } from "@/lib/email/resend-mail";
import { env } from "@/lib/env";

type FacilitatorProfileReadyInput = {
  adminEmail: string;
  facilitatorEmail: string;
  facilitatorName: string;
  profileUrl: string;
  submittedAt: string;
};

function formatSubmittedAt(value: string) {
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildHtml(input: FacilitatorProfileReadyInput) {
  const rows = [
    ["Navn", input.facilitatorName],
    ["E-mailadresse", input.facilitatorEmail],
    ["Dato og tidspunkt", formatSubmittedAt(input.submittedAt)],
  ];

  return `
    <div style="font-family: Arial, sans-serif; color: #4B5645; line-height: 1.5;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">Værtsprofil klar til godkendelse</h1>
      <p style="margin: 0 0 20px;">En vært har udfyldt minimumskravene og er klar til gennemgang.</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 620px;">
        <tbody>
          ${rows
            .map(
              ([label, value]) => `
                <tr>
                  <td style="border-bottom: 1px solid #D8C1A2; padding: 8px 10px; font-weight: 700;">${escapeHtml(label)}</td>
                  <td style="border-bottom: 1px solid #D8C1A2; padding: 8px 10px;">${escapeHtml(value)}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
      <p style="margin: 24px 0 0;">
        <a href="${escapeHtml(input.profileUrl)}" style="color: #D89A94; font-weight: 700;">Åbn profil til godkendelse</a>
      </p>
    </div>
  `;
}

function buildText(input: FacilitatorProfileReadyInput) {
  return [
    "Værtsprofil klar til godkendelse",
    "",
    `Navn: ${input.facilitatorName}`,
    `E-mailadresse: ${input.facilitatorEmail}`,
    `Link til profil: ${input.profileUrl}`,
    `Dato og tidspunkt: ${formatSubmittedAt(input.submittedAt)}`,
  ].join("\n");
}

export async function sendFacilitatorProfileReadyEmail(input: FacilitatorProfileReadyInput) {
  await sendLoggedEmail({
    type: "facilitator_profile_ready",
    to: input.adminEmail,
    replyTo: input.facilitatorEmail,
    subject: `Profil klar til godkendelse: ${input.facilitatorName}`,
    html: buildHtml(input),
    text: buildText(input),
  });
}

export function profileApprovalUrl() {
  return `${env.appUrl || "http://localhost:3001"}/admin?status=pending`;
}
