export type AboutImageKey = "hero" | "why" | "vision" | "story";

export type AboutPageContent = {
  headline: string;
  introduction: string;
  whyTitle: string;
  whyText: string;
  visionTitle: string;
  visionText: string;
  storyTitle: string;
  storyText: string;
  howTitle: string;
  howText: string;
  valuesTitle: string;
  valuesText: string;
  ctaTitle: string;
  ctaText: string;
  ctaButtonText: string;
  ctaButtonLink: string;
  images: Record<AboutImageKey, { alt: string; path: string | null }>;
};

export const aboutPageSettingKey = "about_page_content";

export const aboutImageFields: Array<{ key: AboutImageKey; label: string }> = [
  { key: "hero", label: "Topbillede" },
  { key: "why", label: "Hvorfor eksisterer SoulEvents?" },
  { key: "vision", label: "Vores vision" },
  { key: "story", label: "Historien om os" },
];

export const defaultAboutPageContent: AboutPageContent = {
  headline: "Danmarks samlingssted for spirituelle events",
  introduction:
    "SoulEvents.dk hjælper mennesker med at finde yoga, meditation, lydbade, saunagus, retreats, ceremonier, healing og andre oplevelser for krop, sind og sjæl.",
  whyTitle: "Hvorfor eksisterer SoulEvents?",
  whyText:
    "SoulEvents er skabt for at gøre det lettere at finde nærværende oplevelser, seriøse arrangører og trygge fællesskaber. Platformen samler events, der ellers kan være svære at opdage på tværs af sociale medier, nyhedsbreve og lokale netværk.",
  visionTitle: "Vores vision",
  visionText:
    "Vi ønsker at skabe et roligt og overskueligt sted, hvor mennesker kan finde oplevelser, der støtter krop, sind og sjæl, og hvor arrangører kan blive fundet af de deltagere, der søger netop deres univers.",
  storyTitle: "Historien om os",
  storyText:
    "SoulEvents udspringer af ønsket om at samle de mange dygtige arrangører og inspirerende oplevelser i Danmark på ét sted. Et sted med god luft, tydelig information og respekt for både deltagere og arrangører.",
  howTitle: "Sådan fungerer SoulEvents",
  howText:
    "Arrangører opretter deres profiler og events, og SoulEvents gør det enkelt for deltagere at søge, udforske og sende en tilmelding. Den enkelte arrangør står for selve eventet og den praktiske kontakt med deltagerne.",
  valuesTitle: "Vores værdier",
  valuesText:
    "SoulEvents bygger på tillid, gennemsigtighed, ro og respekt. Vi tror på klare oplysninger, smukke rammer og en platform, der gør det lettere at vælge med både hoved og hjerte.",
  ctaTitle: "Vil du skabe events på SoulEvents?",
  ctaText: "Opret en gratis arrangørprofil og bliv en del af et univers for krop, sind og sjæl.",
  ctaButtonText: "Opret arrangørprofil",
  ctaButtonLink: "/auth/signup",
  images: {
    hero: { alt: "SoulEvents univers for krop, sind og sjæl", path: null },
    why: { alt: "Nærværende fællesskab", path: null },
    vision: { alt: "Rolig vision for spirituelle events", path: null },
    story: { alt: "Historien om SoulEvents", path: null },
  },
};

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

export function parseAboutPageContent(value: string | null | undefined): AboutPageContent {
  if (!value) {
    return defaultAboutPageContent;
  }

  try {
    const parsed = JSON.parse(value) as Partial<AboutPageContent>;
    const parsedImages = (parsed.images ?? {}) as Partial<AboutPageContent["images"]>;

    return {
      headline: stringValue(parsed.headline, defaultAboutPageContent.headline),
      introduction: stringValue(parsed.introduction, defaultAboutPageContent.introduction),
      whyTitle: stringValue(parsed.whyTitle, defaultAboutPageContent.whyTitle),
      whyText: stringValue(parsed.whyText, defaultAboutPageContent.whyText),
      visionTitle: stringValue(parsed.visionTitle, defaultAboutPageContent.visionTitle),
      visionText: stringValue(parsed.visionText, defaultAboutPageContent.visionText),
      storyTitle: stringValue(parsed.storyTitle, defaultAboutPageContent.storyTitle),
      storyText: stringValue(parsed.storyText, defaultAboutPageContent.storyText),
      howTitle: stringValue(parsed.howTitle, defaultAboutPageContent.howTitle),
      howText: stringValue(parsed.howText, defaultAboutPageContent.howText),
      valuesTitle: stringValue(parsed.valuesTitle, defaultAboutPageContent.valuesTitle),
      valuesText: stringValue(parsed.valuesText, defaultAboutPageContent.valuesText),
      ctaTitle: stringValue(parsed.ctaTitle, defaultAboutPageContent.ctaTitle),
      ctaText: stringValue(parsed.ctaText, defaultAboutPageContent.ctaText),
      ctaButtonText: stringValue(parsed.ctaButtonText, defaultAboutPageContent.ctaButtonText),
      ctaButtonLink: stringValue(parsed.ctaButtonLink, defaultAboutPageContent.ctaButtonLink),
      images: {
        hero: {
          alt: stringValue(parsedImages.hero?.alt, defaultAboutPageContent.images.hero.alt),
          path: stringValue(parsedImages.hero?.path, defaultAboutPageContent.images.hero.path ?? "") || null,
        },
        why: {
          alt: stringValue(parsedImages.why?.alt, defaultAboutPageContent.images.why.alt),
          path: stringValue(parsedImages.why?.path, defaultAboutPageContent.images.why.path ?? "") || null,
        },
        vision: {
          alt: stringValue(parsedImages.vision?.alt, defaultAboutPageContent.images.vision.alt),
          path: stringValue(parsedImages.vision?.path, defaultAboutPageContent.images.vision.path ?? "") || null,
        },
        story: {
          alt: stringValue(parsedImages.story?.alt, defaultAboutPageContent.images.story.alt),
          path: stringValue(parsedImages.story?.path, defaultAboutPageContent.images.story.path ?? "") || null,
        },
      },
    };
  } catch {
    return defaultAboutPageContent;
  }
}
