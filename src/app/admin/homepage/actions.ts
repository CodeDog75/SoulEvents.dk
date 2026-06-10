"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { getOptionalString, getString } from "@/lib/forms/form-data";
import { createClient } from "@/lib/supabase/server";

function go(message: string): never {
  redirect("/admin/homepage?message=" + encodeURIComponent(message));
}

function sortOrder(formData: FormData) {
  const value = Number(getString(formData, "sort_order"));
  return Number.isFinite(value) ? value : 0;
}

export async function upsertHomepageTileAction(formData: FormData) {
  await requireRole("admin");

  const id = getOptionalString(formData, "id");
  const title = getString(formData, "title");
  const description = getOptionalString(formData, "description");
  const imagePath = getOptionalString(formData, "image_path");
  const href = getString(formData, "href") || "/#events";
  const tileType = getString(formData, "tile_type") || "navigation";
  const isActive = formData.get("is_active") === "on";

  if (!title) {
    go("Titel er påkrævet.");
  }

  const supabase = await createClient();
  const payload = {
    title,
    description,
    image_path: imagePath,
    href,
    tile_type: tileType,
    is_active: isActive,
    sort_order: sortOrder(formData),
  };

  const result = id
    ? await supabase.from("homepage_tiles").update(payload).eq("id", id)
    : await supabase.from("homepage_tiles").insert(payload);

  if (result.error) {
    go("Boksen kunne ikke gemmes. Tjek at database-migrationen er kørt.");
  }

  revalidatePath("/");
  revalidatePath("/admin/homepage");
  go("Boksen er gemt.");
}

export async function deleteHomepageTileAction(formData: FormData) {
  await requireRole("admin");

  const id = getString(formData, "id");
  if (!id) {
    go("Boksen mangler ID.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("homepage_tiles").delete().eq("id", id);

  if (error) {
    go("Boksen kunne ikke slettes.");
  }

  revalidatePath("/");
  revalidatePath("/admin/homepage");
  go("Boksen er slettet.");
}
