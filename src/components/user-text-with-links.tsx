import type { ReactNode } from "react";

type UserTextWithLinksProps = {
  className?: string;
  text: string;
};

const urlPattern = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
const trailingPunctuation = new Set([".", ",", ":", ";", "!", "?"]);

function splitTrailingPunctuation(value: string) {
  let url = value;
  let suffix = "";

  while (url.length > 0) {
    const lastCharacter = url.at(-1) ?? "";
    const hasUnmatchedClosingParenthesis =
      lastCharacter === ")" && (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0);

    if (!trailingPunctuation.has(lastCharacter) && !hasUnmatchedClosingParenthesis) {
      break;
    }

    suffix = lastCharacter + suffix;
    url = url.slice(0, -1);
  }

  return { suffix, url };
}

function linkHref(value: string) {
  const candidate = value.startsWith("www.") ? "https://" + value : value;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function isInternalSoulEventsUrl(href: string) {
  try {
    const url = new URL(href);
    const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
    const configuredHostname = configuredSiteUrl ? new URL(configuredSiteUrl).hostname : null;

    return url.hostname === configuredHostname || url.hostname === "soulevents.dk" || url.hostname === "www.soulevents.dk";
  } catch {
    return false;
  }
}

function renderTextWithLinks(text: string) {
  const parts: ReactNode[] = [];
  const normalizedText = text.replace(/\r\n?/g, "\n");
  let lastIndex = 0;

  for (const match of normalizedText.matchAll(urlPattern)) {
    const rawMatch = match[0];
    const matchIndex = match.index ?? 0;

    if (matchIndex > lastIndex) {
      parts.push(normalizedText.slice(lastIndex, matchIndex));
    }

    const { suffix, url } = splitTrailingPunctuation(rawMatch);
    const href = linkHref(url);

    if (href) {
      const isInternal = isInternalSoulEventsUrl(href);
      parts.push(
        <a
          className="font-semibold text-[#6E5285] underline decoration-[#D8CBE4] underline-offset-4 transition hover:text-[#B56F8A] hover:decoration-[#B56F8A] [overflow-wrap:anywhere]"
          href={href}
          key={matchIndex + "-" + rawMatch}
          rel={isInternal ? undefined : "noopener noreferrer"}
          target={isInternal ? undefined : "_blank"}
        >
          {url}
        </a>,
      );
      if (suffix) {
        parts.push(suffix);
      }
    } else {
      parts.push(rawMatch);
    }

    lastIndex = matchIndex + rawMatch.length;
  }

  if (lastIndex < normalizedText.length) {
    parts.push(normalizedText.slice(lastIndex));
  }

  return parts;
}

export function UserTextWithLinks({ className, text }: UserTextWithLinksProps) {
  return <div className={className}>{renderTextWithLinks(text)}</div>;
}
