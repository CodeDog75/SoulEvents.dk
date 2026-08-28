import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const weeklyReflectionGradients: Record<string, string> = {
  "gradient:lavender-cream": "linear-gradient(135deg, #F1E8F8 0%, #FAF6EF 58%, #FFFDF8 100%)",
  "gradient:sage-sand": "linear-gradient(135deg, #EEF3EA 0%, #F6F1E7 54%, #D8C1A2 130%)",
  "gradient:dusty-purple-beige": "linear-gradient(135deg, #E9DFF1 0%, #FAF7F2 52%, #EFE4D6 100%)",
  "gradient:warm-grey-cream": "linear-gradient(135deg, #ECE8E1 0%, #FAF6EF 60%, #FFFDF8 100%)",
};

export function weeklyReflectionBackground(value: string) {
  return weeklyReflectionGradients[value] ?? value;
}

export function weeklyReflectionPath(slug: string) {
  return "/refleksion/" + slug;
}

export function slugifyWeeklyReflectionTitle(title: string) {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "ugens-refleksion";
}

export async function createUniqueWeeklyReflectionSlug(
  supabase: SupabaseClient<Database>,
  title: string,
  currentId?: string | null,
) {
  const baseSlug = slugifyWeeklyReflectionTitle(title);
  const { data, error } = await supabase
    .from("weekly_reflections")
    .select("id, slug")
    .like("slug", baseSlug + "%");

  if (error) {
    throw error;
  }

  const existingSlugs = new Set(
    (data ?? [])
      .filter((reflection) => reflection.id !== currentId)
      .map((reflection) => reflection.slug)
      .filter(Boolean),
  );

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;
  while (existingSlugs.has(baseSlug + "-" + suffix)) {
    suffix += 1;
  }

  return baseSlug + "-" + suffix;
}

export function formatWeeklyReflectionDate(value: string | null | undefined) {
  if (!value) return null;

  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Copenhagen",
    year: "numeric",
  }).format(new Date(value));
}
