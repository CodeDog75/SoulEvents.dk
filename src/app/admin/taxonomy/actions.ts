"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { getOptionalString, getString } from "@/lib/forms/form-data";
import { createSlug } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";

function taxonomyRedirect(message: string): never {
  redirect(`/admin/category-architecture?message=${encodeURIComponent(message)}`);
}

function getSortOrder(formData: FormData) {
  const raw = getString(formData, "sort_order");
  const numberValue = Number(raw);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getSlug(formData: FormData, name: string) {
  const slug = getString(formData, "slug") || createSlug(name);

  if (!slug) {
    taxonomyRedirect("Slug kunne ikke dannes.");
  }

  return slug;
}

export async function upsertCategoryAction(formData: FormData) {
  await requireRole("admin");

  const id = getOptionalString(formData, "id");
  const name = getString(formData, "name");
  const slug = getSlug(formData, name);
  const description = getOptionalString(formData, "description");
  const colorHex = getString(formData, "color_hex") || "#87A878";
  const iconName = getOptionalString(formData, "icon_name");
  const sortOrder = getSortOrder(formData);
  const isActive = formData.get("is_active") === "on";

  if (!name) {
    taxonomyRedirect("Kategorinavn er påkrævet.");
  }

  if (!/^#[0-9A-Fa-f]{6}$/.test(colorHex)) {
    taxonomyRedirect("Farve skal være en gyldig hex-farve, fx #87A878.");
  }

  const supabase = await createClient();
  const payload = {
    name,
    slug,
    description,
    color_hex: colorHex,
    icon_name: iconName,
    is_active: isActive,
    sort_order: sortOrder,
  };

  const result = id
    ? await supabase.from("categories").update(payload).eq("id", id)
    : await supabase.from("categories").insert(payload);

  if (result.error) {
    taxonomyRedirect("Kategorien kunne ikke gemmes. Tjek om slug allerede findes.");
  }

  revalidatePath("/admin/taxonomy");
  taxonomyRedirect("Kategorien er gemt.");
}

export async function toggleCategoryStatusAction(formData: FormData) {
  await requireRole("admin");

  const id = getString(formData, "id");
  const isActive = formData.get("is_active") === "true";

  if (!id) {
    taxonomyRedirect("Kategorien mangler ID.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("categories").update({ is_active: isActive }).eq("id", id);

  if (error) {
    taxonomyRedirect("Kategorien kunne ikke opdateres.");
  }

  revalidatePath("/admin/taxonomy");
  taxonomyRedirect(isActive ? "Kategorien er aktiveret." : "Kategorien er deaktiveret.");
}

export async function upsertRegionAction(formData: FormData) {
  await requireRole("admin");

  const id = getOptionalString(formData, "id");
  const name = getString(formData, "name");
  const slug = getSlug(formData, name);
  const sortOrder = getSortOrder(formData);

  if (!name) {
    taxonomyRedirect("Regionsnavn er påkrævet.");
  }

  const supabase = await createClient();
  const payload = {
    name,
    slug,
    sort_order: sortOrder,
  };

  const result = id
    ? await supabase.from("regions").update(payload).eq("id", id)
    : await supabase.from("regions").insert(payload);

  if (result.error) {
    taxonomyRedirect("Regionen kunne ikke gemmes. Tjek om slug allerede findes.");
  }

  revalidatePath("/admin/taxonomy");
  taxonomyRedirect("Regionen er gemt.");
}
