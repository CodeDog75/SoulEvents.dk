export function createSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function publicEventPath(slugOrId: string) {
  return "/event/" + slugOrId;
}

export function publicFacilitatorPath(slugOrId: string) {
  return "/arrangor/" + slugOrId;
}
