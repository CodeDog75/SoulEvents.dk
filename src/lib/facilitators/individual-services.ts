export const individualServiceOptions = [
  { id: "treatment", label: "Behandling" },
  { id: "hands", label: "Hænder" },
  { id: "heart", label: "Hjerte" },
  { id: "nature", label: "Natur" },
  { id: "conversation", label: "Samtale" },
  { id: "teaching", label: "Undervisning" },
  { id: "community", label: "Fællesskab" },
  { id: "lotus", label: "Lotus" },
  { id: "energy", label: "Energi" },
  { id: "moon", label: "Måne" },
  { id: "sun", label: "Sol" },
  { id: "meditation", label: "Meditation" },
  { id: "sound", label: "Lyd og klang" },
  { id: "water", label: "Vand" },
  { id: "fire_ceremony", label: "Ild og ceremoni" },
  { id: "reflection", label: "Refleksion" },
  { id: "other", label: "Andet" },
] as const;

export type IndividualServiceType = (typeof individualServiceOptions)[number]["id"];

export const maxIndividualServiceTypes = 2;

const individualServiceTypeIds = new Set<string>(individualServiceOptions.map((option) => option.id));
const legacyIndividualServiceTypeMap: Record<string, IndividualServiceType> = {
  ceremony: "fire_ceremony",
  group_program: "community",
  mentoring: "energy",
  one_to_one_conversation: "conversation",
  online_session: "nature",
  treatment_table: "treatment",
  workshop: "teaching",
};

export function isIndividualServiceType(value: string): value is IndividualServiceType {
  return individualServiceTypeIds.has(value);
}

export function normalizeIndividualServiceTypes(value: unknown): IndividualServiceType[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .map((item) => (typeof item === "string" ? legacyIndividualServiceTypeMap[item] ?? item : null))
    .filter((item): item is IndividualServiceType => typeof item === "string" && isIndividualServiceType(item));

  return [...new Set(normalized)].slice(0, maxIndividualServiceTypes);
}
