import { fetchOpenGraphRows, getHomepageOpenGraphImageUrl } from "@/lib/open-graph-data";
import { storagePublicUrl, stripHtml } from "@/lib/open-graph-core";
import { renderOpenGraphImage } from "@/lib/open-graph-render";

export const alt = "Arrangør på SoulEvents.dk";
export const contentType = "image/png";
export const runtime = "edge";
export const size = {
  height: 630,
  width: 1200,
};

type FacilitatorOpenGraphRow = {
  company_name: string | null;
  facilitator_images?: Array<{ image_path: string | null; sort_order: number | null }> | null;
  long_description: string | null;
  profile_image_path: string | null;
  profiles?: { full_name: string | null } | null;
  short_description: string | null;
};

type OpenGraphImageProps = {
  params: Promise<{ id: string }>;
};

function firstGalleryImagePath(images: FacilitatorOpenGraphRow["facilitator_images"]) {
  return [...(images ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).find((image) => image.image_path)?.image_path ?? null;
}

export default async function FacilitatorOpenGraphImage({ params }: OpenGraphImageProps) {
  const { id } = await params;
  const rows = await fetchOpenGraphRows<FacilitatorOpenGraphRow>(
    "facilitator_profiles?select=company_name,profile_image_path,short_description,long_description,profiles!facilitator_profiles_profile_id_fkey(full_name),facilitator_images(image_path,sort_order)&id=eq." +
      encodeURIComponent(id) +
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
  const imagePath = facilitator.profile_image_path || firstGalleryImagePath(facilitator.facilitator_images);
  const imageUrl = storagePublicUrl(imagePath) ?? (await getHomepageOpenGraphImageUrl());
  const description = stripHtml(facilitator.short_description || facilitator.long_description) || "Find arrangørprofil på SoulEvents.dk.";

  return renderOpenGraphImage({
    imageUrl,
    subtitle: "Arrangør på SoulEvents.dk. " + description,
    title: name,
  });
}
