export type BecomeOrganizerImageKey = "hero" | "intro" | "cta";

export type BecomeOrganizerCta = {
  label: string;
  href: string;
};

export type BecomeOrganizerImage = {
  alt: string;
  path: string | null;
};

export type BecomeOrganizerBenefit = {
  title: string;
  text: string;
};

export type BecomeOrganizerFaqItem = {
  question: string;
  answer: string;
};

export type BecomeOrganizerSectionBase = {
  id: string;
  isEnabled: boolean;
};

export type BecomeOrganizerHeroSection = BecomeOrganizerSectionBase & {
  type: "hero";
  eyebrow: string;
  title: string;
  text: string;
  primaryCta: BecomeOrganizerCta;
  secondaryCta: BecomeOrganizerCta;
  image: BecomeOrganizerImage;
};

export type BecomeOrganizerTextSection = BecomeOrganizerSectionBase & {
  type: "text";
  eyebrow: string;
  title: string;
  text: string;
};

export type BecomeOrganizerImageSection = BecomeOrganizerSectionBase & {
  type: "image";
  eyebrow: string;
  title: string;
  text: string;
  image: BecomeOrganizerImage;
  imagePosition: "left" | "right";
};

export type BecomeOrganizerVideoSection = BecomeOrganizerSectionBase & {
  type: "video";
  eyebrow: string;
  title: string;
  text: string;
  videoUrl: string;
};

export type BecomeOrganizerBenefitsSection = BecomeOrganizerSectionBase & {
  type: "benefits";
  eyebrow: string;
  title: string;
  text: string;
  items: BecomeOrganizerBenefit[];
};

export type BecomeOrganizerFaqSection = BecomeOrganizerSectionBase & {
  type: "faq";
  eyebrow: string;
  title: string;
  items: BecomeOrganizerFaqItem[];
};

export type BecomeOrganizerCtaSection = BecomeOrganizerSectionBase & {
  type: "cta";
  eyebrow: string;
  title: string;
  text: string;
  primaryCta: BecomeOrganizerCta;
  secondaryCta: BecomeOrganizerCta;
  image: BecomeOrganizerImage;
};

export type BecomeOrganizerSection =
  | BecomeOrganizerHeroSection
  | BecomeOrganizerTextSection
  | BecomeOrganizerImageSection
  | BecomeOrganizerVideoSection
  | BecomeOrganizerBenefitsSection
  | BecomeOrganizerFaqSection
  | BecomeOrganizerCtaSection;

export type BecomeOrganizerPageContent = {
  seoTitle: string;
  seoDescription: string;
  sections: BecomeOrganizerSection[];
};

export const becomeOrganizerPageSettingKey = "become_organizer_page_content";
export const siteContentBucketName = "site-content";

export const becomeOrganizerImageFields: Array<{ key: BecomeOrganizerImageKey; label: string; sectionId: string }> = [
  { key: "hero", label: "Hero-billede", sectionId: "hero" },
  { key: "intro", label: "Billedsektion", sectionId: "intro-image" },
  { key: "cta", label: "CTA-billede", sectionId: "final-cta" },
];

export const defaultBecomeOrganizerPageContent: BecomeOrganizerPageContent = {
  seoTitle: "Bliv arrangør på SoulEvents",
  seoDescription:
    "Opret en arrangørprofil på SoulEvents og bliv fundet af mennesker, der søger events, ydelser og oplevelser for krop, sind og sjæl.",
  sections: [
    {
      id: "hero",
      type: "hero",
      isEnabled: true,
      eyebrow: "For arrangører",
      title: "Bliv fundet af mennesker, der søger nærværende oplevelser",
      text:
        "SoulEvents samler spirituelle events, ydelser og arrangører i et roligt univers, hvor deltagere kan finde netop det, de længes efter.",
      primaryCta: { label: "Opret arrangørprofil", href: "/auth/signup" },
      secondaryCta: { label: "Se SoulEvents", href: "/" },
      image: { alt: "Arrangør på SoulEvents", path: null },
    },
    {
      id: "intro-text",
      type: "text",
      isEnabled: true,
      eyebrow: "Et samlet sted",
      title: "Giv dine events og ydelser et hjem",
      text:
        "Som arrangør får du en profil, hvor du kan præsentere dit univers, dine events og dine ydelser. SoulEvents er bygget til at gøre det enkelt for deltagere at søge, vælge og kontakte dig.",
    },
    {
      id: "intro-image",
      type: "image",
      isEnabled: true,
      eyebrow: "Profil, events og ydelser",
      title: "Vis helheden omkring dit arbejde",
      text:
        "Fortæl hvem du er, hvad du tilbyder, og hvilke oplevelser du skaber. Brug billeder, beskrivelser, lokation, kategorier og kontaktoplysninger til at gøre profilen levende og tryg.",
      image: { alt: "Præsentation af arrangørprofil", path: null },
      imagePosition: "right",
    },
    {
      id: "benefits",
      type: "benefits",
      isEnabled: true,
      eyebrow: "Fordele",
      title: "Bygget til arrangører med noget på hjerte",
      text: "SoulEvents gør det lettere at blive opdaget, uden at du skal kæmpe med støjende markedsføring.",
      items: [
        { title: "Bliv søgbar", text: "Deltagere kan finde dig via kategori, område, dato og fritekstsøgning." },
        { title: "Saml dit indhold", text: "Profil, events, ydelser, billeder og kontaktoplysninger ligger ét sted." },
        { title: "Skab tillid", text: "Et roligt design og tydelige oplysninger gør det lettere at vælge dig." },
        { title: "Brug platformen fleksibelt", text: "Del enkelte events, løbende forløb eller ydelser alt efter dit arbejde." },
      ],
    },
    {
      id: "video",
      type: "video",
      isEnabled: false,
      eyebrow: "Video",
      title: "Fortæl om SoulEvents på video",
      text: "Indsæt et YouTube- eller Vimeo-link her, hvis landingssiden skal have video.",
      videoUrl: "",
    },
    {
      id: "faq",
      type: "faq",
      isEnabled: true,
      eyebrow: "FAQ",
      title: "Spørgsmål fra nye arrangører",
      items: [
        {
          question: "Hvem kan oprette en arrangørprofil?",
          answer:
            "SoulEvents er for arrangører, behandlere og formidlere, der tilbyder events eller ydelser inden for krop, sind, sjæl og fællesskab.",
        },
        {
          question: "Kan jeg redigere min profil senere?",
          answer: "Ja. Du kan løbende redigere din profil, dine billeder, dine events og dine ydelser.",
        },
        {
          question: "Hvordan bliver mine events fundet?",
          answer: "Events kan vises i søgning, på kortet og i relevante kategorier, så deltagere kan finde dem ud fra behov og område.",
        },
      ],
    },
    {
      id: "final-cta",
      type: "cta",
      isEnabled: true,
      eyebrow: "Klar til at begynde?",
      title: "Opret din arrangørprofil",
      text: "Kom i gang med en profil, der samler dit arbejde og gør det nemmere for de rette deltagere at finde dig.",
      primaryCta: { label: "Opret arrangørprofil", href: "/auth/signup" },
      secondaryCta: { label: "Kontakt SoulEvents", href: "mailto:kontakt@soulevents.dk" },
      image: { alt: "Bliv arrangør på SoulEvents", path: null },
    },
  ],
};

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function ctaValue(value: unknown, fallback: BecomeOrganizerCta): BecomeOrganizerCta {
  const parsed = value && typeof value === "object" ? (value as Partial<BecomeOrganizerCta>) : {};

  return {
    label: stringValue(parsed.label, fallback.label),
    href: stringValue(parsed.href, fallback.href),
  };
}

function imageValue(value: unknown, fallback: BecomeOrganizerImage): BecomeOrganizerImage {
  const parsed = value && typeof value === "object" ? (value as Partial<BecomeOrganizerImage>) : {};
  const path = stringValue(parsed.path, fallback.path ?? "");

  return {
    alt: stringValue(parsed.alt, fallback.alt),
    path: path || null,
  };
}

function benefitsValue(value: unknown, fallback: BecomeOrganizerBenefit[]) {
  if (!Array.isArray(value)) return fallback;

  const items = value
    .map((item, index) => {
      const parsed = item && typeof item === "object" ? (item as Partial<BecomeOrganizerBenefit>) : {};
      return {
        title: stringValue(parsed.title, fallback[index]?.title ?? ""),
        text: stringValue(parsed.text, fallback[index]?.text ?? ""),
      };
    })
    .filter((item) => item.title || item.text);

  return items.length > 0 ? items : fallback;
}

function faqValue(value: unknown, fallback: BecomeOrganizerFaqItem[]) {
  if (!Array.isArray(value)) return fallback;

  const items = value
    .map((item, index) => {
      const parsed = item && typeof item === "object" ? (item as Partial<BecomeOrganizerFaqItem>) : {};
      return {
        question: stringValue(parsed.question, fallback[index]?.question ?? ""),
        answer: stringValue(parsed.answer, fallback[index]?.answer ?? ""),
      };
    })
    .filter((item) => item.question || item.answer);

  return items.length > 0 ? items : fallback;
}

function parseSection(value: unknown, fallback: BecomeOrganizerSection): BecomeOrganizerSection {
  const parsed = value && typeof value === "object" ? (value as Partial<BecomeOrganizerSection>) : {};
  const base = {
    id: fallback.id,
    isEnabled: booleanValue(parsed.isEnabled, fallback.isEnabled),
  };

  switch (fallback.type) {
    case "hero":
      return {
        ...base,
        type: "hero",
        eyebrow: stringValue((parsed as Partial<BecomeOrganizerHeroSection>).eyebrow, fallback.eyebrow),
        title: stringValue((parsed as Partial<BecomeOrganizerHeroSection>).title, fallback.title),
        text: stringValue((parsed as Partial<BecomeOrganizerHeroSection>).text, fallback.text),
        primaryCta: ctaValue((parsed as Partial<BecomeOrganizerHeroSection>).primaryCta, fallback.primaryCta),
        secondaryCta: ctaValue((parsed as Partial<BecomeOrganizerHeroSection>).secondaryCta, fallback.secondaryCta),
        image: imageValue((parsed as Partial<BecomeOrganizerHeroSection>).image, fallback.image),
      };
    case "text":
      return {
        ...base,
        type: "text",
        eyebrow: stringValue((parsed as Partial<BecomeOrganizerTextSection>).eyebrow, fallback.eyebrow),
        title: stringValue((parsed as Partial<BecomeOrganizerTextSection>).title, fallback.title),
        text: stringValue((parsed as Partial<BecomeOrganizerTextSection>).text, fallback.text),
      };
    case "image": {
      const imagePosition = (parsed as Partial<BecomeOrganizerImageSection>).imagePosition;
      return {
        ...base,
        type: "image",
        eyebrow: stringValue((parsed as Partial<BecomeOrganizerImageSection>).eyebrow, fallback.eyebrow),
        title: stringValue((parsed as Partial<BecomeOrganizerImageSection>).title, fallback.title),
        text: stringValue((parsed as Partial<BecomeOrganizerImageSection>).text, fallback.text),
        image: imageValue((parsed as Partial<BecomeOrganizerImageSection>).image, fallback.image),
        imagePosition: imagePosition === "left" || imagePosition === "right" ? imagePosition : fallback.imagePosition,
      };
    }
    case "video":
      return {
        ...base,
        type: "video",
        eyebrow: stringValue((parsed as Partial<BecomeOrganizerVideoSection>).eyebrow, fallback.eyebrow),
        title: stringValue((parsed as Partial<BecomeOrganizerVideoSection>).title, fallback.title),
        text: stringValue((parsed as Partial<BecomeOrganizerVideoSection>).text, fallback.text),
        videoUrl: stringValue((parsed as Partial<BecomeOrganizerVideoSection>).videoUrl, fallback.videoUrl),
      };
    case "benefits":
      return {
        ...base,
        type: "benefits",
        eyebrow: stringValue((parsed as Partial<BecomeOrganizerBenefitsSection>).eyebrow, fallback.eyebrow),
        title: stringValue((parsed as Partial<BecomeOrganizerBenefitsSection>).title, fallback.title),
        text: stringValue((parsed as Partial<BecomeOrganizerBenefitsSection>).text, fallback.text),
        items: benefitsValue((parsed as Partial<BecomeOrganizerBenefitsSection>).items, fallback.items),
      };
    case "faq":
      return {
        ...base,
        type: "faq",
        eyebrow: stringValue((parsed as Partial<BecomeOrganizerFaqSection>).eyebrow, fallback.eyebrow),
        title: stringValue((parsed as Partial<BecomeOrganizerFaqSection>).title, fallback.title),
        items: faqValue((parsed as Partial<BecomeOrganizerFaqSection>).items, fallback.items),
      };
    case "cta":
      return {
        ...base,
        type: "cta",
        eyebrow: stringValue((parsed as Partial<BecomeOrganizerCtaSection>).eyebrow, fallback.eyebrow),
        title: stringValue((parsed as Partial<BecomeOrganizerCtaSection>).title, fallback.title),
        text: stringValue((parsed as Partial<BecomeOrganizerCtaSection>).text, fallback.text),
        primaryCta: ctaValue((parsed as Partial<BecomeOrganizerCtaSection>).primaryCta, fallback.primaryCta),
        secondaryCta: ctaValue((parsed as Partial<BecomeOrganizerCtaSection>).secondaryCta, fallback.secondaryCta),
        image: imageValue((parsed as Partial<BecomeOrganizerCtaSection>).image, fallback.image),
      };
  }
}

export function parseBecomeOrganizerPageContent(value: string | null | undefined): BecomeOrganizerPageContent {
  if (!value) return defaultBecomeOrganizerPageContent;

  try {
    const parsed = JSON.parse(value) as Partial<BecomeOrganizerPageContent>;
    const parsedSections = Array.isArray(parsed.sections) ? parsed.sections : [];

    return {
      seoTitle: stringValue(parsed.seoTitle, defaultBecomeOrganizerPageContent.seoTitle),
      seoDescription: stringValue(parsed.seoDescription, defaultBecomeOrganizerPageContent.seoDescription),
      sections: defaultBecomeOrganizerPageContent.sections.map((fallback) => {
        const match = parsedSections.find((section) => section && typeof section === "object" && (section as { id?: unknown }).id === fallback.id);
        return parseSection(match, fallback);
      }),
    };
  } catch {
    return defaultBecomeOrganizerPageContent;
  }
}

export function getBecomeOrganizerSection<T extends BecomeOrganizerSection["type"]>(
  content: BecomeOrganizerPageContent,
  id: string,
  type: T,
) {
  return content.sections.find((section): section is Extract<BecomeOrganizerSection, { type: T }> => section.id === id && section.type === type);
}
