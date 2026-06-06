"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { getString } from "@/lib/forms/form-data";
import { createClient } from "@/lib/supabase/server";

const allowedTypes = ["terms", "privacy", "guidelines"] as const;

function legalRedirect(message: string): never {
  redirect(`/admin/legal?message=${encodeURIComponent(message)}`);
}

export async function updateLegalDocumentAction(formData: FormData) {
  await requireRole("admin");

  const type = getString(formData, "type") as (typeof allowedTypes)[number];
  const title = getString(formData, "title");
  const slug = getString(formData, "slug");
  const body = getString(formData, "body");
  const isPublished = formData.get("is_published") === "on";

  if (!allowedTypes.includes(type)) {
    legalRedirect("Dokumenttypen er ugyldig.");
  }

  if (!title || !slug) {
    legalRedirect("Titel og link er nødvendige.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("legal_documents")
    .update({
      body,
      is_published: isPublished,
      published_at: isPublished ? new Date().toISOString() : null,
      slug,
      title,
    })
    .eq("type", type);

  if (error) {
    legalRedirect("Dokumentet kunne ikke gemmes.");
  }

  revalidatePath("/admin/legal");
  revalidatePath(`/legal/${slug}`);
  revalidatePath("/auth/signup");
  legalRedirect("Dokumentet er gemt.");
}
