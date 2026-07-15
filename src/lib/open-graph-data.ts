import { resolveLogoUrl, storagePublicUrl } from "@/lib/open-graph-core";

export async function fetchOpenGraphRows<T>(path: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const key = serviceKey || anonKey;

  if (!supabaseUrl || !key) return [];

  try {
    const response = await fetch(supabaseUrl + "/rest/v1/" + path, {
      headers: {
        apikey: key,
        authorization: "Bearer " + key,
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) return [];
    return (await response.json()) as T[];
  } catch {
    return [];
  }
}

export async function getHomepageOpenGraphImageUrl() {
  const rows = await fetchOpenGraphRows<{ image_path: string | null }>(
    "hero_images?select=image_path&scope=eq.homepage&is_active=eq.true&order=sort_order.asc&limit=5",
  );
  const imagePath = rows.find((row) => row.image_path)?.image_path ?? null;
  return storagePublicUrl(imagePath);
}

export async function getOpenGraphLogoUrl() {
  const rows = await fetchOpenGraphRows<{ value: string | null }>("site_settings?select=value&key=eq.brand_logo_path&limit=1");
  return resolveLogoUrl(rows[0]?.value ?? null);
}
