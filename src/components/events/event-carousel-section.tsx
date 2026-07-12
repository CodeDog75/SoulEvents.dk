"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Clock3, MapPinned, Ticket, UserRound } from "lucide-react";
import { CapacityBadge } from "@/components/events/capacity-badge";
import { EventDateBox, EventImageStatusTag, formatEventTime } from "@/components/events/event-card-overlays";
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
  hostReferenceId?: string | null;
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
      className="group block min-w-[280px] max-w-[280px] shrink-0 snap-start overflow-hidden rounded-[24px] bg-white shadow-soft transition hover:-translate-y-1 hover:shadow-lift sm:min-w-[320px] sm:max-w-[320px] lg:min-w-[340px] lg:max-w-[340px]"
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
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#2F2633]/12 to-transparent" aria-hidden="true" />
        <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2 sm:left-4 sm:right-4 sm:top-4">
          <EventDateBox startsAt={event.starts_at} />
          <EventImageStatusTag availableSeats={event.available_seats} capacity={event.capacity} />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#2F2633]/52 to-transparent" aria-hidden="true" />
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2 sm:bottom-4 sm:left-4 sm:right-4">
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
            <Clock3 className="size-4 shrink-0 text-rose" aria-hidden="true" />
            Kl. {formatEventTime(event.starts_at)}
          </span>
          <span className="flex items-center gap-2">
            <MapPinned className="size-4 shrink-0 text-sage-700" aria-hidden="true" />
            <span className="truncate">{locationText}</span>
          </span>
          <CapacityBadge availableSeats={event.available_seats} capacity={event.capacity} className="justify-center text-center" compact />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-olive/10 pt-4 text-sm">
          <span className="flex items-center gap-2 font-semibold text-olive">
            <Ticket className="size-4" aria-hidden="true" />
            {formatPrice(event.price_cents)}
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-rose">
            Se event
            <ArrowRight className="size-4" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function EventCarouselSection({ events, href, title }: EventCarouselSectionProps) {
  const desktopScrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateScrollState() {
    const scroller = desktopScrollerRef.current;
    if (!scroller) return;

    setCanScrollLeft(scroller.scrollLeft > 4);
    setCanScrollRight(scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 4);
  }

  function scrollCards(direction: "left" | "right") {
    const scroller = desktopScrollerRef.current;
    if (!scroller) return;

    const firstCard = scroller.querySelector<HTMLElement>("a");
    const scrollDistance = firstCard ? firstCard.offsetWidth + 16 : 340;
    scroller.scrollBy({
      left: direction === "left" ? -scrollDistance : scrollDistance,
      behavior: "smooth",
    });
  }

  useEffect(() => {
    updateScrollState();
    const scroller = desktopScrollerRef.current;
    if (!scroller) return;

    scroller.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      scroller.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [events.length]);

  if (events.length === 0) return null;

  return (
    <section className="grid gap-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <span className="mb-3 inline-flex rounded-full bg-[#EDE4F7] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#7A4EAB]">
            Aktuelle oplevelser
          </span>
          <h2 className="text-3xl font-medium leading-tight text-[#2F2633] sm:text-4xl">{title}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link className="text-sm font-semibold text-[#7A4EAB] transition hover:text-olive" href={href}>
            Se alle
          </Link>
        </div>
      </div>
      <div className="flex max-w-full snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-4 [touch-action:pan-x_pan-y] [-webkit-overflow-scrolling:touch] md:hidden">
        {events.map((event) => (
          <EventCardVisual event={event} key={event.id} />
        ))}
      </div>

      <div className="relative hidden max-w-full md:block [@media(hover:hover)_and_(pointer:fine)]:overflow-hidden">
        {canScrollLeft && (
          <button
            aria-label={"Scroll " + title + " mod venstre"}
            className="pointer-events-none absolute bottom-3 left-0 top-0 z-20 hidden w-24 items-center justify-start bg-gradient-to-r from-white via-white/90 to-transparent pl-3 text-[#7A4EAB] transition hover:text-olive [@media(hover:hover)_and_(pointer:fine)]:pointer-events-auto [@media(hover:hover)_and_(pointer:fine)]:flex"
            onClick={() => scrollCards("left")}
            type="button"
          >
            <span className="grid size-12 place-items-center rounded-full border border-[#7A4EAB]/20 bg-white shadow-lift">
              <ChevronLeft className="size-6" aria-hidden="true" />
            </span>
          </button>
        )}
        {canScrollRight && (
          <button
            aria-label={"Scroll " + title + " mod højre"}
            className="pointer-events-none absolute bottom-3 right-0 top-0 z-20 hidden w-24 items-center justify-end bg-gradient-to-l from-white via-white/90 to-transparent pr-3 text-[#7A4EAB] transition hover:text-olive [@media(hover:hover)_and_(pointer:fine)]:pointer-events-auto [@media(hover:hover)_and_(pointer:fine)]:flex"
            onClick={() => scrollCards("right")}
            type="button"
          >
            <span className="grid size-12 place-items-center rounded-full border border-[#7A4EAB]/20 bg-white shadow-lift">
              <ChevronRight className="size-6" aria-hidden="true" />
            </span>
          </button>
        )}
        <div
          ref={desktopScrollerRef}
          className="flex w-full max-w-full snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-smooth pb-3 [touch-action:pan-x_pan-y] [-webkit-overflow-scrolling:touch]"
        >
          {events.map((event) => (
            <EventCardVisual event={event} key={event.id} />
          ))}
        </div>
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
    <section className="grid gap-3">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-3xl font-medium leading-tight text-[#2F2633] sm:text-4xl">{title}</h2>
        <Link className="shrink-0 text-sm font-semibold text-[#7A4EAB] transition hover:text-olive" href={href}>
          Se alle
        </Link>
      </div>
      <div className="-mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-3 sm:-mx-8 sm:px-8">
        {facilitators.map((facilitator) => (
          <FacilitatorCardVisual facilitator={facilitator} key={facilitator.id} />
        ))}
      </div>
    </section>
  );
}
