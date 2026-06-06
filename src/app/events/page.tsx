import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { EventFilterForm } from "@/components/events/event-filter-form";
import { EventMap } from "@/components/events/event-map";
import { PublicEventList } from "@/components/events/public-event-list";
import { SiteFooterLogin } from "@/components/site-footer-login";
import { env } from "@/lib/env";
import { getAreaOption } from "@/lib/regions/areas";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type EventsPageProps = {
  searchParams: Promise<{
    q?: string;
    area?: string;
    category?: string;
    price?: string;
    date?: string;
    distance?: string;
    latitude?: string;
    longitude?: string;
  }>;
};

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = startOfToday();
  date.setDate(date.getDate() + 1);
  return date;
}

function endOfWeek() {
  const date = startOfToday();
  date.setDate(date.getDate() + 7);
  return date;
}

function endOfMonth() {
  const date = startOfToday();
  date.setMonth(date.getMonth() + 1);
  return date;
}

function parseCoordinate(value?: string) {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function distanceInKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const startLatitude = toRadians(from.latitude);
  const endLatitude = toRadians(to.latitude);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(deltaLongitude / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const params = await searchParams;
  const selected = {
    q: params.q?.trim() ?? "",
    area: params.area ?? "",
    category: params.category ?? "",
    price: params.price ?? "",
    date: params.date ?? "",
    distance: params.distance ?? "",
    latitude: params.latitude ?? "",
    longitude: params.longitude ?? "",
  };

  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return (
      <main className="min-h-screen bg-cream">
        <header className="bg-white shadow-soft">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-5 sm:px-8">
            <div className="flex items-center gap-3">
              <BrandLogo className="h-20 w-20 sm:h-24 sm:w-24" priority />
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Begivenheder</p>
                <h1 className="text-3xl font-medium text-olive">Find spirituelle events</h1>
              </div>
            </div>
            <Link
              className="inline-flex h-11 items-center gap-2 rounded-button border border-olive/15 bg-white px-4 text-sm font-semibold text-olive transition hover:border-rose hover:text-rose"
              href="/"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Forside
            </Link>
          </div>
        </header>

        <section className="mx-auto grid max-w-3xl gap-4 px-5 py-16 sm:px-8">
          <div className="rounded-card bg-white p-8 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-wide text-terracotta">Opsætning mangler</p>
            <h2 className="mt-3 text-4xl font-medium text-olive">Supabase er ikke forbundet endnu.</h2>
            <p className="mt-3 text-sm leading-6 text-ink/64">
              Tilføj `NEXT_PUBLIC_SUPABASE_URL` og `NEXT_PUBLIC_SUPABASE_ANON_KEY` i `.env`, og genstart
              localhost. Derefter kan eventoversigten hente data og vise kortet.
            </p>
          </div>
        </section>
        <SiteFooterLogin />
      </main>
    );
  }

  const supabase = await createClient();

  const [{ data: regions }, { data: categories }] = await Promise.all([
    supabase.from("regions").select("id, name, slug").order("sort_order"),
    supabase.from("categories").select("id, name").eq("is_active", true).order("sort_order"),
  ]);

  let query = supabase
    .from("events")
    .select(
      `
      id,
      title,
      short_description,
      starts_at,
      latitude,
      longitude,
      city,
      price_cents,
      capacity,
      facilitator_profiles!inner(
        status,
        company_name,
        profiles(full_name)
      ),
      regions(name),
      event_categories(categories(id, name, color_hex))
    `,
    )
    .eq("status", "active")
    .eq("facilitator_profiles.status", "approved")
    .gte("starts_at", startOfToday().toISOString())
    .order("starts_at", { ascending: true });

  if (selected.q) {
    query = query.or(`title.ilike.%${selected.q}%,short_description.ilike.%${selected.q}%`);
  }

  const selectedArea = getAreaOption(selected.area);

  if (selectedArea && regions) {
    const areaRegionIds = regions.filter((region) => selectedArea.slugs.includes(region.slug)).map((region) => region.id);

    if (areaRegionIds.length > 0) {
      query = query.in("region_id", areaRegionIds);
    }
  }

  if (selected.price === "free") {
    query = query.eq("price_cents", 0);
  } else if (selected.price === "under-250") {
    query = query.gt("price_cents", 0).lt("price_cents", 25000);
  } else if (selected.price === "250-500") {
    query = query.gte("price_cents", 25000).lte("price_cents", 50000);
  } else if (selected.price === "500-1000") {
    query = query.gt("price_cents", 50000).lte("price_cents", 100000);
  } else if (selected.price === "over-1000") {
    query = query.gt("price_cents", 100000);
  }

  if (selected.date === "today") {
    query = query.lt("starts_at", endOfToday().toISOString());
  } else if (selected.date === "week") {
    query = query.lt("starts_at", endOfWeek().toISOString());
  } else if (selected.date === "month") {
    query = query.lt("starts_at", endOfMonth().toISOString());
  }

  const { data: events } = await query;
  const categoryFilteredEvents =
    selected.category && events
      ? events.filter((event: { event_categories?: Array<{ categories?: { id?: string } | Array<{ id?: string }> | null }> }) =>
          event.event_categories?.some((row) => {
            const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
            return category?.id === selected.category;
          }),
        )
      : events ?? [];

  const userLatitude = parseCoordinate(selected.latitude);
  const userLongitude = parseCoordinate(selected.longitude);
  const selectedDistance = Number(selected.distance);
  const userLocation =
    userLatitude !== null && userLongitude !== null ? { latitude: userLatitude, longitude: userLongitude } : null;

  const filteredEvents =
    userLocation && [25, 50, 100].includes(selectedDistance)
      ? categoryFilteredEvents.filter((event) => {
          if (typeof event.latitude !== "number" || typeof event.longitude !== "number") {
            return false;
          }

          return (
            distanceInKm(userLocation, {
              latitude: event.latitude,
              longitude: event.longitude,
            }) <= selectedDistance
          );
        })
      : categoryFilteredEvents;

  const mapEvents = filteredEvents.map((event) => {
    const facilitatorProfile = Array.isArray(event.facilitator_profiles)
      ? event.facilitator_profiles[0]
      : event.facilitator_profiles;
    const facilitatorUser = Array.isArray(facilitatorProfile?.profiles)
      ? facilitatorProfile?.profiles[0]
      : facilitatorProfile?.profiles;
    const firstCategoryRow = event.event_categories?.[0];
    const firstCategory = Array.isArray(firstCategoryRow?.categories)
      ? firstCategoryRow?.categories[0]
      : firstCategoryRow?.categories;

    return {
      id: event.id,
      title: event.title,
      startsAt: event.starts_at,
      priceCents: event.price_cents,
      latitude: event.latitude,
      longitude: event.longitude,
      facilitatorName: facilitatorProfile?.company_name || facilitatorUser?.full_name || "Facilitator",
      categoryName: firstCategory?.name ?? null,
      categoryColor: firstCategory?.color_hex ?? null,
    };
  });

  return (
    <main className="min-h-screen bg-cream">
      <header className="bg-white shadow-soft">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-20 w-20 sm:h-24 sm:w-24" priority />
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Begivenheder</p>
              <h1 className="text-3xl font-medium text-olive">Find spirituelle events</h1>
            </div>
          </div>
          <Link
            className="inline-flex h-11 items-center gap-2 rounded-button border border-olive/15 bg-white px-4 text-sm font-semibold text-olive transition hover:border-rose hover:text-rose"
            href="/"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Forside
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1400px] gap-8 px-5 py-12 sm:px-8">
        <section className="rounded-card bg-white p-8 shadow-soft sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-wide text-rose">Offentlig oversigt</p>
          <h2 className="mt-3 max-w-4xl text-5xl font-medium leading-tight text-olive sm:text-6xl">
            Kommende begivenheder fra godkendte facilitatorer
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink/70">
            Søg, filtrer og find events for krop, sind og sjæl. Kun aktive events fra godkendte facilitatorer vises.
          </p>
        </section>

        <EventFilterForm categories={categories ?? []} selected={selected} />
        <section className="grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <div className="xl:sticky xl:top-6 xl:self-start">
            <EventMap events={mapEvents} mapboxToken={env.mapboxToken} />
          </div>
          <PublicEventList events={filteredEvents as never} layout="stack" />
        </section>
      </section>
      <SiteFooterLogin />
    </main>
  );
}
