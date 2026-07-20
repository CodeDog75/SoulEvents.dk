import { getAppUrl } from "@/lib/app-url";
import { renderEmailButton, renderEmailLayout, renderEmailTable, renderPlainTextFooter } from "@/lib/email/email-layout";
import { formatDate, sendLoggedEmail } from "@/lib/email/resend-mail";

type FacilitatorProfileReadyInput = {
  adminEmail: string;
  facilitatorEmail: string;
  facilitatorName: string;
  profileUrl: string;
  submittedAt: string;
};

function formatSubmittedAt(value: string) {
  return formatDate(value);
}

async function buildHtml(input: FacilitatorProfileReadyInput) {
  const rows: Array<[string, string]> = [
    ["Navn", input.facilitatorName],
    ["E-mailadresse", input.facilitatorEmail],
    ["Dato og tidspunkt", formatSubmittedAt(input.submittedAt)],
  ];

  return renderEmailLayout({
    title: "Arrangørprofil klar til godkendelse",
    children: [
      '<p style="margin: 0 0 16px;">En arrangør har udfyldt minimumskravene og er klar til gennemgang.</p>',
      renderEmailTable(rows),
      renderEmailButton(input.profileUrl, "Åbn profil til godkendelse"),
    ].join(""),
  });
}

function buildText(input: FacilitatorProfileReadyInput) {
  return [
    "Arrangørprofil klar til godkendelse",
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
    html: await buildHtml(input),
    text: buildText(input),
  });
}

export function profileApprovalUrl() {
  return `${getAppUrl()}/admin?status=pending`;
}
