"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { getOptionalString, getString } from "@/lib/forms/form-data";
import { createSlug } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";

function go(message: string): never {
  redirect("/admin/service-titles?message=" + encodeURIComponent(message));
}

function sortOrder(formData: FormData) {
  const value = Number(getString(formData, "sort_order"));
  return Number.isFinite(value) ? value : 0;
}

async function uniqueSlug(baseSlug: string, id?: string | null) {
  const supabase = createAdminClient();
  let candidate = baseSlug || "titel";

  for (let suffix = 2; suffix < 100; suffix += 1) {
    let query = supabase.from("service_titles").select("id").eq("slug", candidate);
    if (id) {
      query = query.neq("id", id);
    }
    const { data } = await query.maybeSingle();
    if (!data) return candidate;
    candidate = baseSlug + "-" + suffix;
  }

  return baseSlug + "-" + crypto.randomUUID().slice(0, 8);
}

export async function upsertServiceTitleAction(formData: FormData) {
  await requireRole("admin");
  const supabase = createAdminClient();
  const id = getOptionalString(formData, "id");
  const name = getString(formData, "name");

  if (!name) {
    go("Navn er påkrævet.");
  }

  const slug = await uniqueSlug(getOptionalString(formData, "slug") || createSlug(name), id);
  const payload = {
    name,
    slug,
    description: getOptionalString(formData, "description"),
    is_active: formData.get("is_active") === "on",
    sort_order: sortOrder(formData),
  };

  const result = id
    ? await supabase.from("service_titles").update(payload).eq("id", id)
    : await supabase.from("service_titles").insert(payload);

  if (result.error) {
    go("Titlen kunne ikke gemmes: " + result.error.message);
  }

  revalidatePath("/admin/service-titles");
  go("Gemt.");
}

export async function deactivateServiceTitleAction(formData: FormData) {
  await requireRole("admin");
  const id = getString(formData, "id");
  if (!id) {
    go("Ugyldig titel.");
  }

  const { error } = await createAdminClient()
    .from("service_titles")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    go("Titlen kunne ikke deaktiveres.");
  }

  revalidatePath("/admin/service-titles");
  go("Titlen er deaktiveret.");
}
