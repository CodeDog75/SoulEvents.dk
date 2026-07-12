import type { SupabaseClient } from "@supabase/supabase-js";
import type { LegalDocumentType } from "@/types/database";

export const legalDocumentLinks: Partial<Record<LegalDocumentType, { label: string; slug: string }>> = {
  guidelines: { label: "retningslinjer for events og indhold", slug: "platformens-retningslinjer" },
  organizer_terms: { label: "arrangørvilkår", slug: "arrangoervilkaar" },
  privacy: { label: "privatlivspolitikken", slug: "privatlivspolitik" },
  terms: { label: "brugervilkår", slug: "handelsbetingelser" },
  cookies: { label: "cookiepolitikken", slug: "cookiepolitik" },
};

export const organizerAcceptanceTypes: LegalDocumentType[] = ["organizer_terms", "guidelines"];
export const bookingAcceptanceTypes: LegalDocumentType[] = ["terms", "privacy", "guidelines"];

export type LegalDocumentVersion = {
  body?: string | null;
  document_type: LegalDocumentType;
  effective_at: string;
  id: string;
  requires_acceptance: boolean;
  slug: string;
  title: string;
  version: string;
};

type SupabaseLike = SupabaseClient<any, "public", any>;

export async function getCurrentLegalDocumentVersions(supabase: SupabaseLike, types: LegalDocumentType[]) {
  if (types.length === 0) {
    return new Map<LegalDocumentType, LegalDocumentVersion>();
  }

  const { data, error } = await supabase
    .from("legal_document_versions")
    .select("id, document_type, title, slug, body, version, effective_at, requires_acceptance")
    .in("document_type", types)
    .lte("effective_at", new Date().toISOString())
    .order("effective_at", { ascending: false })
    .order("published_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const versions = new Map<LegalDocumentType, LegalDocumentVersion>();

  for (const version of (data ?? []) as LegalDocumentVersion[]) {
    if (!versions.has(version.document_type)) {
      versions.set(version.document_type, version);
    }
  }

  return versions;
}

export async function getMissingRequiredLegalAcceptances(
  supabase: SupabaseLike,
  profileId: string,
  documentTypes: LegalDocumentType[],
) {
  const versions = await getCurrentLegalDocumentVersions(supabase, documentTypes);
  const requiredVersions = [...versions.values()].filter((version) => version.requires_acceptance);

  if (requiredVersions.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("legal_document_acceptances")
    .select("document_version_id")
    .eq("profile_id", profileId)
    .in(
      "document_version_id",
      requiredVersions.map((version) => version.id),
    );

  if (error) {
    throw new Error(error.message);
  }

  const acceptedVersionIds = new Set((data ?? []).map((acceptance: { document_version_id: string }) => acceptance.document_version_id));
  return requiredVersions.filter((version) => !acceptedVersionIds.has(version.id));
}

export async function recordLegalAcceptances(
  supabase: SupabaseLike,
  input: {
    action: string;
    documentTypes: LegalDocumentType[];
    profileId: string;
  },
) {
  const versions = await getCurrentLegalDocumentVersions(supabase, input.documentTypes);
  const rows = [...versions.values()]
    .filter((version) => version.requires_acceptance)
    .map((version) => ({
      action: input.action,
      document_type: version.document_type,
      document_version_id: version.id,
      profile_id: input.profileId,
      version: version.version,
    }));

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase.from("legal_document_acceptances").upsert(rows, {
    onConflict: "profile_id,document_version_id,action",
  });

  if (error) {
    throw new Error(error.message);
  }
}
