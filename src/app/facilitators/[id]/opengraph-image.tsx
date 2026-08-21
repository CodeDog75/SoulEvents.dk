import { fetchOpenGraphRows, getHomepageOpenGraphImageUrl } from "@/lib/open-graph-data";
import { absoluteUrl, storagePublicUrl, stripHtml } from "@/lib/open-graph-core";
import { renderOpenGraphImage } from "@/lib/open-graph-render";
import { resolveFacilitatorBanner } from "@/lib/facilitators/hero-collection";

export const alt = "Arrangør på SoulEvents.dk";
export const contentType = "image/png";
export const runtime = "edge";
export const size = {
  height: 630,
  width: 1200,
};

type FacilitatorOpenGraphRow = {
  company_name: string | null;
  facilitator_banner_image_path: string | null;
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
    "facilitator_profiles?select=company_name,facilitator_banner_image_path,profile_image_path,short_description,long_description,profiles!facilitator_profiles_profile_id_fkey(full_name)&" +
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
  const banner = resolveFacilitatorBanner({
    bannerImagePath: facilitator.facilitator_banner_image_path,
    fallbackAltText: "SoulEvents standardbanner",
    resolveImagePath: (imagePath) => storagePublicUrl(imagePath),
  });
  const heroImageUrl = banner.isFallback ? absoluteUrl(banner.url) : banner.url;
  const imageUrl = heroImageUrl ?? storagePublicUrl(facilitator.profile_image_path) ?? (await getHomepageOpenGraphImageUrl());
  const description = stripHtml(facilitator.short_description || facilitator.long_description) || "Find arrangørprofil på SoulEvents.dk.";

  return renderOpenGraphImage({
    imageUrl,
    subtitle: "Arrangør på SoulEvents.dk. " + description,
    title: name,
  });
}
