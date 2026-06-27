import Link from "next/link";
import { CalendarDays, MapPinned, Ticket, UserRound } from "lucide-react";
import type { PublicEvent } from "@/components/events/public-event-list";
import { OrganizerImageBadge } from "@/components/badges/organizer-badges";

type FacilitatorCarouselCard = {
  id: string;
  name: string;
  imageUrl: string | null;
  tagline: string;
  city: string | null;
  categories: Array<{ name: string; color_hex: string | null }>;
  isActiveHost?: boolean;
  isExperiencedHost?: boolean;
};

type EventCarouselSectionProps = {
  title: string;
  href: string;
  events: PublicEvent[];
};

type FacilitatorCarouselSectionProps = {
  facilitators: FacilitatorCarouselCard[];
  href: string;
  title: string;
};

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatPrice(priceCents: number) {
  if (priceCents === 0) return "Gratis";
  return new Intl.NumberFormat("da-DK").format(priceCents / 100) + " kr.";
}

function publicMediaUrl(imagePath?: string | null) {
  if (!imagePath) return null;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  return supabaseUrl.replace(/\/$/, "") + "/storage/v1/object/public/media/" + imagePath.split("/").map(encodeURIComponent).join("/");
}

export function EventCardVisual({ event }: { event: PublicEvent }) {
  const facilitatorProfile = first(event.facilitator_profiles);
  const facilitatorUser = first(facilitatorProfile?.profiles);
  const region = first(event.regions);
  const facilitator = facilitatorProfile?.company_name || facilitatorUser?.full_name || "Arrangør";
  const categories =
    event.event_categories
      ?.map((row) => first(row.categories))
      .filter((category): category is NonNullable<typeof category> => Boolean(category)) ?? [];
  const mainCategories =
    event.event_main_categories
      ?.map((row) => first(row.main_categories))
      .filter((category): category is NonNullable<typeof category> => Boolean(category)) ?? [];
  const categoryImageUrl = publicMediaUrl(mainCategories.find((category) => category.image_path)?.image_path);
  const eventImageUrl = publicMediaUrl(event.cover_image_path) ?? categoryImageUrl;
  const fallbackColor = mainCategories[0]?.color_hex || categories[0]?.color_hex || "#D89A94";
  const locationText =
    event.event_format === "online"
      ? "Online event"
      : [event.city, region?.name].filter(Boolean).join(", ") || "Lokation kommer snart";

  return (
    <Link
      className="group block min-w-[78vw] max-w-[78vw] snap-start overflow-hidden rounded-[24px] bg-white shadow-soft transition hover:-translate-y-1 hover:shadow-lift sm:min-w-[320px] sm:max-w-[320px] lg:min-w-[340px] lg:max-w-[340px]"
      href={"/events/" + event.id}
    >
      <div
        className="relative aspect-[16/11] overflow-hidden bg-[#FAF6EF]"
        style={
          eventImageUrl
            ? undefined
            : {
                background:
                  "radial-gradient(circle at 20% 18%, rgba(255,255,255,0.85), transparent 34%), linear-gradient(135deg, " +
                  fallbackColor +
                  "38, #FAF6EF 56%, #EDE4F7)",
              }
        }
      >
        {eventImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" loading="lazy" src={eventImageUrl} />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <span className="font-serif text-3xl font-medium leading-tight text-olive">
              {mainCategories[0]?.name || categories[0]?.name || "SoulEvents"}
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#2F2633]/58 to-transparent" aria-hidden="true" />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          {categories.slice(0, 1).map((category) => (
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold text-white shadow-soft"
              key={category.name}
              style={{ backgroundColor: category.color_hex }}
            >
              {category.name}
            </span>
          ))}
          {event.event_format === "online" && (
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-ink/70 shadow-soft">Online</span>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <h3 className="line-clamp-2 text-[1.45rem] font-medium leading-7 text-olive">{event.title}</h3>
        <p className="mt-1 truncate text-sm font-semibold text-sage-700">{facilitator}</p>
        <div className="mt-4 grid gap-2 text-sm text-ink/68">
          <span className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0 text-rose" aria-hidden="true" />
            {new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.starts_at))}
          </span>
          <span className="flex items-center gap-2">
            <MapPinned className="size-4 shrink-0 text-sage-700" aria-hidden="true" />
            <span className="truncate">{locationText}</span>
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-olive/10 pt-4 text-sm">
          <span className="flex items-center gap-2 font-semibold text-olive">
            <Ticket className="size-4" aria-hidden="true" />
            {formatPrice(event.price_cents)}
          </span>
          <span className="font-semibold text-rose">Se event</span>
        </div>
      </div>
    </Link>
  );
}

export function EventCarouselSection({ events, href, title }: EventCarouselSectionProps) {
  if (events.length === 0) return null;

  return (
    <section className="grid gap-4">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-3xl font-medium leading-tight text-[#2F2633] sm:text-4xl">{title}</h2>
        <Link className="shrink-0 text-sm font-semibold text-[#7A4EAB] transition hover:text-olive" href={href}>
          Se alle
        </Link>
      </div>
      <div className="-mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-4 sm:-mx-8 sm:px-8">
        {events.map((event) => (
          <EventCardVisual event={event} key={event.id} />
        ))}
      </div>
    </section>
  );
}

function FacilitatorCardVisual({ facilitator }: { facilitator: FacilitatorCarouselCard }) {
  return (
    <Link
      className="group block min-w-[72vw] max-w-[72vw] snap-start overflow-hidden rounded-[24px] bg-white shadow-soft transition hover:-translate-y-1 hover:shadow-lift sm:min-w-[280px] sm:max-w-[280px] lg:min-w-[300px] lg:max-w-[300px]"
      href={"/facilitators/" + facilitator.id}
    >
      <div className="relative aspect-[4/3] bg-sage-50">
        {facilitator.isExperiencedHost ? (
          <OrganizerImageBadge type="experienced" />
        ) : facilitator.isActiveHost ? (
          <OrganizerImageBadge type="active" />
        ) : null}
        {facilitator.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={facilitator.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" loading="lazy" src={facilitator.imageUrl} />
        ) : (
          <div className="grid h-full place-items-center text-sage-700">
            <UserRound className="size-14" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="p-5">
        {facilitator.categories[0] && (
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold text-[#2F2633]"
            style={{ backgroundColor: facilitator.categories[0].color_hex ? facilitator.categories[0].color_hex + "22" : "#EEF2E3" }}
          >
            {facilitator.categories[0].name}
          </span>
        )}
        <h3 className="mt-3 line-clamp-2 text-2xl font-medium leading-7 text-olive">{facilitator.name}</h3>
        <p className="mt-1 text-sm font-semibold text-sage-700">{facilitator.city || "Danmark"}</p>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-ink/66">
          {facilitator.tagline || "Arrangør på SoulEvents"}
        </p>
      </div>
    </Link>
  );
}

export function FacilitatorCarouselSection({ facilitators, href, title }: FacilitatorCarouselSectionProps) {
  if (facilitators.length === 0) return null;

  return (
    <section className="grid gap-4">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-3xl font-medium leading-tight text-[#2F2633] sm:text-4xl">{title}</h2>
        <Link className="shrink-0 text-sm font-semibold text-[#7A4EAB] transition hover:text-olive" href={href}>
          Se alle
        </Link>
      </div>
      <div className="-mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-4 sm:-mx-8 sm:px-8">
        {facilitators.map((facilitator) => (
          <FacilitatorCardVisual facilitator={facilitator} key={facilitator.id} />
        ))}
      </div>
    </section>
  );
}
