import { escapeHtml } from "@/lib/email/resend-mail";
import { getEmailBrandLogoUrl } from "@/lib/brand-logo";

const footerText = "Et fælles sted for nærvær, udvikling og meningsfulde oplevelser.";

type EmailLayoutInput = {
  children: string;
  logoUrl?: string;
  title: string;
};

export async function renderEmailLayout(input: EmailLayoutInput) {
  const logoUrl = input.logoUrl ?? (await getEmailBrandLogoUrl());

  return `
    <div style="margin: 0; padding: 0; background: #F7F2FB; font-family: Arial, sans-serif; color: #2F2633;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; background: #F7F2FB;">
        <tbody>
          <tr>
            <td style="padding: 28px 14px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; max-width: 640px; margin: 0 auto;">
                <tbody>
                  <tr>
                    <td style="padding: 0 0 14px; text-align: center;">
                      <img src="${escapeHtml(logoUrl)}" alt="SoulEvents" width="220" height="66" style="display: block; width: 210px; max-width: 100%; height: auto; margin: 0 auto; border: 0; outline: none; text-decoration: none;" />
                    </td>
                  </tr>
                  <tr>
                    <td style="background: #ffffff; border-radius: 24px; padding: 28px; line-height: 1.6; box-shadow: 0 10px 30px rgba(47, 38, 51, 0.06);">
                      <h1 style="margin: 0 0 16px; color: #2F2633; font-size: 24px; line-height: 1.25; font-weight: 700;">${escapeHtml(input.title)}</h1>
                      ${input.children}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 18px 8px 0; color: #6E6475; font-size: 13px; line-height: 1.6; text-align: center;">
                      <div>Kærlige hilsner<br><strong style="color: #7A4EAB;">SoulEvents 💜</strong></div>
                      <div style="margin-top: 8px;">${escapeHtml(footerText)}</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

export function renderEmailTable(rows: Array<[string, string]>) {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse: collapse; width: 100%; margin: 20px 0 0;">
      <tbody>
        ${rows
          .map(
            ([label, value]) => `
              <tr>
                <td style="border-bottom: 1px solid #E9DFF2; padding: 10px 8px 10px 0; color: #2F2633; font-weight: 700; vertical-align: top;">${escapeHtml(label)}</td>
                <td style="border-bottom: 1px solid #E9DFF2; padding: 10px 0 10px 8px; color: #2F2633; vertical-align: top;">${escapeHtml(value)}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

export function renderEmailButton(href: string, label: string) {
  return `
    <p style="margin: 24px 0 0;">
      <a href="${escapeHtml(href)}" style="display: inline-block; border-radius: 999px; background: #7A4EAB; color: #ffffff; font-weight: 700; padding: 12px 22px; text-decoration: none;">${escapeHtml(label)}</a>
    </p>
  `;
}

export function renderPlainTextFooter() {
  return ["", "Kærlige hilsner", "SoulEvents 💜", "", footerText];
}
