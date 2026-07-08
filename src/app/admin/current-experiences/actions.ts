"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { getAllStrings, getOptionalNumber, getOptionalString, getString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_PATH = "/admin/current-experiences";

function isChecked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function getSelectionMode(formData: FormData) {
  return getString(formData, "selection_mode") === "manual" ? "manual" : "automatic";
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function redirectWith(params: Record<string, string>): never {
  const searchParams = new URLSearchParams(params);
  redirect(`${ADMIN_PATH}?${searchParams.toString()}`);
}

async function replaceCollectionTags(admin: any, collectionId: string, tagIds: string[]) {
  const { error: deleteError } = await admin.from("homepage_event_collection_tags").delete().eq("collection_id", collectionId);

  if (deleteError) {
    return deleteError;
  }

  if (!tagIds.length) {
    return null;
  }

  const { error: insertError } = await admin.from("homepage_event_collection_tags").insert(
    tagIds.map((tagId) => ({
      collection_id: collectionId,
      tag_id: tagId,
    })),
  );

  return insertError ?? null;
}

export async function upsertHomepageEventCollectionAction(formData: FormData) {
  await requireRole("admin");

  const id = getOptionalString(formData, "id");
  const title = getString(formData, "title");
  const showOnMobile = isChecked(formData, "show_on_mobile");
  const showOnDesktop = isChecked(formData, "show_on_desktop");

  if (!title) {
    redirectWith({ error: "Overskrift er påkrævet." });
  }

  if (!showOnMobile && !showOnDesktop) {
    redirectWith({ error: "Vælg mindst én visning: mobil eller desktop." });
  }

  const admin = createAdminClient() as any;
  const payload = {
    title,
    description: getOptionalString(formData, "description"),
    is_active: isChecked(formData, "is_active"),
    sort_order: getOptionalNumber(formData, "sort_order") ?? 0,
    show_on_mobile: showOnMobile,
    show_on_desktop: showOnDesktop,
    selection_mode: getSelectionMode(formData),
  };
  const tagIds = unique(getAllStrings(formData, "tag_ids"));

  const result = id
    ? await admin.from("homepage_event_collections").update(payload).eq("id", id).select("id").single()
    : await admin.from("homepage_event_collections").insert(payload).select("id").single();

  if (result.error || !result.data?.id) {
    console.error("Homepage event collection save failed", result.error);
    redirectWith({ error: "Sektionen kunne ikke gemmes." });
  }

  const tagError = await replaceCollectionTags(admin, result.data.id, tagIds);

  if (tagError) {
    console.error("Homepage event collection tags save failed", tagError);
    redirectWith({ error: "Sektionen blev gemt, men tags kunne ikke opdateres.", saved: result.data.id });
  }

  revalidatePath(ADMIN_PATH);
  revalidatePath("/admin");
  revalidatePath("/");
  redirectWith({ message: "Aktuel oplevelse er gemt.", saved: result.data.id });
}

export async function deleteHomepageEventCollectionAction(formData: FormData) {
  await requireRole("admin");

  const id = getString(formData, "id");
  const admin = createAdminClient() as any;
  const { error } = await admin.from("homepage_event_collections").delete().eq("id", id);

  if (error) {
    console.error("Homepage event collection delete failed", error);
    redirectWith({ error: "Sektionen kunne ikke slettes." });
  }

  revalidatePath(ADMIN_PATH);
  revalidatePath("/admin");
  revalidatePath("/");
  redirectWith({ message: "Aktuel oplevelse er slettet." });
}
