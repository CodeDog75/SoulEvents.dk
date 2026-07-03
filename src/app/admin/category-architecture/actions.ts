"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { getAllStrings, getOptionalString, getString } from "@/lib/forms/form-data";
import { createSlug } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";

function go(message: string): never {
  redirect("/admin/category-architecture?message=" + encodeURIComponent(message));
}

function sortOrder(formData: FormData) {
  const value = Number(getString(formData, "sort_order"));
  return Number.isFinite(value) ? value : 0;
}

function slugFrom(formData: FormData, name: string) {
  const originalSlug = getString(formData, "original_slug");
  const slug = getString(formData, "slug");

  return originalSlug || slug || createSlug(name);
}

async function uniqueSlugForCreate(supabase: ReturnType<typeof createAdminClient>, table: "main_categories" | "subcategories" | "tags", baseSlug: string) {
  const cleanBaseSlug = baseSlug || "kategori";
  let candidate = cleanBaseSlug;

  for (let suffix = 2; suffix < 100; suffix += 1) {
    const { data } = await supabase.from(table).select("id").eq("slug", candidate).maybeSingle();

    if (!data) {
      return candidate;
    }

    candidate = cleanBaseSlug + "-" + suffix;
  }

  return cleanBaseSlug + "-" + crypto.randomUUID().slice(0, 8);
}

function extensionFromFile(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }

  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

async function uploadTaxonomyImage(formData: FormData, currentImagePath: string | null) {
  const removeImage = formData.get("remove_image") === "on";
  if (removeImage) {
    return null;
  }

  const file = formData.get("image_file");
  if (!(file instanceof File) || file.size === 0) {
    return currentImagePath;
  }

  if (!file.type.startsWith("image/")) {
    go("Billedet skal være en billedfil.");
  }

  if (file.size > 8 * 1024 * 1024) {
    go("Billedet er for stort. Vælg et billede under 8 MB.");
  }

  const safeName = file.name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  const extension = extensionFromFile(file);
  const imagePath = "taxonomy/" + Date.now() + "-" + (safeName || "kategori") + "." + extension;
  const admin = createAdminClient();
  const { error } = await admin.storage.from("media").upload(imagePath, file, {
    cacheControl: "31536000",
    contentType: file.type || "image/jpeg",
    upsert: false,
  });

  if (error) {
    go("Billedet kunne ikke uploades: " + error.message + ". Tjek at Supabase-bucketten media findes og tillader billeder op til 8 MB.");
  }

  return imagePath;
}

async function saveBasic(table: "main_categories" | "subcategories" | "tags", formData: FormData) {
  await requireRole("admin");
  const id = getOptionalString(formData, "id");
  const name = getString(formData, "name");
  let slug = slugFrom(formData, name);

  if (!name || !slug) {
    go("Navn er påkrævet.");
  }

  const imagePath =
    table === "main_categories" ? await uploadTaxonomyImage(formData, getOptionalString(formData, "image_path")) : undefined;
  const supabase = createAdminClient();

  if (!id) {
    slug = await uniqueSlugForCreate(supabase, table, slug);
  }
  const payload = {
    name,
    slug,
    description: getOptionalString(formData, "description"),
    image_path: imagePath,
    color_hex: table === "main_categories" ? getString(formData, "color_hex") || "#7A4EAB" : undefined,
    is_active: formData.get("is_active") === "on",
    sort_order: sortOrder(formData),
  };

  const result = id
    ? await supabase.from(table).update(payload).eq("id", id)
    : await supabase.from(table).insert(payload).select("id").single();

  if (result.error) {
    go("Kunne ikke gemme: " + result.error.message);
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

  revalidatePath("/");
  revalidatePath("/admin/category-architecture");
  if (table === "main_categories") {
    revalidatePath("/categories/" + slug);
  }
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

async function relationExists(supabase: ReturnType<typeof createAdminClient>, table: string, column: string, id: string) {
  const { count, error } = await supabase.from(table).select(column, { count: "exact", head: true }).eq(column, id);
  if (error) {
    return false;
  }

  return (count ?? 0) > 0;
}

export async function deleteTaxonomyItemAction(formData: FormData) {
  await requireRole("admin");
  const table = getString(formData, "table") || getString(formData, "delete_table");
  const id = getString(formData, "id") || getString(formData, "delete_id");

  if (!["main_categories", "subcategories", "tags"].includes(table) || !id) {
    go("Ugyldig sletning.");
  }

  const supabase = createAdminClient();

  if (table === "main_categories") {
    const isUsed =
      (await relationExists(supabase, "event_main_categories", "main_category_id", id)) ||
      (await relationExists(supabase, "subcategory_main_categories", "main_category_id", id)) ||
      (await relationExists(supabase, "ad_main_categories", "main_category_id", id));

    if (isUsed) {
      go("Kan ikke slette hovedkategorien, fordi den er i brug. Deaktivér den i stedet.");
    }
  }

  if (table === "subcategories") {
    const isUsed = await relationExists(supabase, "event_subcategories", "subcategory_id", id);

    if (isUsed) {
      go("Kan ikke slette underkategorien, fordi den er brugt på events. Deaktivér den i stedet.");
    }
  }

  if (table === "tags") {
    const isUsed =
      (await relationExists(supabase, "event_tags", "tag_id", id)) ||
      (await relationExists(supabase, "facilitator_tags", "tag_id", id));

    if (isUsed) {
      go("Kan ikke slette tagget, fordi det er i brug. Deaktivér det i stedet.");
    }
  }

  const { error } = await supabase.from(table).delete().eq("id", id);

  if (error) {
    go("Kunne ikke slette. Elementet er muligvis i brug.");
  }

  revalidatePath("/admin/category-architecture");
  go("Slettet.");
}
