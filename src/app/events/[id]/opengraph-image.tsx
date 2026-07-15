import { fetchOpenGraphRows, getHomepageOpenGraphImageUrl } from "@/lib/open-graph-data";
import { storagePublicUrl, stripHtml } from "@/lib/open-graph-core";
import { renderOpenGraphImage } from "@/lib/open-graph-render";

export const alt = "Event på SoulEvents.dk";
export const contentType = "image/png";
export const runtime = "edge";
export const size = {
  height: 630,
  width: 1200,
};

type EventOpenGraphRow = {
  cover_image_path: string | null;
  ends_at: string | null;
  event_images?: Array<{ image_path: string | null; sort_order: number | null }> | null;
  event_main_categories?: Array<{ main_categories?: { image_path: string | null; name: string | null } | null }> | null;
  facilitator_profiles?: {
    company_name: string | null;
    is_disabled: boolean | null;
    is_paused: boolean | null;
    profiles?: { full_name: string | null } | null;
    status: string | null;
  } | null;
  long_description: string | null;
  short_description: string | null;
  starts_at: string;
  status: string;
  title: string;
};

type OpenGraphImageProps = {
  params: Promise<{ id: string }>;
};

function firstImagePath(images: EventOpenGraphRow["event_images"]) {
  return [...(images ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).find((image) => image.image_path)?.image_path ?? null;
}

function firstCategoryImagePath(categories: EventOpenGraphRow["event_main_categories"]) {
  return (categories ?? []).map((row) => row.main_categories).find((category) => category?.image_path)?.image_path ?? null;
}

export default async function EventOpenGraphImage({ params }: OpenGraphImageProps) {
  const { id } = await params;
  const encodedId = encodeURIComponent(id);
  const rows = await fetchOpenGraphRows<EventOpenGraphRow>(
    "events?select=title,short_description,long_description,status,starts_at,ends_at,cover_image_path,event_images(image_path,sort_order),event_main_categories(main_categories(name,image_path)),facilitator_profiles(status,is_paused,is_disabled,company_name,profiles!facilitator_profiles_profile_id_fkey(full_name))&id=eq." +
      encodedId +
      "&limit=1",
  );
  const event = rows[0] ?? null;
  const facilitator = event?.facilitator_profiles ?? null;
  const isPublished = event ? ["active", "sold_out"].includes(event.status) : false;
  const isExpired = event ? new Date(event.ends_at ?? event.starts_at) < new Date() : true;
  const isPublic =
    isPublished &&
    !isExpired &&
    facilitator?.status === "approved" &&
    !facilitator?.is_paused &&
    !facilitator?.is_disabled;

  if (!event || !isPublic) {
    return renderOpenGraphImage({
      imageUrl: await getHomepageOpenGraphImageUrl(),
      subtitle: "Find nærværende events på SoulEvents.dk.",
      title: "Event | SoulEvents.dk",
    });
  }

  const imagePath = event.cover_image_path || firstImagePath(event.event_images) || firstCategoryImagePath(event.event_main_categories);
  const imageUrl = storagePublicUrl(imagePath) ?? (await getHomepageOpenGraphImageUrl());
  const facilitatorName = facilitator?.company_name || facilitator?.profiles?.full_name || "SoulEvents";
  const description = stripHtml(event.short_description || event.long_description) || "Se eventet og arrangøren på SoulEvents.dk.";

  return renderOpenGraphImage({
    imageUrl,
    subtitle: "Event af " + facilitatorName + ". " + description,
    title: event.title,
  });
}
