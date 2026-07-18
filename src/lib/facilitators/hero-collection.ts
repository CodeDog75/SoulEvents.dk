export const facilitatorHeroKeys = [
  "soulevents_mist",
  "soulevents_sunrise",
  "soulevents_forest",
  "soulevents_lotus",
  "soulevents_meadow",
  "soulevents_fire",
  "mood_1",
  "mood_2",
  "mood_3",
] as const;

export type FacilitatorHeroKey = (typeof facilitatorHeroKeys)[number];
export type LegacyFacilitatorHeroKey = "custom";
export type StoredFacilitatorHeroKey = FacilitatorHeroKey | LegacyFacilitatorHeroKey;

export type FacilitatorHeroSource = {
  altText?: string | null;
  imagePath?: string | null;
  sortOrder?: number | null;
  url?: string | null;
};

export type FacilitatorHeroOption = {
  altText: string;
  description: string;
  imagePath: string;
  key: Exclude<FacilitatorHeroKey, "mood_1" | "mood_2" | "mood_3">;
  label: string;
  objectPositionDesktop: string;
  objectPositionMobile: string;
};

export type ResolvedFacilitatorHero = {
  altText: string;
  isFallback: boolean;
  key: FacilitatorHeroKey;
  label: string;
  objectPositionDesktop: string;
  objectPositionMobile: string;
  source: "collection" | "custom";
  url: string;
};

export const defaultFacilitatorHeroKey = "soulevents_mist" satisfies FacilitatorHeroKey;
export const legacyCustomFacilitatorHeroKey = "custom" satisfies LegacyFacilitatorHeroKey;
export const facilitatorMoodHeroKeys = ["mood_1", "mood_2", "mood_3"] as const;

export const facilitatorHeroOptions: FacilitatorHeroOption[] = [
  {
    altText: "Morgendis over stille SoulEvents landskab",
    description: "Stille, nordisk og neutral.",
    imagePath: "/images/facilitator-heroes/soulevents-mist.svg",
    key: "soulevents_mist",
    label: "Morgendis",
    objectPositionDesktop: "center center",
    objectPositionMobile: "center center",
  },
  {
    altText: "Solopgang over roligt nordisk landskab",
    description: "Varm, lys og begyndende.",
    imagePath: "/images/facilitator-heroes/soulevents-sunrise.svg",
    key: "soulevents_sunrise",
    label: "Solopgang",
    objectPositionDesktop: "center center",
    objectPositionMobile: "center center",
  },
  {
    altText: "Rolig skov i dybe SoulEvents farver",
    description: "Dybere, forankret og sanselig.",
    imagePath: "/images/facilitator-heroes/soulevents-forest.svg",
    key: "soulevents_forest",
    label: "Skovens ro",
    objectPositionDesktop: "center center",
    objectPositionMobile: "center center",
  },
  {
    altText: "Stille vand og lotus i lavendeltoner",
    description: "Blid, meditativ og lys.",
    imagePath: "/images/facilitator-heroes/soulevents-lotus.svg",
    key: "soulevents_lotus",
    label: "Lotus",
    objectPositionDesktop: "center center",
    objectPositionMobile: "center center",
  },
  {
    altText: "Nordisk eng med blide grønne toner",
    description: "Åben, enkel og naturlig.",
    imagePath: "/images/facilitator-heroes/soulevents-meadow.svg",
    key: "soulevents_meadow",
    label: "Nordisk eng",
    objectPositionDesktop: "center center",
    objectPositionMobile: "center center",
  },
  {
    altText: "Bål og varme i roligt aftenlandskab",
    description: "Varm, samlende og rolig.",
    imagePath: "/images/facilitator-heroes/soulevents-fire.svg",
    key: "soulevents_fire",
    label: "Bål & varme",
    objectPositionDesktop: "center center",
    objectPositionMobile: "center center",
  },
];

const facilitatorHeroOptionByKey = new Map<FacilitatorHeroOption["key"], FacilitatorHeroOption>(
  facilitatorHeroOptions.map((option) => [option.key, option]),
);

export function isFacilitatorHeroKey(value: string | null | undefined): value is FacilitatorHeroKey {
  return facilitatorHeroKeys.includes(value as FacilitatorHeroKey);
}

export function normalizeFacilitatorHeroKey(value: string | null | undefined): FacilitatorHeroKey | null {
  const trimmed = value?.trim();
  if (trimmed === legacyCustomFacilitatorHeroKey) return "mood_1";
  return isFacilitatorHeroKey(trimmed) ? trimmed : null;
}

export function getFacilitatorHeroOption(key: string | null | undefined) {
  const normalizedKey = normalizeFacilitatorHeroKey(key);
  return normalizedKey && !isMoodHeroKey(normalizedKey) ? facilitatorHeroOptionByKey.get(normalizedKey) ?? null : null;
}

export function isMoodHeroKey(value: string | null | undefined): value is (typeof facilitatorMoodHeroKeys)[number] {
  return facilitatorMoodHeroKeys.includes(value as (typeof facilitatorMoodHeroKeys)[number]);
}

export function moodHeroKeyToSortOrder(key: string | null | undefined) {
  if (!isMoodHeroKey(key)) return null;
  return Number(key.replace("mood_", ""));
}

function moodImageForSortOrder(
  images: FacilitatorHeroSource[],
  sortOrder: number,
  resolveImagePath?: (path: string) => string | null,
) {
  return [...images]
    .sort((first, second) => (first.sortOrder ?? 0) - (second.sortOrder ?? 0))
    .filter((image) => image.sortOrder === sortOrder)
    .map((image) => ({
      altText: image.altText || `Stemningsbillede ${sortOrder}`,
      url: image.url?.trim() || (image.imagePath ? resolveImagePath?.(image.imagePath) : null),
    }))
    .find((image) => Boolean(image.url));
}

export function resolveFacilitatorHero(input: {
  fallbackAltText?: string;
  heroKey?: string | null;
  moodImages: FacilitatorHeroSource[];
  preferCustomWhenUnset?: boolean;
  resolveImagePath?: (path: string) => string | null;
}): ResolvedFacilitatorHero {
  const normalizedKey = normalizeFacilitatorHeroKey(input.heroKey);
  const legacyMoodImage = moodImageForSortOrder(input.moodImages, 1, input.resolveImagePath);
  const shouldUseLegacyCustom = !normalizedKey && input.preferCustomWhenUnset && legacyMoodImage?.url;
  const moodSortOrder = moodHeroKeyToSortOrder(normalizedKey);
  const selectedMoodImage = moodSortOrder ? moodImageForSortOrder(input.moodImages, moodSortOrder, input.resolveImagePath) : null;

  if ((moodSortOrder || shouldUseLegacyCustom) && (selectedMoodImage?.url || legacyMoodImage?.url)) {
    const moodImage = selectedMoodImage ?? legacyMoodImage;
    const key = moodSortOrder ? (`mood_${moodSortOrder}` as FacilitatorHeroKey) : "mood_1";
    return {
      altText: moodImage?.altText ?? "Stemningsbillede",
      isFallback: false,
      key,
      label: moodSortOrder ? `Stemningsbillede ${moodSortOrder}` : "Stemningsbillede 1",
      objectPositionDesktop: "center center",
      objectPositionMobile: "center center",
      source: "custom",
      url: moodImage?.url ?? "",
    };
  }

  const selectedOption =
    normalizedKey && !isMoodHeroKey(normalizedKey)
      ? facilitatorHeroOptionByKey.get(normalizedKey) ?? facilitatorHeroOptionByKey.get(defaultFacilitatorHeroKey)
      : facilitatorHeroOptionByKey.get(defaultFacilitatorHeroKey);

  const option = selectedOption ?? facilitatorHeroOptions[0];

  return {
    altText: input.fallbackAltText ?? option.altText,
    isFallback: !normalizedKey || isMoodHeroKey(normalizedKey),
    key: option.key,
    label: option.label,
    objectPositionDesktop: option.objectPositionDesktop,
    objectPositionMobile: option.objectPositionMobile,
    source: "collection",
    url: option.imagePath,
  };
}
