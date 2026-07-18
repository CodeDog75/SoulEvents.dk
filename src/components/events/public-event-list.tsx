import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CalendarDays, Clock3, MapPinned, Ticket } from "lucide-react";
import { CapacityBadge } from "@/components/events/capacity-badge";
import { EventDateBox, EventImageStatusTag, formatEventTime } from "@/components/events/event-card-overlays";
import { publicEventPath } from "@/lib/slug";

export type PublicEvent = {
  id: string;
  slug?: string | null;
  status?: string | null;
  title: string;
  short_description: string;
  starts_at: string;
  created_at?: string | null;
  city: string | null;
  price_cents: number;
  capacity?: number | null;
  available_seats?: number | null;
  cover_image_path?: string | null;
  event_format?: string | null;
  distance_km?: number | null;
  facilitator_profiles:
    | {
        company_name: string | null;
        profiles:
          | {
              full_name: string;
            }
          | Array<{
              full_name: string;
            }>
          | null;
      }
    | Array<{
        company_name: string | null;
        profiles:
          | {
              full_name: string;
            }
          | Array<{
              full_name: string;
            }>
          | null;
      }>
    | null;
  regions:
    | {
        name: string;
      }
    | Array<{
        name: string;
      }>
    | null;
  event_categories?: Array<{
    categories:
      | {
          name: string;
          color_hex: string;
        }
      | Array<{
          name: string;
          color_hex: string;
        }>
      | null;
  }>;
  event_main_categories?: Array<{
    main_category_id?: string | null;
    main_categories?:
      | {
          name?: string | null;
          color_hex?: string | null;
          image_path?: string | null;
        }
      | Array<{
          name?: string | null;
          color_hex?: string | null;
          image_path?: string | null;
        }>
      | null;
  }>;
  event_subcategories?: Array<{
    subcategory_id?: string | null;
    subcategories?:
      | {
          name?: string | null;
          slug?: string | null;
        }
      | Array<{
          name?: string | null;
          slug?: string | null;
      }>
      | null;
  }>;
  event_tags?: Array<{
    tag_id?: string | null;
    tags?:
      | {
          name?: string | null;
        }
      | Array<{
          name?: string | null;
        }>
      | null;
  }>;
};

type PublicEventListProps = {
  events: PublicEvent[];
  layout?: "grid" | "stack";
};

function uniqueEventsById<T extends { id: string }>(events: T[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.id)) {
      return false;
    }

    seen.add(event.id);
    return true;
  });
}

function formatEventFormat(format?: string | null) {
  if (format === "online") return "💻 Online";
  return "📍 Fysisk";
}

function formatPrice(priceCents: number) {
  if (priceCents === 0) return "Gratis";
  return new Intl.NumberFormat("da-DK").format(priceCents / 100) + " kr.";
}

function formatDistance(distanceKm?: number | null) {
  if (typeof distanceKm !== "number" || !Number.isFinite(distanceKm)) return null;
  return Math.max(1, Math.round(distanceKm)) + " km væk";
}

function publicMediaUrl(imagePath?: string | null) {
  if (!imagePath) return null;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  const encodedPath = imagePath.split("/").map(encodeURIComponent).join("/");
  return supabaseUrl.replace(/\/$/, "") + "/storage/v1/object/public/media/" + encodedPath;
}

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function PublicEventList({ events, layout = "grid" }: PublicEventListProps) {
  if (events.length === 0) {
    return (
      <section className="rounded-card bg-white p-8 text-center shadow-soft">
        <CalendarDays className="mx-auto size-8 text-sage-700" aria-hidden="true" />
        <h2 className="mt-4 text-3xl font-medium text-olive">Ingen events matcher filtrene</h2>
        <p className="mt-2 text-sm text-ink/64">Prøv at udvide søgningen eller vælge et andet område.</p>
      </section>
    );
  }

  return (
    <section className={layout === "stack" ? "grid gap-4" : "grid gap-4 md:grid-cols-2 xl:grid-cols-3"}>
      {uniqueEventsById(events).map((event) => {
        const facilitatorProfile = Array.isArray(event.facilitator_profiles)
          ? event.facilitator_profiles[0]
          : event.facilitator_profiles;
        const facilitatorUser = Array.isArray(facilitatorProfile?.profiles)
          ? facilitatorProfile?.profiles[0]
          : facilitatorProfile?.profiles;
        const region = Array.isArray(event.regions) ? event.regions[0] : event.regions;
        const facilitator = facilitatorProfile?.company_name || facilitatorUser?.full_name || "Arrangør";
        const categories =
          event.event_categories
            ?.map((row) => (Array.isArray(row.categories) ? row.categories[0] : row.categories))
            .filter((category): category is NonNullable<typeof category> => Boolean(category)) ?? [];
        const mainCategories =
          event.event_main_categories
            ?.map((row) => first(row.main_categories))
            .filter((category): category is NonNullable<typeof category> => Boolean(category)) ?? [];
        const categoryImageUrl = publicMediaUrl(mainCategories.find((category) => category.image_path)?.image_path);
        const eventImageUrl = publicMediaUrl(event.cover_image_path) ?? categoryImageUrl;
        const imageFallbackColor = mainCategories[0]?.color_hex || categories[0]?.color_hex || "#D89A94";
        const distance = formatDistance(event.distance_km);
        const locationText = event.event_format === "online"
          ? "Online event"
          : [event.city, region?.name].filter(Boolean).join(", ") || "Lokation kommer snart";

        return (
          <Link
            href={publicEventPath(event.slug || event.id)}
            className="group block overflow-hidden rounded-card border border-olive/10 bg-white shadow-soft transition hover:-translate-y-0.5 hover:border-sage-700/25 hover:shadow-lift"
            key={event.id}
          >
            <div
              className="relative aspect-[16/10] overflow-hidden bg-[#FAF6EF]"
              style={
                eventImageUrl
                  ? undefined
                  : {
                      background:
                        "radial-gradient(circle at 18% 20%, rgba(255,255,255,0.88), transparent 32%), linear-gradient(135deg, " +
                        imageFallbackColor +
                        "33, #FAF6EF 56%, #EDE4F7)",
                    }
              }
            >
              {eventImageUrl ? (
                <Image
                  alt=""
                  className="object-cover transition duration-500 group-hover:scale-[1.03]"
                  fill
                  sizes={layout === "stack" ? "(min-width: 768px) 360px, 100vw" : "(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"}
                  src={eventImageUrl}
                />
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center">
                  <span className="font-serif text-3xl font-medium leading-tight text-olive">
                    {mainCategories[0]?.name || categories[0]?.name || "SoulEvents"}
                  </span>
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#2F2633]/12 to-transparent" aria-hidden="true" />
              <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2 sm:left-4 sm:right-4 sm:top-4">
                <EventDateBox startsAt={event.starts_at} />
                <EventImageStatusTag availableSeats={event.available_seats} capacity={event.capacity} status={event.status} />
              </div>
              <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2 sm:bottom-4 sm:left-4 sm:right-4">
                {categories.slice(0, 2).map((category) => (
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold text-white shadow-soft"
                    key={category.name}
                    style={{ backgroundColor: category.color_hex }}
                  >
                    {category.name}
                  </span>
                ))}
                <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-ink/60 shadow-soft">
                  {formatEventFormat(event.event_format)}
                </span>
              </div>
            </div>

            <div className="p-5">
              <h2 className="text-2xl font-medium leading-7 text-olive">{event.title}</h2>
              <p className="mt-1 text-sm font-semibold text-sage-700">{facilitator}</p>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-ink/66">{event.short_description}</p>

              <div className="mt-4 grid gap-2 text-sm text-ink/70">
                <div className="flex items-center gap-2">
                  <Clock3 className="size-4 text-rose" aria-hidden="true" />
                  Kl. {formatEventTime(event.starts_at)}
                </div>
                <div className="flex items-center gap-2">
                  <MapPinned className="size-4 text-sage-700" aria-hidden="true" />
                  {distance ? distance + " · " + locationText : locationText}
                </div>
                <CapacityBadge availableSeats={event.available_seats} capacity={event.capacity} compact status={event.status} />
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-olive/10 pt-4 text-sm">
                <span className="flex items-center gap-2 font-semibold text-olive">
                  <Ticket className="size-4 text-olive" aria-hidden="true" />
                  {formatPrice(event.price_cents)}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose">
                  Se event
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
