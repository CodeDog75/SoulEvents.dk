"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { getAllStrings, getOptionalString, getString } from "@/lib/forms/form-data";
import { createSlug } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";

function go(message: string): never {
  redirect("/admin/category-architecture?message=" + encodeURIComponent(message));
}

function sortOrder(formData: FormData) {
  const value = Number(getString(formData, "sort_order"));
  return Number.isFinite(value) ? value : 0;
}

function slugFrom(formData: FormData, name: string) {
  return getString(formData, "slug") || createSlug(name);
}

async function saveBasic(table: "main_categories" | "subcategories" | "tags", formData: FormData) {
  await requireRole("admin");
  const id = getOptionalString(formData, "id");
  const name = getString(formData, "name");
  const slug = slugFrom(formData, name);

  if (!name || !slug) {
    go("Navn er påkrævet.");
  }

  const supabase = await createClient();
  const payload = {
    name,
    slug,
    description: getOptionalString(formData, "description"),
    image_path: table === "tags" ? undefined : getOptionalString(formData, "image_path"),
    color_hex: table === "main_categories" ? getString(formData, "color_hex") || "#87A878" : undefined,
    is_active: formData.get("is_active") === "on",
    sort_order: sortOrder(formData),
  };

  const result = id ? await supabase.from(table).update(payload).eq("id", id) : await supabase.from(table).insert(payload);

  if (result.error) {
    go("Kunne ikke gemme. Tjek om slug allerede findes, og om migrationen er kørt.");
  }

  if (table === "subcategories") {
    const subcategoryId = id || (await supabase.from("subcategories").select("id").eq("slug", slug).single()).data?.id;
    const mainCategoryIds = getAllStrings(formData, "main_category_ids");

    if (subcategoryId) {
      await supabase.from("subcategory_main_categories").delete().eq("subcategory_id", subcategoryId);
      if (mainCategoryIds.length > 0) {
        await supabase.from("subcategory_main_categories").insert(
          mainCategoryIds.map((mainCategoryId) => ({
            subcategory_id: subcategoryId,
            main_category_id: mainCategoryId,
          })),
        );
      }
    }
  }

  revalidatePath("/admin/category-architecture");
  go("Gemt.");
}

export async function upsertMainCategoryAction(formData: FormData) {
  await saveBasic("main_categories", formData);
}

export async function upsertSubcategoryAction(formData: FormData) {
  await saveBasic("subcategories", formData);
}

export async function upsertTagAction(formData: FormData) {
  await saveBasic("tags", formData);
}

export async function deleteTaxonomyItemAction(formData: FormData) {
  await requireRole("admin");
  const table = getString(formData, "table") || getString(formData, "delete_table");
  const id = getString(formData, "id") || getString(formData, "delete_id");

  if (!["main_categories", "subcategories", "tags"].includes(table) || !id) {
    go("Ugyldig sletning.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", id);

  if (error) {
    go("Kunne ikke slette. Elementet er muligvis i brug.");
  }

  revalidatePath("/admin/category-architecture");
  go("Slettet.");
}
