import type { MetadataRoute } from "next";
import { siteBaseUrl } from "@/lib/open-graph";
import { createAdminClient } from "@/lib/supabase/admin";

type SitemapEntry = MetadataRoute.Sitemap[number];
type TimestampRow = {
  created_at?: string | null;
  effective_at?: string | null;
  published_at?: string | null;
  starts_at?: string | null;
  updated_at?: string | null;
};

function publicSiteUrl() {
  if (process.env.NODE_ENV === "production") return "https://www.soulevents.dk";
  return siteBaseUrl();
}

function entry(path: string, row?: TimestampRow | null): SitemapEntry {
  const timestamp = row?.updated_at ?? row?.published_at ?? row?.effective_at ?? row?.starts_at ?? row?.created_at ?? null;

  return {
    url: publicSiteUrl() + (path.startsWith("/") ? path : "/" + path),
    ...(timestamp ? { lastModified: new Date(timestamp) } : {}),
  };
}

function logSitemapError(source: string, error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "Unknown sitemap source error";

  console.error("Sitemap source failed", { message, source });
}

async function safeRows<T>(source: string, loader: () => Promise<T[]>): Promise<T[]> {
  try {
    return await loader();
  } catch (error) {
    logSitemapError(source, error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const staticEntries: SitemapEntry[] = [
    entry("/"),
    entry("/about"),
    entry("/bliv-arrangoer"),
    entry("/contact"),
    entry("/events"),
    entry("/facilitators"),
    entry("/inspiration"),
    entry("/privacy"),
    entry("/terms"),
    entry("/data-deletion"),
    entry("/legal/cookies"),
  ];

  const [categories, facilitators, events, legalDocuments, inspirators] = await Promise.all([
    safeRows("main_categories", async () => {
      const { data, error } = await admin
        .from("main_categories")
        .select("slug, updated_at")
        .eq("is_active", true)
        .not("slug", "is", null)
        .order("sort_order");

      if (error) throw error;
      return (data ?? []) as Array<{ slug: string; updated_at: string | null }>;
    }),
    safeRows("facilitator_profiles", async () => {
      const { data, error } = await admin
        .from("facilitator_profiles")
        .select("id, updated_at")
        .eq("status", "approved")
        .eq("is_paused", false)
        .eq("is_disabled", false)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Array<{ id: string; updated_at: string | null }>;
    }),
    safeRows("events", async () => {
      const { data, error } = await admin
        .from("events")
        .select("id, updated_at, starts_at, ends_at, facilitator_profiles!inner(status, is_paused, is_disabled)")
        .in("status", ["active", "sold_out"])
        .or("ends_at.gte." + now + ",and(ends_at.is.null,starts_at.gte." + now + ")")
        .eq("facilitator_profiles.status", "approved")
        .eq("facilitator_profiles.is_paused", false)
        .eq("facilitator_profiles.is_disabled", false)
        .order("starts_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as Array<{ id: string; starts_at: string | null; updated_at: string | null }>;
    }),
    safeRows("legal_documents", async () => {
      const { data, error } = await admin
        .from("legal_documents")
        .select("slug, updated_at, published_at, effective_at")
        .eq("is_published", true)
        .not("slug", "is", null)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Array<{ effective_at: string | null; published_at: string | null; slug: string; updated_at: string | null }>;
    }),
    safeRows("inspirator_profiles", async () => {
      const { data, error } = await admin
        .from("inspirator_profiles")
        .select("slug, updated_at")
        .eq("is_active", true)
        .not("slug", "is", null)
        .order("sort_order");

      if (error) throw error;
      return (data ?? []) as Array<{ slug: string; updated_at: string | null }>;
    }),
  ]);

  const dynamicEntries = [
    ...categories.map((category) => entry("/categories/" + category.slug, category)),
    ...facilitators.map((facilitator) => entry("/facilitators/" + facilitator.id, facilitator)),
    ...events.map((event) => entry("/events/" + event.id, event)),
    ...legalDocuments.map((document) => entry("/legal/" + document.slug, document)),
    ...inspirators.map((inspirator) => entry("/inspiration/" + inspirator.slug, inspirator)),
  ];

  const uniqueEntries = new Map<string, SitemapEntry>();

  for (const item of [...staticEntries, ...dynamicEntries]) {
    uniqueEntries.set(item.url, item);
  }

  return [...uniqueEntries.values()];
}
