import { getHomepageOpenGraphImageUrl } from "@/lib/open-graph-data";
import { renderOpenGraphImage } from "@/lib/open-graph-render";

export const alt = "SoulEvents.dk";
export const contentType = "image/png";
export const runtime = "edge";
export const size = {
  height: 630,
  width: 1200,
};

export default async function OpenGraphImage() {
  const imageUrl = await getHomepageOpenGraphImageUrl();

  return renderOpenGraphImage({
    imageUrl,
    subtitle: "Find events, arrangører og fællesskaber i Danmark.",
    title: "SoulEvents.dk",
  });
}
