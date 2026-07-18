export const facilitatorWorkAreas = [
  { slug: "yoga", label: "Yoga", examples: ["yogalærer", "yin yoga", "hatha", "ashtanga", "kundalini"] },
  { slug: "meditation", label: "Meditation", examples: ["mindfulness", "guidede meditationer", "stilhedsmeditation"] },
  { slug: "breathwork", label: "Breathwork", examples: ["breathwork", "åndedrætsterapi", "rebirthing"] },
  { slug: "lyd-vibration", label: "Lyd & vibration", examples: ["lydbad", "gong", "syngeskåle", "frekvensterapi"] },
  { slug: "ceremonier-ritualer", label: "Ceremonier & ritualer", examples: ["cacao", "kakao", "fuldmåne", "årshjul", "ritualer"] },
  { slug: "natur-udeliv", label: "Natur & udeliv", examples: ["naturterapi", "skovbadning", "vandring", "bushcraft"] },
  { slug: "sauna-kulde", label: "Sauna & kulde", examples: ["saunagus", "isbad", "kuldetræning"] },
  { slug: "kropsbehandling", label: "Kropsbehandling", examples: ["massage", "kraniosakral", "zoneterapi", "bindevæv"] },
  { slug: "energi-healing", label: "Energi & healing", examples: ["Reiki", "healing", "chakra", "pranic healing"] },
  { slug: "personlig-udvikling", label: "Personlig udvikling", examples: ["coaching", "mentor", "psykoterapi", "traumeterapi"] },
  { slug: "spiritualitet-bevidsthed", label: "Spiritualitet & bevidsthed", examples: ["clairvoyance", "mediumskab", "astrologi", "tarot"] },
  { slug: "kreativitet-kunst", label: "Kreativitet & kunst", examples: ["maleworkshops", "intuitiv kunst", "keramik", "skrivning"] },
  { slug: "musik-sang", label: "Musik & sang", examples: ["kirtan", "koncert", "fællessang", "chanting"] },
  { slug: "bevaegelse", label: "Bevægelse", examples: ["qigong", "tai chi", "fri dans", "ecstatic dance"] },
  { slug: "kost-livsstil", label: "Kost & livsstil", examples: ["ayurveda", "ernæring", "urter", "fermentering"] },
  { slug: "retreats-forloeb", label: "Retreats & forløb", examples: ["retreats", "weekendforløb", "længere udviklingsforløb"] },
  { slug: "familie-relationer", label: "Familie & relationer", examples: ["parterapi", "familieworkshops", "forældrekurser", "børneyoga"] },
] as const;

export const facilitatorWorkAreaSlugs = facilitatorWorkAreas.map((area) => area.slug);

export const facilitatorWorkAreaSlugSet = new Set<string>(facilitatorWorkAreaSlugs);

export function sortFacilitatorWorkAreas<T extends { slug?: string | null }>(items: T[]) {
  const order = new Map<string, number>(facilitatorWorkAreas.map((area, index) => [area.slug, index]));
  return [...items].sort((a, b) => {
    const aOrder = order.get(a.slug ?? "") ?? Number.MAX_SAFE_INTEGER;
    const bOrder = order.get(b.slug ?? "") ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });
}
