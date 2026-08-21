export const facilitatorMoodImageSlotCount = 6;

export type FacilitatorMoodImageSlotRow = {
  alt_text?: string | null;
  id?: string | null;
  image_path?: string | null;
  sort_order?: number | null;
};

export function normalizeFacilitatorMoodImageSlots<T extends FacilitatorMoodImageSlotRow>(images: T[] | null | undefined) {
  const slots = Array.from({ length: facilitatorMoodImageSlotCount }, () => null as T | null);

  for (const image of images ?? []) {
    const sortOrder = image.sort_order;

    if (
      typeof sortOrder !== "number" ||
      !Number.isInteger(sortOrder) ||
      sortOrder < 1 ||
      sortOrder > facilitatorMoodImageSlotCount
    ) {
      continue;
    }

    const slotIndex = sortOrder - 1;
    if (!slots[slotIndex]) {
      slots[slotIndex] = image;
    }
  }

  return slots;
}

export function normalizeFacilitatorMoodImagePaths(images: FacilitatorMoodImageSlotRow[] | null | undefined) {
  return normalizeFacilitatorMoodImageSlots(images).map((image) => image?.image_path ?? "");
}
