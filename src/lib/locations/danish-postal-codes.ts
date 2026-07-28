export const danishPostalCodeCities: Record<string, string> = {
  "2100": "København Ø",
  "2200": "København N",
  "2300": "København S",
  "2400": "København NV",
  "2500": "Valby",
  "2610": "Rødovre",
  "2620": "Albertslund",
  "2630": "Taastrup",
  "2800": "Kongens Lyngby",
  "3000": "Helsingør",
  "3400": "Hillerød",
  "3700": "Rønne",
  "4000": "Roskilde",
  "4100": "Ringsted",
  "4200": "Slagelse",
  "4300": "Holbæk",
  "4400": "Kalundborg",
  "4700": "Næstved",
  "4800": "Nykøbing F",
  "5000": "Odense C",
  "6000": "Kolding",
  "6100": "Haderslev",
  "6200": "Aabenraa",
  "6400": "Sønderborg",
  "6700": "Esbjerg",
  "7100": "Vejle",
  "7400": "Herning",
  "8000": "Aarhus C",
  "8200": "Aarhus N",
  "8210": "Aarhus V",
  "8230": "Åbyhøj",
  "8260": "Viby J",
  "8600": "Silkeborg",
  "8800": "Viborg",
  "9000": "Aalborg",
  "9200": "Aalborg SV",
  "9210": "Aalborg SØ",
  "9220": "Aalborg Øst",
  "9400": "Nørresundby",
};

export type DanishPostalCityLookup =
  | { city: string; ok: true; source: "local" | "remote" }
  | { city: null; ok: false; source: "local" | "remote" };

export function normalizeDanishPostalCode(input: string) {
  return input.replace(/\D/g, "").slice(0, 4);
}

export function splitDanishPostalCity(input: string | null | undefined) {
  const value = input?.trim() ?? "";
  const match = value.match(/^(\d{4})(?:\s+(.+))?$/);

  if (!match) {
    return { city: "", postalCode: normalizeDanishPostalCode(value) };
  }

  return {
    city: match[2]?.trim() ?? "",
    postalCode: match[1],
  };
}

export function getLocalDanishPostalCity(postalCode: string) {
  return danishPostalCodeCities[normalizeDanishPostalCode(postalCode)] ?? null;
}

export async function fetchDanishPostalCity(postalCode: string): Promise<DanishPostalCityLookup> {
  const normalizedPostalCode = normalizeDanishPostalCode(postalCode);
  const localCity = getLocalDanishPostalCity(normalizedPostalCode);

  if (localCity) {
    return { city: localCity, ok: true, source: "local" };
  }

  try {
    const response = await fetch("https://api.dataforsyningen.dk/postnumre/" + normalizedPostalCode);

    if (!response.ok) {
      return { city: null, ok: false, source: "remote" };
    }

    const data = (await response.json()) as { navn?: string };
    const city = data.navn?.trim();

    return city ? { city, ok: true, source: "remote" } : { city: null, ok: false, source: "remote" };
  } catch {
    return { city: null, ok: false, source: "remote" };
  }
}
