export const areaOptions = [
  {
    label: "Sjælland & Øerne",
    slugs: ["storkobenhavn", "nordsjaelland", "midtsjaelland", "sydsjaelland", "vestsjaelland"],
    value: "sjaelland-og-oerne",
  },
  {
    label: "Fyn",
    slugs: ["fyn"],
    value: "fyn",
  },
  {
    label: "Sønderjylland",
    slugs: ["sonderjylland"],
    value: "sonderjylland",
  },
  {
    label: "Midtjylland",
    slugs: ["midtjylland"],
    value: "midtjylland",
  },
  {
    label: "Nordjylland",
    slugs: ["nordjylland"],
    value: "nordjylland",
  },
  {
    label: "Bornholm",
    slugs: ["bornholm"],
    value: "bornholm",
  },
];

export function getAreaOption(value: string) {
  return areaOptions.find((area) => area.value === value) ?? null;
}
