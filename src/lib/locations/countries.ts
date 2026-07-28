export const supportedProfileCountries = [
  { code: "DK", name: "Danmark" },
  { code: "SE", name: "Sverige" },
  { code: "NO", name: "Norge" },
  { code: "FI", name: "Finland" },
  { code: "IS", name: "Island" },
  { code: "DE", name: "Tyskland" },
  { code: "NL", name: "Nederlandene" },
  { code: "BE", name: "Belgien" },
  { code: "FR", name: "Frankrig" },
  { code: "ES", name: "Spanien" },
  { code: "PT", name: "Portugal" },
  { code: "IT", name: "Italien" },
  { code: "AT", name: "Østrig" },
  { code: "CH", name: "Schweiz" },
  { code: "PL", name: "Polen" },
  { code: "CZ", name: "Tjekkiet" },
  { code: "IE", name: "Irland" },
  { code: "GB", name: "Storbritannien" },
  { code: "EE", name: "Estland" },
  { code: "LV", name: "Letland" },
  { code: "LT", name: "Litauen" },
  { code: "LU", name: "Luxembourg" },
  { code: "GR", name: "Grækenland" },
  { code: "HR", name: "Kroatien" },
  { code: "SI", name: "Slovenien" },
  { code: "SK", name: "Slovakiet" },
  { code: "HU", name: "Ungarn" },
  { code: "RO", name: "Rumænien" },
  { code: "BG", name: "Bulgarien" },
  { code: "OTHER", name: "Andet land" },
] as const;

export type SupportedProfileCountryCode = (typeof supportedProfileCountries)[number]["code"];
export const otherProfileCountryCode: SupportedProfileCountryCode = "OTHER";

const countryNameByCode = new Map<string, string>(supportedProfileCountries.map((country) => [country.code, country.name]));
const countryCodeByNormalizedName = new Map(
  supportedProfileCountries.map((country) => [country.name.toLowerCase(), country.code]),
);

countryCodeByNormalizedName.set("danmark", "DK");
countryCodeByNormalizedName.set("denmark", "DK");
countryCodeByNormalizedName.set("sverige", "SE");
countryCodeByNormalizedName.set("sweden", "SE");
countryCodeByNormalizedName.set("norge", "NO");
countryCodeByNormalizedName.set("norway", "NO");
countryCodeByNormalizedName.set("finland", "FI");
countryCodeByNormalizedName.set("island", "IS");
countryCodeByNormalizedName.set("iceland", "IS");
countryCodeByNormalizedName.set("tyskland", "DE");
countryCodeByNormalizedName.set("germany", "DE");
countryCodeByNormalizedName.set("belgien", "BE");
countryCodeByNormalizedName.set("belgium", "BE");
countryCodeByNormalizedName.set("frankrig", "FR");
countryCodeByNormalizedName.set("france", "FR");
countryCodeByNormalizedName.set("spanien", "ES");
countryCodeByNormalizedName.set("spain", "ES");
countryCodeByNormalizedName.set("portugal", "PT");
countryCodeByNormalizedName.set("italien", "IT");
countryCodeByNormalizedName.set("italy", "IT");
countryCodeByNormalizedName.set("østrig", "AT");
countryCodeByNormalizedName.set("austria", "AT");
countryCodeByNormalizedName.set("schweiz", "CH");
countryCodeByNormalizedName.set("switzerland", "CH");
countryCodeByNormalizedName.set("polen", "PL");
countryCodeByNormalizedName.set("poland", "PL");
countryCodeByNormalizedName.set("tjekkiet", "CZ");
countryCodeByNormalizedName.set("czechia", "CZ");
countryCodeByNormalizedName.set("czech republic", "CZ");
countryCodeByNormalizedName.set("irland", "IE");
countryCodeByNormalizedName.set("ireland", "IE");
countryCodeByNormalizedName.set("storbritannien", "GB");
countryCodeByNormalizedName.set("united kingdom", "GB");
countryCodeByNormalizedName.set("uk", "GB");
countryCodeByNormalizedName.set("england", "GB");
countryCodeByNormalizedName.set("estland", "EE");
countryCodeByNormalizedName.set("estonia", "EE");
countryCodeByNormalizedName.set("letland", "LV");
countryCodeByNormalizedName.set("latvia", "LV");
countryCodeByNormalizedName.set("litauen", "LT");
countryCodeByNormalizedName.set("lithuania", "LT");
countryCodeByNormalizedName.set("luxembourg", "LU");
countryCodeByNormalizedName.set("grækenland", "GR");
countryCodeByNormalizedName.set("greece", "GR");
countryCodeByNormalizedName.set("kroatien", "HR");
countryCodeByNormalizedName.set("croatia", "HR");
countryCodeByNormalizedName.set("slovenien", "SI");
countryCodeByNormalizedName.set("slovenia", "SI");
countryCodeByNormalizedName.set("slovakiet", "SK");
countryCodeByNormalizedName.set("slovakia", "SK");
countryCodeByNormalizedName.set("ungarn", "HU");
countryCodeByNormalizedName.set("hungary", "HU");
countryCodeByNormalizedName.set("rumænien", "RO");
countryCodeByNormalizedName.set("romania", "RO");
countryCodeByNormalizedName.set("bulgarien", "BG");
countryCodeByNormalizedName.set("bulgaria", "BG");
countryCodeByNormalizedName.set("nederlandene", "NL");
countryCodeByNormalizedName.set("holland", "NL");
countryCodeByNormalizedName.set("netherlands", "NL");

export function normalizeProfileCountryCode(input: string | null | undefined): SupportedProfileCountryCode {
  const value = input?.trim() ?? "";
  const upperValue = value.toUpperCase();

  if (!value) {
    return "DK";
  }

  if (countryNameByCode.has(upperValue)) {
    return upperValue as SupportedProfileCountryCode;
  }

  return (countryCodeByNormalizedName.get(value.toLowerCase()) ?? otherProfileCountryCode) as SupportedProfileCountryCode;
}

export function isOtherProfileCountry(input: string | null | undefined) {
  return normalizeProfileCountryCode(input) === otherProfileCountryCode;
}

export function inferProfileCountryCode(input: {
  city?: string | null;
  country?: string | null;
  postalCode?: string | null;
}): SupportedProfileCountryCode {
  if (input.country?.trim()) {
    return normalizeProfileCountryCode(input.country);
  }

  const postalCode = input.postalCode?.trim() ?? "";

  if (/^[A-Z]{1,2}\d[A-Z\d]?[ -]?\d[A-Z]{2}$/i.test(postalCode)) return "GB";
  if (/^\d{3}\s?\d{2}$/.test(postalCode)) return "SE";
  if (/^\d{4}\s?[A-Z]{2}$/i.test(postalCode)) return "NL";
  if (/^\d{4}(?:\s+\S.*)?$/.test(postalCode)) return "DK";

  return "DK";
}

export function profileCountryName(input: string | null | undefined, customName?: string | null) {
  const countryCode = normalizeProfileCountryCode(input);

  if (countryCode === otherProfileCountryCode) {
    return customName?.trim() || "Andet land";
  }

  return countryNameByCode.get(countryCode) ?? "Danmark";
}

export function isDanishProfileCountry(input: string | null | undefined) {
  return normalizeProfileCountryCode(input) === "DK";
}

export function normalizeInternationalPostalCode(input: string) {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9 -]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 16)
    .trimStart();
}
