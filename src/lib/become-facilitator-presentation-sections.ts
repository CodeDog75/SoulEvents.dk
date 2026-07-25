import { siteContentBucketName } from "@/lib/become-organizer-page-content";

export type BecomeFacilitatorSectionKey = "section_1" | "section_2" | "section_3";

export type BecomeFacilitatorPresentationSection = {
  body: string;
  id?: string;
  imageAlt: string;
  imagePath: string | null;
  imageUrl: string | null;
  isActive: boolean;
  sectionKey: BecomeFacilitatorSectionKey;
  sortOrder: number;
  title: string;
};

type MaybeSectionRow = {
  body?: string | null;
  id?: string;
  image_alt?: string | null;
  image_path?: string | null;
  image_url?: string | null;
  is_active?: boolean | null;
  section_key?: string | null;
  sort_order?: number | null;
  title?: string | null;
};

export const defaultBecomeFacilitatorPresentationSections: BecomeFacilitatorPresentationSection[] = [
  {
    sectionKey: "section_1",
    title: "Bliv fundet af de rigtige deltagere",
    body: "Se hvordan en arrangørprofil kan gøre dine events, ydelser og fællesskaber mere synlige på SoulEvents.",
    imageUrl: "/facilitator/arrangoer-praesentation-1.png",
    imagePath: null,
    imageAlt: "Informationsgrafik om fordelene ved at blive arrangør på SoulEvents",
    sortOrder: 1,
    isActive: true,
  },
  {
    sectionKey: "section_2",
    title: "Skab ro omkring dit eventflow",
    body: "En enkel visning af hvordan SoulEvents samler profil, events, tilmeldinger og dialog ét sted.",
    imageUrl: "/facilitator/arrangoer-praesentation-2.png",
    imagePath: null,
    imageAlt: "Informationsgrafik om arrangørens eventflow på SoulEvents",
    sortOrder: 2,
    isActive: true,
  },
  {
    sectionKey: "section_3",
    title: "Derfor vælger arrangører SoulEvents",
    body:
      "Se, hvordan SoulEvents hjælper dig med at blive fundet, opbygge et publikum og skabe overblik – så du kan bruge mere tid på det, du brænder for.",
    imageUrl: "/facilitator/soulevents-mere-end-eventplatform-newversion.png",
    imagePath: null,
    imageAlt: "Informationsgrafik om hvorfor arrangører vælger SoulEvents",
    sortOrder: 3,
    isActive: true,
  },
];

function isSectionKey(value: string | null | undefined): value is BecomeFacilitatorSectionKey {
  return value === "section_1" || value === "section_2" || value === "section_3";
}

function normalizeSection(row: MaybeSectionRow, fallback: BecomeFacilitatorPresentationSection): BecomeFacilitatorPresentationSection {
  return {
    id: row.id,
    sectionKey: isSectionKey(row.section_key) ? row.section_key : fallback.sectionKey,
    title: row.title?.trim() || fallback.title,
    body: row.body?.trim() || fallback.body,
    imageUrl: row.image_url ?? fallback.imageUrl,
    imagePath: row.image_path ?? fallback.imagePath,
    imageAlt: row.image_alt?.trim() || fallback.imageAlt,
    sortOrder: typeof row.sort_order === "number" ? row.sort_order : fallback.sortOrder,
    isActive: typeof row.is_active === "boolean" ? row.is_active : fallback.isActive,
  };
}

export function mergeBecomeFacilitatorPresentationSections(rows: MaybeSectionRow[] | null | undefined) {
  return defaultBecomeFacilitatorPresentationSections
    .map((fallback) => {
      const row = rows?.find((item) => item.section_key === fallback.sectionKey);
      return row ? normalizeSection(row, fallback) : fallback;
    })
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .slice(0, 3);
}

export function publicSectionImageUrl(
  supabase: {
    storage: {
      from: (bucket: string) => {
        getPublicUrl: (path: string) => { data: { publicUrl: string } };
      };
    };
  },
  section: Pick<BecomeFacilitatorPresentationSection, "imagePath" | "imageUrl">,
) {
  if (section.imagePath) {
    return supabase.storage.from(siteContentBucketName).getPublicUrl(section.imagePath).data.publicUrl;
  }

  return section.imageUrl;
}
