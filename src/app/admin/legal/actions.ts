"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { getString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";

const allowedTypes = ["terms", "privacy", "guidelines", "organizer_terms", "cookies"] as const;
const danishTimeZone = "Europe/Copenhagen";

function legalRedirect(message: string): never {
  redirect(`/admin/legal?message=${encodeURIComponent(message)}`);
}

function danishDateStartIso(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const targetUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  let candidate = new Date(targetUtc);

  for (let index = 0; index < 2; index += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
      timeZone: danishTimeZone,
      year: "numeric",
    }).formatToParts(candidate);
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const candidateAsDanishUtc = Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour"),
      value("minute"),
      value("second"),
    );

    candidate = new Date(candidate.getTime() - (candidateAsDanishUtc - targetUtc));
  }

  return candidate.toISOString();
}

export async function updateLegalDocumentAction(formData: FormData) {
  const adminProfile = await requireRole("admin");

  const type = getString(formData, "type") as (typeof allowedTypes)[number];
  const title = getString(formData, "title");
  const slug = getString(formData, "slug");
  const body = getString(formData, "body");
  const version = getString(formData, "version") || "1.0";
  const effectiveAt = getString(formData, "effective_at");
  const intent = getString(formData, "intent") || "save_draft";
  const requiresAcceptance = formData.get("requires_acceptance") === "on";

  if (!allowedTypes.includes(type)) {
    legalRedirect("Dokumenttypen er ugyldig.");
  }

  if (!title || !slug) {
    legalRedirect("Titel og link er nødvendige.");
  }

  const supabase = createAdminClient();
  const resolvedEffectiveAt = effectiveAt ? danishDateStartIso(effectiveAt) : null;

  if (effectiveAt && !resolvedEffectiveAt) {
    legalRedirect("Datoen for ikrafttrædelse er ugyldig.");
  }

  const documentUpdate = {
    body,
    effective_at: resolvedEffectiveAt,
    requires_acceptance: requiresAcceptance,
    slug,
    title,
    version,
  };

  const { data: document, error: updateError } = await supabase
    .from("legal_documents")
    .update(documentUpdate)
    .eq("type", type)
    .select("id")
    .maybeSingle();

  if (updateError || !document) {
    legalRedirect("Dokumentet kunne ikke gemmes.");
  }

  if (intent === "publish") {
    const publishedAt = new Date().toISOString();
    const publishEffectiveAt = resolvedEffectiveAt ?? publishedAt;
    const { data: versionRow, error: versionError } = await supabase
      .from("legal_document_versions")
      .insert({
        body,
        created_by: adminProfile.id,
        document_id: document.id,
        document_type: type,
        effective_at: publishEffectiveAt,
        published_at: publishedAt,
        requires_acceptance: requiresAcceptance,
        slug,
        title,
        version,
      })
      .select("id")
      .single();

    if (versionError || !versionRow) {
      legalRedirect(versionError?.code === "23505" ? "Versionsnummeret findes allerede for dette dokument." : "Dokumentet kunne ikke udgives.");
    }

    const { error: publishError } = await supabase
      .from("legal_documents")
      .update({
        current_version_id: versionRow.id,
        effective_at: publishEffectiveAt,
        is_published: true,
        published_at: publishedAt,
      })
      .eq("id", document.id);

    if (publishError) {
      legalRedirect("Dokumentet blev udgivet, men kunne ikke markeres som gældende.");
    }
  }

  revalidatePath("/admin/legal");
  revalidatePath(`/legal/${slug}`);
  revalidatePath("/legal/[slug]", "page");
  revalidatePath("/auth/login");
  legalRedirect(intent === "publish" ? "Ny dokumentversion er udgivet." : "Kladde er gemt.");
}
