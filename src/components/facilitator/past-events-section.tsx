"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { CalendarDays, CheckCircle2, ChevronDown, ChevronUp, MapPinned } from "lucide-react";
import type { PublicEvent } from "@/components/events/public-event-list";
import { withReturnTo } from "@/lib/return-to";
import { publicEventPath } from "@/lib/slug";

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDanishDate(value: string) {
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function publicMediaUrl(imagePath?: string | null) {
  if (!imagePath) return null;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  return supabaseUrl.replace(/\/$/, "") + "/storage/v1/object/public/media/" + imagePath.split("/").map(encodeURIComponent).join("/");
}

function PastEventCard({ event, returnTo }: { event: PublicEvent; returnTo?: string | null }) {
  const region = first(event.regions);
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
  const fallbackColor = mainCategories[0]?.color_hex || categories[0]?.color_hex || "#7A5D91";
  const locationText =
    event.event_format === "online"
      ? "Online"
      : [event.city, region?.name].filter(Boolean).join(", ") || "Lokation kommer snart";

  return (
    <Link
      className="group overflow-hidden rounded-[20px] border border-[#E5DDEA] bg-white/76 shadow-[0_10px_26px_rgba(47,36,55,0.05)] transition hover:-translate-y-0.5 hover:border-[#D8CBE4] hover:shadow-soft"
      href={withReturnTo(publicEventPath(event.slug || event.id), returnTo)}
    >
      <div
        className="relative aspect-[16/7] overflow-hidden bg-[#FAF6EF]"
        style={
          eventImageUrl
            ? undefined
            : {
                background:
                  "radial-gradient(circle at 20% 18%, rgba(255,255,255,0.72), transparent 34%), linear-gradient(135deg, " +
                  fallbackColor +
                  "30, #FAF6EF 58%, #EDE4F7)",
              }
        }
      >
        {eventImageUrl ? (
          <Image
            alt=""
            className="object-cover grayscale-[18%] transition duration-500 group-hover:scale-[1.03]"
            fill
            sizes="(min-width: 1280px) 280px, (min-width: 640px) 45vw, 90vw"
            src={eventImageUrl}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center">
            <span className="font-serif text-2xl font-medium leading-tight text-[#6E6475]">
              {mainCategories[0]?.name || categories[0]?.name || "SoulEvents"}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-[#2F2633]/20" aria-hidden="true" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/92 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#756758] shadow-soft">
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          Afholdt
        </span>
      </div>
      <div className="p-4">
        <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-[#3F3447]">{event.title}</h3>
        <div className="mt-3 grid gap-1.5 text-sm font-semibold text-[#6E6475]">
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="size-4 text-[#7A5D91]" aria-hidden="true" />
            {formatDanishDate(event.ends_at || event.starts_at)}
          </span>
          <span className="inline-flex min-w-0 items-center gap-2">
            <MapPinned className="size-4 shrink-0 text-[#7A5D91]" aria-hidden="true" />
            <span className="truncate">{locationText}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

export function PastEventsSection({
  events,
  returnTo,
}: {
  events: PublicEvent[];
  returnTo?: string | null;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const visibleEvents = isExpanded ? events : events.slice(0, 6);
  const hasMoreEvents = events.length > 6;

  if (events.length === 0) return null;

  return (
    <section className="rounded-[28px] border border-[#E5DDEA] bg-white/64 p-5 shadow-[0_12px_34px_rgba(47,36,55,0.045)] sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#7A5D91]">Historik</p>
          <h2 className="mt-2 font-serif text-2xl font-semibold leading-tight text-[#3F3447] sm:text-3xl">Tidligere events</h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-[#7A6F80]">Et roligt kig på arrangementer, der allerede er afholdt.</p>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleEvents.map((event) => (
          <PastEventCard event={event} key={event.id} returnTo={returnTo} />
        ))}
      </div>
      {hasMoreEvents ? (
        <button
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border border-[#D8CBE4] bg-white/80 px-4 text-sm font-semibold text-[#6E5285] transition hover:border-[#7A5D91] hover:text-[#5B4778]"
          onClick={() => setIsExpanded((current) => !current)}
          type="button"
        >
          {isExpanded ? (
            <>
              Vis færre
              <ChevronUp className="size-4" aria-hidden="true" />
            </>
          ) : (
            <>
              Se flere tidligere events
              <ChevronDown className="size-4" aria-hidden="true" />
            </>
          )}
        </button>
      ) : null}
    </section>
  );
}
