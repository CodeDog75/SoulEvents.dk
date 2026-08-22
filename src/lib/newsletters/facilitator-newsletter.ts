import { createHash, randomBytes } from "node:crypto";
import { getCanonicalAppUrl } from "@/lib/app-url";
import { escapeHtml } from "@/lib/email/resend-mail";
import { publicMediaUrl } from "@/lib/media/public-url";

export const newsletterTargetSegments = ["all", "active", "paused", "onboarding"] as const;
export const newsletterImageLayouts = ["none", "wide", "square"] as const;
export const newsletterImageFocusOptions = ["center", "top", "bottom", "left", "right"] as const;
export const maxNewsletterSections = 12;
export const maxNewsletterImageFileSize = 5 * 1024 * 1024;
export const newsletterImageUploadAccept = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

export type NewsletterTargetSegment = (typeof newsletterTargetSegments)[number];
export type NewsletterImageLayout = (typeof newsletterImageLayouts)[number];
export type NewsletterImageFocus = (typeof newsletterImageFocusOptions)[number];

export type NewsletterSectionInput = {
  body: string;
  buttonLabel: string;
  buttonUrl: string;
  heading: string;
  imageFocus: NewsletterImageFocus;
  imageLayout: NewsletterImageLayout;
  imagePath: string;
};

export type NewsletterRenderInput = {
  preheader?: string | null;
  sections: NewsletterSectionInput[];
  subject: string;
  unsubscribeUrl?: string | null;
};

const allowedImageExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
const allowedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function newsletterTargetSegmentLabel(segment: string | null | undefined) {
  if (segment === "active") return "Aktive arrangører";
  if (segment === "paused") return "Arrangører på pause";
  if (segment === "onboarding") return "Arrangører under oprettelse";
  return "Alle arrangører";
}

export function normalizeNewsletterTargetSegment(value: string | null | undefined): NewsletterTargetSegment {
  return newsletterTargetSegments.includes(value as NewsletterTargetSegment) ? value as NewsletterTargetSegment : "all";
}

export function normalizeNewsletterImageLayout(value: string | null | undefined): NewsletterImageLayout {
  return newsletterImageLayouts.includes(value as NewsletterImageLayout) ? value as NewsletterImageLayout : "none";
}

export function normalizeNewsletterImageFocus(value: string | null | undefined): NewsletterImageFocus {
  return newsletterImageFocusOptions.includes(value as NewsletterImageFocus) ? value as NewsletterImageFocus : "center";
}

function extensionFromName(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function newsletterImageExtensionFromMetadata(input: { fileName: string; type?: string | null }) {
  const extension = extensionFromName(input.fileName);
  if (extension === "heic" || extension === "heif") return "jpg";
  if (allowedImageExtensions.has(extension)) return extension === "jpeg" ? "jpg" : extension;
  if (input.type === "image/jpeg") return "jpg";
  if (input.type === "image/png") return "png";
  if (input.type === "image/webp") return "webp";
  return null;
}

export function newsletterImageContentTypeFromPath(path: string) {
  const extension = extensionFromName(path);
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

export function validateNewsletterImageMetadata(input: { fileName: string; size: number; type?: string | null }) {
  const extension = extensionFromName(input.fileName);
  const isSupported =
    allowedImageMimeTypes.has(input.type ?? "") ||
    allowedImageExtensions.has(extension) ||
    extension === "heic" ||
    extension === "heif" ||
    input.type === "image/heic" ||
    input.type === "image/heif";

  if (!isSupported) {
    return "Billedet skal være JPG, PNG, WebP eller HEIC.";
  }

  if (!Number.isFinite(input.size) || input.size <= 0) {
    return "Billedet mangler eller er tomt.";
  }

  if (input.size > maxNewsletterImageFileSize) {
    return "Billedet er for stort. Vælg et billede på højst 5 MB til nyhedsmailen.";
  }

  return null;
}

export function normalizeNewsletterImagePath(path: string | null | undefined) {
  const value = (path ?? "").trim();
  if (!value || /^https?:\/\//i.test(value)) return "";
  if (!value.startsWith("newsletters/images/")) return "";
  if (!newsletterImageExtensionFromMetadata({ fileName: value })) return "";
  return value;
}

export function normalizeNewsletterUrl(value: string | null | undefined) {
  const urlValue = (value ?? "").trim();
  if (!urlValue) return "";

  try {
    const url = new URL(urlValue);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

export function createNewsletterUnsubscribeToken() {
  return randomBytes(32).toString("base64url");
}

export function hashNewsletterUnsubscribeToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newsletterUnsubscribeUrl(token: string) {
  return getCanonicalAppUrl() + "/newsletters/unsubscribe?token=" + encodeURIComponent(token);
}

function imagePublicUrl(path: string) {
  return publicMediaUrl(path) ?? "";
}

function renderParagraphs(body: string) {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p style="margin: 0 0 16px; color: #4F4756; font-size: 16px; line-height: 1.65;">${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function renderSection(section: NewsletterSectionInput) {
  const heading = section.heading.trim()
    ? `<h2 style="margin: 0 0 12px; color: #2F2633; font-family: Georgia, 'Times New Roman', serif; font-size: 28px; line-height: 1.18;">${escapeHtml(section.heading.trim())}</h2>`
    : "";
  const body = renderParagraphs(section.body);
  const buttonUrl = normalizeNewsletterUrl(section.buttonUrl);
  const button = buttonUrl && section.buttonLabel.trim()
    ? `<p style="margin: 22px 0 0;"><a href="${escapeHtml(buttonUrl)}" style="display: inline-block; border-radius: 999px; background: #7A4EAB; color: #ffffff; font-size: 15px; font-weight: 700; padding: 13px 22px; text-decoration: none;">${escapeHtml(section.buttonLabel.trim())}</a></p>`
    : "";
  const imagePath = normalizeNewsletterImagePath(section.imagePath);
  const imageWidth = section.imageLayout === "square" ? 560 : 640;
  const imageHeight = section.imageLayout === "square" ? 560 : 360;
  const image =
    imagePath && section.imageLayout !== "none"
      ? `<img alt="${escapeHtml(section.heading.trim() || "Billede fra SoulEvents")}" src="${escapeHtml(imagePublicUrl(imagePath))}" width="${imageWidth}" height="${imageHeight}" style="display: block; width: 100%; max-width: 100%; height: auto; border: 0; border-radius: 24px; margin: 0 0 22px;" />`
      : "";

  return `<tr><td style="padding: 0 0 34px;">${image}${heading}${body}${button}</td></tr>`;
}

export function renderFacilitatorNewsletterHtml(input: NewsletterRenderInput) {
  const sections = input.sections.length
    ? input.sections.map((section) => renderSection(section)).join("")
    : '<tr><td style="padding: 0 0 28px;"><p style="margin: 0; color: #6E6475; font-size: 16px; line-height: 1.65;">Nyhedsmailen har endnu ingen afsnit.</p></td></tr>';
  const preheader = input.preheader?.trim() || "";
  const logoUrl = getCanonicalAppUrl() + "/brand/soulevents-logo.png";
  const unsubscribe = input.unsubscribeUrl
    ? `<p style="margin: 14px 0 0; font-size: 12px; line-height: 1.6; color: #8A8290;">Du får denne mail, fordi du er arrangør på SoulEvents og er tilmeldt nyhedsmails. <a href="${escapeHtml(input.unsubscribeUrl)}" style="color: #7A4EAB;">Afmeld nyhedsmails</a>.</p>`
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
              <td style="padding: 28px 28px 10px; border-radius: 32px 32px 0 0; background: linear-gradient(135deg, #4B5645, #7A4EAB); color: #ffffff;">
                <img alt="SoulEvents.dk" src="${escapeHtml(logoUrl)}" width="72" height="72" style="display: block; width: 72px; height: 72px; object-fit: contain; margin: 0 0 14px;" />
                <h1 style="margin: 10px 0 0; font-family: Georgia, 'Times New Roman', serif; font-size: 34px; line-height: 1.12;">${escapeHtml(input.subject || "Nyhed fra SoulEvents")}</h1>
                ${preheader ? `<p style="margin: 14px 0 0; color: rgba(255,255,255,.84); font-size: 16px; line-height: 1.55;">${escapeHtml(preheader)}</p>` : ""}
              </td>
            </tr>
            <tr>
              <td style="background: #ffffff; padding: 30px 28px 8px; border-left: 1px solid #E5DDEA; border-right: 1px solid #E5DDEA;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                  ${sections}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 22px 28px 28px; border-radius: 0 0 32px 32px; background: #F4F0F7; border: 1px solid #E5DDEA; border-top: 0;">
                <p style="margin: 0; color: #4B5645; font-size: 13px; font-weight: 700;">SoulEvents.dk</p>
                <p style="margin: 8px 0 0; color: #6E6475; font-size: 13px; line-height: 1.65;">Rolige, nærværende oplevelser samlet ét sted.</p>
                ${unsubscribe}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderFacilitatorNewsletterText(input: NewsletterRenderInput) {
  const lines = [input.subject, input.preheader ?? "", ""];
  for (const section of input.sections) {
    if (section.heading.trim()) lines.push(section.heading.trim());
    if (section.body.trim()) lines.push(section.body.trim());
    if (section.buttonLabel.trim() && section.buttonUrl.trim()) lines.push(`${section.buttonLabel.trim()}: ${section.buttonUrl.trim()}`);
    lines.push("");
  }
  if (input.unsubscribeUrl) lines.push("Afmeld nyhedsmails: " + input.unsubscribeUrl);
  return lines.filter((line, index) => line || index < 3).join("\n");
}
