const danishTagCollator = new Intl.Collator("da-DK", {
  sensitivity: "base",
  usage: "sort",
});

export type TagLike = {
  id: string;
  name: string;
};

export function sortTagsByDanishLabel<T extends TagLike>(tags: T[]) {
  return [...tags].sort((first, second) => {
    const nameComparison = danishTagCollator.compare(first.name, second.name);

    if (nameComparison !== 0) {
      return nameComparison;
    }

    return first.id.localeCompare(second.id);
  });
}

export function findSimilarTagLabels<T extends TagLike>(tags: T[]) {
  const labels = new Map<string, T[]>();

  for (const tag of tags) {
    const normalizedLabel = tag.name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9æøå]+/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase("da-DK");

    if (!normalizedLabel) continue;
    labels.set(normalizedLabel, [...(labels.get(normalizedLabel) ?? []), tag]);
  }

  return [...labels.values()].filter((group) => group.length > 1);
}
