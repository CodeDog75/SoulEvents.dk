export type SocialProfilePlatform = "facebook" | "instagram";

type ValidationResult =
  | {
      ok: true;
      value: string | null;
    }
  | {
      message: string;
      ok: false;
    };

const socialProfileLinkConfig: Record<
  SocialProfilePlatform,
  {
    allowedHosts: string[];
    message: string;
    placeholder: string;
  }
> = {
  facebook: {
    allowedHosts: ["facebook.com", "www.facebook.com", "m.facebook.com"],
    message: "Indsæt et fuldt Facebook-link, f.eks. https://facebook.com/ditnavn",
    placeholder: "https://facebook.com/ditnavn",
  },
  instagram: {
    allowedHosts: ["instagram.com", "www.instagram.com"],
    message: "Indsæt et fuldt Instagram-link, f.eks. https://instagram.com/ditnavn",
    placeholder: "https://instagram.com/ditnavn",
  },
};

export const socialProfileLinkHelpText = "Kopiér linket direkte fra din profil i Facebook eller Instagram.";

export function socialProfileLinkPlaceholder(platform: SocialProfilePlatform) {
  return socialProfileLinkConfig[platform].placeholder;
}

export function socialProfileLinkErrorMessage(platform: SocialProfilePlatform) {
  return socialProfileLinkConfig[platform].message;
}

export function validateSocialProfileLink(value: string | null | undefined, platform: SocialProfilePlatform): ValidationResult {
  const trimmed = (value ?? "").trim();

  if (!trimmed) {
    return { ok: true, value: null };
  }

  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    return { message: socialProfileLinkErrorMessage(platform), ok: false };
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const hasProfilePath = url.pathname.split("/").some(Boolean);

  if (url.protocol !== "https:" || !socialProfileLinkConfig[platform].allowedHosts.includes(hostname) || !hasProfilePath) {
    return { message: socialProfileLinkErrorMessage(platform), ok: false };
  }

  return { ok: true, value: trimmed };
}
