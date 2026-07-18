import { fetchOpenGraphRows, getHomepageOpenGraphImageUrl } from "@/lib/open-graph-data";
import { absoluteUrl, storagePublicUrl, stripHtml } from "@/lib/open-graph-core";
import { renderOpenGraphImage } from "@/lib/open-graph-render";
import { resolveFacilitatorHero } from "@/lib/facilitators/hero-collection";

export const alt = "Arrangør på SoulEvents.dk";
export const contentType = "image/png";
export const runtime = "edge";
export const size = {
  height: 630,
  width: 1200,
};

type FacilitatorOpenGraphRow = {
  company_name: string | null;
  facilitator_hero_key: string | null;
  facilitator_images?: Array<{ image_path: string | null; sort_order: number | null }> | null;
  long_description: string | null;
  profile_image_path: string | null;
  profiles?: { full_name: string | null } | null;
  short_description: string | null;
};

type OpenGraphImageProps = {
  params: Promise<{ id?: string; slug?: string }>;
};

export default async function FacilitatorOpenGraphImage({ params }: OpenGraphImageProps) {
  const { id, slug } = await params;
  const identifier = slug ?? id ?? "";
  const lookupColumn = slug ? "slug" : "id";
  const rows = await fetchOpenGraphRows<FacilitatorOpenGraphRow>(
    "facilitator_profiles?select=company_name,facilitator_hero_key,profile_image_path,short_description,long_description,profiles!facilitator_profiles_profile_id_fkey(full_name),facilitator_images(image_path,sort_order)&" +
      lookupColumn +
      "=eq." +
      encodeURIComponent(identifier) +
      "&status=eq.approved&is_paused=eq.false&is_disabled=eq.false&limit=1",
  );
  const facilitator = rows[0] ?? null;

  if (!facilitator) {
    return renderOpenGraphImage({
      imageUrl: await getHomepageOpenGraphImageUrl(),
      subtitle: "Find arrangører på SoulEvents.dk.",
      title: "Arrangør | SoulEvents.dk",
    });
  }

  const name = facilitator.company_name || facilitator.profiles?.full_name || "Arrangør";
  const hero = resolveFacilitatorHero({
    heroKey: facilitator.facilitator_hero_key,
    moodImages: (facilitator.facilitator_images ?? []).map((image) => ({
      imagePath: image.image_path,
      sortOrder: image.sort_order,
    })),
    preferCustomWhenUnset: true,
    resolveImagePath: (imagePath) => storagePublicUrl(imagePath),
  });
  const heroImageUrl = hero.source === "collection" ? absoluteUrl(hero.url) : hero.url;
  const imageUrl = storagePublicUrl(facilitator.profile_image_path) ?? heroImageUrl ?? (await getHomepageOpenGraphImageUrl());
  const description = stripHtml(facilitator.short_description || facilitator.long_description) || "Find arrangørprofil på SoulEvents.dk.";

  return renderOpenGraphImage({
    imageUrl,
    subtitle: "Arrangør på SoulEvents.dk. " + description,
    title: name,
  });
}
