import { createHash, randomBytes } from "node:crypto";
import { getCanonicalAppUrl } from "@/lib/app-url";
import { escapeHtml } from "@/lib/email/resend-mail";

export const invitationTemplatePlaceholders = ["[navn]", "[personlig_indledning]", "[Bliv arrangør på SoulEvents]"] as const;

export const defaultInvitationSubject = "En varm invitation til SoulEvents";
export const defaultInvitationPreheader = "En personlig og uforpligtende invitation til at blive arrangør på SoulEvents.";
export const defaultInvitationButtonLabel = "Bliv arrangør på SoulEvents";
export const defaultInvitationButtonUrl = "/bliv-arrangoer";
export const defaultInvitationSignoff = "De bedste hilsner\nRasmus\nSoulEvents.dk";
export const defaultInvitationBody = `Kære [navn]

[personlig_indledning]

Jeg har fået øje på dit arbejde og vil gerne sende dig en personlig invitation til at blive en del af SoulEvents.

SoulEvents er en ny platform for spirituelle events, personlig udvikling, nærvær og fællesskab. Ambitionen er at skabe et roligt og inspirerende sted, hvor dygtige arrangører og deres events bliver præsenteret med fokus på kvalitet.

Det er gratis at oprette en arrangørprofil og synliggøre dine events - både i hele Danmark og i udlandet. På din profil kan du samle din præsentation, billeder, videoer, kontaktoplysninger og kommende events, så interesserede lettere kan lære dig og dit arbejde at kende.

Sociale medier er stadig værdifulde, men i dag er det en fordel ikke kun at være afhængig af Facebook, Instagram og deres skiftende algoritmer. Indhold forsvinder hurtigt i strømmen, mens en selvstændig profil på SoulEvents giver dine events et mere varigt sted at blive fundet - også gennem Google og de nye AI-assistenter som ChatGPT, Claude og Gemini.

Jeg synes, at dit arbejde fortjener at blive fremhævet på en platform, hvor kvalitet og det spirituelle univers er i centrum.

SoulEvents er stadig ny og vokser stille og bevidst. Som arrangør får du derfor mulighed for at være med fra begyndelsen og vokse sammen med platformen og flere spændende arrangører fra hele landet.

Du kan læse mere og oprette din gratis profil her:

[Bliv arrangør på SoulEvents]

Invitationen er naturligvis helt uforpligtende.`;

export type FacilitatorInvitationRenderInput = {
  body: string;
  buttonLabel: string;
  buttonUrl: string;
  contactName: string;
  noContactUrl?: string | null;
  personalIntro?: string | null;
  preheader?: string | null;
  signoff: string;
  subject: string;
};

export function createFacilitatorInvitationOptOutToken() {
  return randomBytes(32).toString("base64url");
}

export function hashFacilitatorInvitationOptOutToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function facilitatorInvitationOptOutUrl(token: string) {
  return getCanonicalAppUrl() + "/invitations/no-contact?token=" + encodeURIComponent(token);
}

export function normalizeInvitationEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function normalizeInvitationUrl(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) return defaultInvitationButtonUrl;
  if (raw.startsWith("/")) return raw;

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return defaultInvitationButtonUrl;
    return url.toString();
  } catch {
    return defaultInvitationButtonUrl;
  }
}

export function invitationAbsoluteUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return getCanonicalAppUrl() + (value.startsWith("/") ? value : "/" + value);
}

function renderParagraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p style="margin: 0 0 16px; color: #4F4756; font-size: 16px; line-height: 1.65;">${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function applyInvitationPlaceholders(input: FacilitatorInvitationRenderInput) {
  const name = input.contactName.trim() || "dig";
  const personalIntro = input.personalIntro?.trim() ?? "";
  const buttonText = input.buttonLabel.trim() || defaultInvitationButtonLabel;
  return input.body
    .replaceAll("[navn]", name)
    .replaceAll("[personlig_indledning]", personalIntro)
    .replaceAll("[Bliv arrangør på SoulEvents]", buttonText);
}

export function renderFacilitatorInvitationHtml(input: FacilitatorInvitationRenderInput) {
  const preheader = input.preheader?.trim() || "";
  const logoUrl = getCanonicalAppUrl() + "/brand/soulevents-logo.png";
  const buttonUrl = invitationAbsoluteUrl(normalizeInvitationUrl(input.buttonUrl));
  const buttonLabel = input.buttonLabel.trim() || defaultInvitationButtonLabel;
  const body = renderParagraphs(applyInvitationPlaceholders(input));
  const signoff = renderParagraphs(input.signoff);
  const noContact = input.noContactUrl
    ? `<p style="margin: 14px 0 0; font-size: 12px; line-height: 1.6; color: #8A8290;">Hvis du ikke ønsker flere invitationer fra SoulEvents, kan du <a href="${escapeHtml(input.noContactUrl)}" style="color: #7A4EAB;">frabede dig yderligere henvendelser her</a>.</p>`
    : "";

  return `<!doctype html>
<html lang="da">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.subject)}</title>
  </head>
  <body style="margin: 0; padding: 0; background: #FAF6EF; color: #2F2633; font-family: Arial, Helvetica, sans-serif;">
    ${preheader ? `<div style="display:none; max-height:0; overflow:hidden; opacity:0;">${escapeHtml(preheader)}</div>` : ""}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #FAF6EF; border-collapse: collapse;">
      <tr>
        <td align="center" style="padding: 34px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 680px; border-collapse: collapse;">
            <tr>
              <td style="padding: 30px 28px 16px; border-radius: 32px 32px 0 0; background: linear-gradient(135deg, #4B5645, #7A4EAB); color: #ffffff;">
                <img alt="SoulEvents.dk" src="${escapeHtml(logoUrl)}" width="72" height="72" style="display: block; width: 72px; height: 72px; object-fit: contain; margin: 0 0 14px;" />
                <h1 style="margin: 10px 0 0; font-family: Georgia, 'Times New Roman', serif; font-size: 34px; line-height: 1.12;">En varm invitation</h1>
                ${preheader ? `<p style="margin: 14px 0 0; color: rgba(255,255,255,.84); font-size: 16px; line-height: 1.55;">${escapeHtml(preheader)}</p>` : ""}
              </td>
            </tr>
            <tr>
              <td style="background: #ffffff; padding: 32px 28px 12px; border-left: 1px solid #E5DDEA; border-right: 1px solid #E5DDEA;">
                ${body}
                <p style="margin: 24px 0 8px;"><a href="${escapeHtml(buttonUrl)}" style="display: inline-block; border-radius: 999px; background: #7A4EAB; color: #ffffff; font-size: 15px; font-weight: 700; padding: 13px 22px; text-decoration: none;">${escapeHtml(buttonLabel)}</a></p>
                <p style="margin: 0 0 24px; color: #6E6475; font-size: 14px; line-height: 1.6;"><a href="${escapeHtml(buttonUrl)}" style="color: #7A4EAB;">${escapeHtml(buttonUrl)}</a></p>
                ${signoff}
              </td>
            </tr>
            <tr>
              <td style="padding: 22px 28px 28px; border-radius: 0 0 32px 32px; background: #F4F0F7; border: 1px solid #E5DDEA; border-top: 0;">
                <p style="margin: 0; color: #4B5645; font-size: 13px; font-weight: 700;">SoulEvents.dk</p>
                <p style="margin: 8px 0 0; color: #6E6475; font-size: 13px; line-height: 1.65;">En rolig platform for spirituelle events, nærvær og personlig udvikling.</p>
                ${noContact}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderFacilitatorInvitationText(input: FacilitatorInvitationRenderInput) {
  const buttonUrl = invitationAbsoluteUrl(normalizeInvitationUrl(input.buttonUrl));
  const noContact = input.noContactUrl ? `\n\nHvis du ikke ønsker flere invitationer fra SoulEvents, kan du frabede dig yderligere henvendelser her:\n${input.noContactUrl}` : "";
  return [
    input.subject,
    "",
    applyInvitationPlaceholders(input),
    "",
    buttonUrl,
    "",
    input.signoff,
    noContact,
  ].join("\n").trim();
}
