import {
  CalendarDays,
  Flame,
  Heart,
  MapPinned,
  Moon,
  Music2,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Trees,
  UsersRound,
  Waves,
  Wind,
} from "lucide-react";
import Link from "next/link";
import { sendContactMessageAction } from "@/app/contact/actions";
import { BrandLogo } from "@/components/brand-logo";
import { EventMap } from "@/components/events/event-map";
import { PublicEventList } from "@/components/events/public-event-list";
import { HomeDiscoveryTiles } from "@/components/home/home-discovery-tiles";
import { HomeInspirationSections } from "@/components/home/home-inspiration-sections";
import { PublicFacilitatorCarousel } from "@/components/facilitator/public-facilitator-carousel";
import { SiteFooterLogin } from "@/components/site-footer-login";
import { env } from "@/lib/env";
import { getAreaOption } from "@/lib/regions/areas";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const categories = [
  { name: "Breathwork", value: "Breathwork", icon: Wind, href: "/?category_label=Breathwork#events" },
  { name: "Ceremonier", value: "Ceremoni", icon: ShieldCheck, href: "/?category_label=Ceremoni#events" },
  { name: "Cirkler & Fællesskaber", value: "Cirkler & Fællesskaber", icon: UsersRound, href: "/?category_label=Cirkler%20%26%20F%C3%A6llesskaber#events" },
  { name: "Ecstatic Dance", value: "Ecstatic Dance", icon: Flame, href: "/?category_label=Ecstatic%20Dance#events" },
  { name: "Healing", value: "Healing", icon: Heart, href: "/?category_label=Healing#events" },
  { name: "Kirtan & Musik", value: "Kirtan", icon: Music2, href: "/?category_label=Kirtan#events" },
  { name: "Lydbad", value: "Lydbad", icon: Waves, href: "/?category_label=Lydbad#events" },
  { name: "Meditation", value: "Meditation", icon: Moon, href: "/?category_label=Meditation#events" },
  { name: "Retreats", value: "Retreat", icon: Trees, href: "/?category_label=Retreat#events" },
  { name: "Saunagus", value: "Saunagus", icon: Sparkles, href: "/?category_label=Saunagus#events" },
  { name: "Tantra", value: "Tantra", icon: Heart, href: "/?category_label=Tantra#events" },
  { name: "Yoga", value: "Yoga", icon: SunMedium, href: "/?category_label=Yoga#events" },
];

type HomeProps = {
  searchParams?: Promise<{
    contact?: string;
    q?: string;
    area?: string;
    category_label?: string;
    date?: string;
    distance?: string;
    latitude?: string;
    longitude?: string;
    format?: string;
    facilitator_q?: string;
  }>;
};

const featuredEvents = [
  {
    title: "Morgenyoga og meditation",
    facilitator: "Nordlys Studio",
    date: "I dag kl. 09.00",
    location: "København",
    price: "180 kr.",
    category: "Yoga",
  },
  {
    title: "Lydbad under nymånen",
    facilitator: "Sofie Lykke",
    date: "Onsdag kl. 19.30",
    location: "Odense",
    price: "250 kr.",
    category: "Lydbad",
  },
  {
    title: "Åndedræt, ro og nærvær",
    facilitator: "Hjerterum Aarhus",
    date: "Søndag kl. 10.00",
    location: "Aarhus",
    price: "Gratis",
    category: "Breathwork",
  },
];

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

function endOfWeekend() {
  const date = startOfToday();
  const day = date.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  date.setDate(date.getDate() + daysUntilMonday);
  return date;
}

function startOfNextWeek() {
  const date = startOfToday();
  const day = date.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  date.setDate(date.getDate() + daysUntilMonday);
  return date;
}

function endOfNextWeek() {
  const date = startOfNextWeek();
  date.setDate(date.getDate() + 7);
  return date;
}

function endOfMonth() {
  const date = startOfToday();
  date.setMonth(date.getMonth() + 1);
  return date;
}

function getEventFacilitatorId(event: { facilitator_profiles?: { id?: string } | Array<{ id?: string }> | null }) {
  const facilitator = Array.isArray(event.facilitator_profiles)
    ? event.facilitator_profiles[0]
    : event.facilitator_profiles;

  return facilitator?.id ?? "";
}

function selectFairHomepageEvents<T extends { id: string; starts_at: string; facilitator_profiles?: { id?: string } | Array<{ id?: string }> | null }>(
  events: T[],
  limit = 6,
) {
  const byFacilitator = new Map<string, T[]>();

  for (const event of uniqueEventsById(events)) {
    const facilitatorId = getEventFacilitatorId(event) || event.id;
    const list = byFacilitator.get(facilitatorId) ?? [];
    list.push(event);
    byFacilitator.set(facilitatorId, list);
  }

  const selected = Array.from(byFacilitator.values()).map((facilitatorEvents) =>
    facilitatorEvents.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0],
  );

  return selected
    .map((event) => ({
      event,
      time: new Date(event.starts_at).getTime(),
      variation: Math.random() * 0.15,
    }))
    .sort((a, b) => a.time - b.time || a.variation - b.variation)
    .slice(0, limit)
    .map(({ event }) => event);
}

function removeSearchParam(params: Record<string, string>, key: string) {
  const next = new URLSearchParams();

  for (const [paramKey, value] of Object.entries(params)) {
    if (paramKey !== key && value) {
      next.set(paramKey, value);
    }
  }

  const query = next.toString();
  return query ? "/?" + query + "#events" : "/#events";
}

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

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function categoryMatches(
  event: { event_categories?: Array<{ categories?: { name?: string } | Array<{ name?: string }> | null }> },
  categoryLabel: string,
) {
  if (!categoryLabel) {
    return true;
  }

  return Boolean(
    event.event_categories?.some((row) => {
      const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
      return normalizeText(category?.name) === normalizeText(categoryLabel);
    }),
  );
}

function textMatches(
  event: {
    title?: string;
    short_description?: string | null;
    city?: string | null;
    regions?: { name?: string } | Array<{ name?: string }> | null;
    event_categories?: Array<{ categories?: { name?: string } | Array<{ name?: string }> | null }>;
  },
  query: string,
) {
  if (!query) {
    return true;
  }

  const region = Array.isArray(event.regions) ? event.regions[0] : event.regions;
  const categoryNames =
    event.event_categories
      ?.map((row) => (Array.isArray(row.categories) ? row.categories[0] : row.categories)?.name)
      .filter(Boolean)
      .join(" ") ?? "";

  return [event.title, event.short_description, event.city, region?.name, categoryNames]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query.toLowerCase());
}

function parseCoordinate(value: string) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function publicMediaUrl(imagePath?: string | null) {
  if (!env.supabaseUrl || !imagePath) {
    return null;
  }

  return env.supabaseUrl.replace(/\/$/, "") + "/storage/v1/object/public/media/" + imagePath.split("/").map(encodeURIComponent).join("/");
}

function distanceInKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDistance = toRadians(to.latitude - from.latitude);
  const longitudeDistance = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const a =
    Math.sin(latitudeDistance / 2) * Math.sin(latitudeDistance / 2) +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDistance / 2) * Math.sin(longitudeDistance / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


const fallbackHomeTiles = [
  { id: "nearby", title: "Events nær dig", description: "Find oplevelser tæt på din aktuelle placering.", href: "/#events", imageUrl: null, tileType: "nearby" as const },
  { id: "map", title: "Alle events på kort", description: "Udforsk events visuelt på kortet.", href: "/#map", imageUrl: null, tileType: "navigation" as const },
  { id: "online", title: "Online events", description: "Find events du kan deltage i hjemmefra.", href: "/?q=online#events", imageUrl: null, tileType: "navigation" as const },
  { id: "facilitators", title: "Facilitatorer", description: "Gå på opdagelse blandt SoulEvents facilitatorer.", href: "/facilitators", imageUrl: null, tileType: "navigation" as const },
  { id: "all-events", title: "Alle events", description: "Se kommende events i kronologisk rækkefølge.", href: "/#events", imageUrl: null, tileType: "navigation" as const },
  { id: "meditation", title: "Meditation & Nærvær", description: "Rolige events med meditation og fordybelse.", href: "/?category_label=Meditation#events", imageUrl: null, tileType: "category" as const },
  { id: "sound", title: "Lyd & Musik", description: "Lydbade, kirtan og musikalske oplevelser.", href: "/?category_label=Lydbad#events", imageUrl: null, tileType: "category" as const },
  { id: "body", title: "Bevægelse & Krop", description: "Yoga, breathwork, dans og kropslige praksisser.", href: "/?category_label=Yoga#events", imageUrl: null, tileType: "category" as const },
];

async function getHomeTiles() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return fallbackHomeTiles;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("homepage_tiles")
    .select("id, title, description, image_path, href, tile_type")
    .eq("is_active", true)
    .order("sort_order");

  if (error || !data || data.length === 0) {
    return fallbackHomeTiles;
  }

  return data.map((tile) => ({
    id: tile.id,
    title: tile.title,
    description: tile.description,
    href: tile.href,
    imageUrl: tile.image_path ? supabase.storage.from("media").getPublicUrl(tile.image_path).data.publicUrl : null,
    tileType: tile.tile_type,
  }));
}

async function getSearchEvents(selected: {
  q: string;
  area: string;
  categoryLabel: string;
  date: string;
  distance: string;
  latitude: string;
  longitude: string;
  format?: string;
}) {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return [];
  }

  const supabase = await createClient();
  const { data: regions } = await supabase.from("regions").select("id, name, slug").order("sort_order");

  let query = supabase
    .from("events")
    .select(
      "id, title, short_description, starts_at, latitude, longitude, city, price_cents, capacity, cover_image_path, event_format, facilitator_profiles!inner(id, status, company_name, profiles(full_name)), regions(name), event_categories(categories(id, name, color_hex))",
    )
    .eq("status", "active")
    .eq("facilitator_profiles.status", "approved")
    .gte("starts_at", startOfToday().toISOString())
    .order("starts_at", { ascending: true });

  const selectedArea = getAreaOption(selected.area);
  if (selectedArea && regions) {
    const areaRegionIds = regions.filter((region) => selectedArea.slugs.includes(region.slug)).map((region) => region.id);

    if (areaRegionIds.length > 0) {
      query = query.in("region_id", areaRegionIds);
    }
  }

  if (selected.date === "today") {
    query = query.lt("starts_at", endOfToday().toISOString());
  } else if (selected.date === "weekend") {
    query = query.lt("starts_at", endOfWeekend().toISOString());
  } else if (selected.date === "next_week") {
    query = query.gte("starts_at", startOfNextWeek().toISOString()).lt("starts_at", endOfNextWeek().toISOString());
  } else if (selected.date === "week") {
    query = query.lt("starts_at", endOfWeek().toISOString());
  } else if (selected.date === "month") {
    query = query.lt("starts_at", endOfMonth().toISOString());
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(selected.date)) {
    const start = new Date(selected.date);
    const end = new Date(selected.date);
    end.setDate(end.getDate() + 1);
    query = query.gte("starts_at", start.toISOString()).lt("starts_at", end.toISOString());
  }

  if (selected.format === "online") {
    query = query.in("event_format", ["online", "hybrid"]);
  } else if (selected.format === "physical") {
    query = query.eq("event_format", "physical");
  } else if (selected.format === "hybrid") {
    query = query.eq("event_format", "hybrid");
  }

  const { data: events } = await query;
  const matchedEvents = uniqueEventsById(events ?? []).filter(
    (event) => textMatches(event, selected.q) && categoryMatches(event, selected.categoryLabel),
  );

  const userLatitude = parseCoordinate(selected.latitude);
  const userLongitude = parseCoordinate(selected.longitude);
  const selectedDistance = selected.distance === "all" ? "all" : Number(selected.distance);
  const userLocation =
    userLatitude !== null && userLongitude !== null ? { latitude: userLatitude, longitude: userLongitude } : null;

  const eventsWithDistance = matchedEvents.map((event) => {
    const hasCoordinates = typeof event.latitude === "number" && typeof event.longitude === "number";
    const distanceKm =
      userLocation && hasCoordinates
        ? distanceInKm(userLocation, {
            latitude: event.latitude,
            longitude: event.longitude,
          })
        : null;

    return { ...event, distance_km: distanceKm };
  });

  if (!userLocation) {
    return eventsWithDistance.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }

  const nearbyEvents = eventsWithDistance.filter(
    (event) => event.event_format !== "online" && typeof event.distance_km === "number",
  );

  const radiusFilteredEvents =
    typeof selectedDistance === "number" && [10, 25, 50, 100].includes(selectedDistance)
      ? nearbyEvents.filter((event) => (event.distance_km ?? Number.POSITIVE_INFINITY) <= selectedDistance)
      : nearbyEvents;

  return radiusFilteredEvents.sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0));
}



async function getHomeThemes() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("homepage_tiles")
    .select("id, title, description, image_path, href")
    .eq("is_active", true)
    .eq("tile_type", "campaign")
    .order("sort_order")
    .limit(8);

  if (error || !data) {
    return [];
  }

  return data.map((theme) => ({
    id: theme.id,
    title: theme.title,
    description: theme.description,
    href: theme.href,
    imageUrl: theme.image_path ? supabase.storage.from("media").getPublicUrl(theme.image_path).data.publicUrl : null,
  }));
}

function mapFacilitatorCard(facilitator: any, supabase: Awaited<ReturnType<typeof createClient>>) {
  const profile = Array.isArray(facilitator.profiles) ? facilitator.profiles[0] : facilitator.profiles;
  const categories =
    facilitator.facilitator_categories
      ?.map((row: any) => (Array.isArray(row.categories) ? row.categories[0] : row.categories))
      .filter(Boolean) ?? [];

  return {
    id: facilitator.id,
    name: facilitator.company_name || profile?.full_name || "Facilitator",
    imageUrl: facilitator.profile_image_path
      ? supabase.storage.from("media").getPublicUrl(facilitator.profile_image_path).data.publicUrl
      : null,
    city: facilitator.city,
    tagline: facilitator.short_description || "",
    primaryCategory: categories[0]?.name ?? null,
    isOnline: Boolean(facilitator.is_online),
  };
}

async function getFeaturedHomeFacilitators() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facilitator_profiles")
    .select("id, company_name, profile_image_path, short_description, city, is_online, profiles(full_name), facilitator_categories(categories(name, color_hex))")
    .eq("status", "approved")
    .eq("is_featured", true)
    .order("featured_sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(6);

  if (error || !data) {
    return [];
  }

  return data.map((facilitator) => mapFacilitatorCard(facilitator, supabase));
}

async function getNewHomeFacilitators() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facilitator_profiles")
    .select("id, company_name, profile_image_path, short_description, city, is_online, profiles(full_name), facilitator_categories(categories(name, color_hex))")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(8);

  if (error || !data) {
    return [];
  }

  return data.map((facilitator) => mapFacilitatorCard(facilitator, supabase));
}

async function getHomeFacilitators(queryText: string) {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return [];
  }

  const supabase = await createClient();
  const { data: facilitators } = await supabase
    .from("facilitator_profiles")
    .select("id, company_name, profile_image_path, short_description, city, profiles(full_name), facilitator_categories(categories(name, color_hex))")
    .eq("status", "approved");

  const term = normalizeText(queryText);
  const filtered = (facilitators ?? []).filter((facilitator: any) => {
    const profile = Array.isArray(facilitator.profiles) ? facilitator.profiles[0] : facilitator.profiles;
    const name = facilitator.company_name || profile?.full_name || "";
    return !term || normalizeText(name).includes(term);
  });

  const mapped = filtered.map((facilitator: any) => {
    const profile = Array.isArray(facilitator.profiles) ? facilitator.profiles[0] : facilitator.profiles;
    const categories =
      facilitator.facilitator_categories
        ?.map((row: any) => (Array.isArray(row.categories) ? row.categories[0] : row.categories))
        .filter(Boolean) ?? [];

    return {
      id: facilitator.id,
      name: facilitator.company_name || profile?.full_name || "Facilitator",
      imageUrl: facilitator.profile_image_path
        ? supabase.storage.from("media").getPublicUrl(facilitator.profile_image_path).data.publicUrl
        : null,
      tagline: facilitator.short_description || "",
      city: facilitator.city,
      categories,
    };
  });

  return mapped.sort(() => Math.random() - 0.5).slice(0, queryText ? 24 : 12);
}

export default async function Home({ searchParams }: HomeProps) {
  const params = searchParams ? await searchParams : {};
  const contactStatus = params.contact ?? "";
  const homeTiles = await getHomeTiles();
  const facilitatorQuery = (params.facilitator_q ?? params.q ?? "").trim();
  const selected = {
    q: params.q?.trim() ?? "",
    area: params.area ?? "",
    categoryLabel: params.category_label === "Alle kategorier" ? "" : params.category_label ?? "",
    date: params.date ?? "",
    distance: params.distance ?? "",
    latitude: params.latitude ?? "",
    longitude: params.longitude ?? "",
    format: params.format ?? "",
  };
  const hasSearch = Boolean(
    selected.q ||
      selected.area ||
      selected.categoryLabel ||
      selected.date ||
      selected.distance ||
      selected.latitude ||
      selected.longitude ||
      selected.format,
  );
  const upcomingEvents = await getSearchEvents({
    ...selected,
    q: "",
    area: "",
    categoryLabel: "",
    date: "",
    distance: "",
    latitude: "",
    longitude: "",
    format: "",
  });
  const searchEvents = hasSearch ? await getSearchEvents(selected) : [];
  const fairUpcomingEvents = selectFairHomepageEvents(upcomingEvents, 6);
  const visibleEvents = uniqueEventsById(hasSearch ? searchEvents : upcomingEvents.slice(0, 24));
  const listEvents = hasSearch ? searchEvents : fairUpcomingEvents;
  const facilitatorCards = await getHomeFacilitators(facilitatorQuery);
  const [featuredFacilitators, newFacilitators, homeThemes] = await Promise.all([
    getFeaturedHomeFacilitators(),
    getNewHomeFacilitators(),
    getHomeThemes(),
  ]);
  const mapEvents = visibleEvents.map((event) => {
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
      imageUrl: publicMediaUrl(event.cover_image_path),
      eventFormat: event.event_format,
      distanceKm: event.distance_km ?? null,
    };
  });
  const activeFilterParams = {
    q: selected.q,
    area: selected.area,
    category_label: selected.categoryLabel,
    distance: selected.distance,
    latitude: selected.latitude,
    longitude: selected.longitude,
    format: selected.format,
  };
  const nearbyRadiusOptions =
    selected.latitude && selected.longitude
      ? [
          { label: "10 km", value: "10" },
          { label: "25 km", value: "25" },
          { label: "50 km", value: "50" },
          { label: "100 km", value: "100" },
          { label: "Hele Danmark", value: "all" },
        ].map((option) => {
          const params = new URLSearchParams();
          params.set("latitude", selected.latitude);
          params.set("longitude", selected.longitude);
          params.set("distance", option.value);
          if (selected.categoryLabel) params.set("category_label", selected.categoryLabel);
          if (selected.q) params.set("q", selected.q);
          if (selected.format) params.set("format", selected.format);
          return { ...option, href: "/?" + params.toString() + "#events" };
        })
      : [];

  const activeFilters = [
    selected.categoryLabel
      ? { key: "category_label", label: selected.categoryLabel, href: removeSearchParam(activeFilterParams, "category_label") }
      : null,
    selected.area
      ? { key: "area", label: getAreaOption(selected.area)?.label ?? selected.area, href: removeSearchParam(activeFilterParams, "area") }
      : null,
    selected.q ? { key: "q", label: "Søgning: " + selected.q, href: removeSearchParam(activeFilterParams, "q") } : null,
    selected.latitude && selected.longitude
      ? { key: "nearby", label: "I nærheden", href: "/#events" }
      : null,
  ].filter((filter): filter is { key: string; label: string; href: string } => Boolean(filter));

  return (
    <main className="min-h-screen bg-cream text-ink">
      <section className="relative overflow-hidden bg-cream pb-10 sm:min-h-[780px] sm:pb-0">
        <div
          className="absolute inset-0 bg-[url('/brand/soulevents-logo.png')] bg-[length:360px_360px] sm:bg-[length:680px_680px] bg-center bg-no-repeat opacity-20"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-white/45" aria-hidden="true" />

        <header className="relative z-10">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-5 sm:px-8">
            <Link aria-label="SoulEvents.dk forside" href="/">
              <BrandLogo className="h-20 w-20 sm:h-24 sm:w-24" priority />
            </Link>

            <nav className="hidden items-center gap-7 text-sm font-semibold text-olive md:flex">
              <a className="transition hover:text-rose" href="#events">
                Events
              </a>
              <a className="transition hover:text-rose" href="#map">
                Kort
              </a>
              <a className="transition hover:text-rose" href="/facilitators">
                Facilitatorer
              </a>
              <a className="transition hover:text-rose" href="#categories">
                Kategorier
              </a>
              <Link className="transition hover:text-rose" href="/facilitator/events">
                Opret Event
              </Link>
              <Link className="transition hover:text-rose" href="/auth/login">
                Login
              </Link>
            </nav>
          </div>
        </header>

        <div className="relative z-10 mx-auto grid max-w-[1200px] gap-6 px-4 pb-12 pt-6 sm:gap-10 sm:px-8 sm:pb-20 sm:pt-14 lg:pt-20">
          <div className="max-w-4xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-olive shadow-soft">
              <Sparkles className="size-4 text-rose" aria-hidden="true" />
              Danmarks samlingssted for spirituelle events
            </p>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-tight text-olive sm:mt-8 sm:text-7xl sm:leading-[0.95] lg:text-8xl">
              Find oplevelser tæt på dig
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-ink/76 sm:mt-6 sm:text-xl sm:leading-8">
              Gå på opdagelse i spirituelle events og oplevelser i hele Danmark. Start tæt på dig, eller vælg et område og mærk efter hvad der kalder.
            </p>
          </div>
          <HomeDiscoveryTiles tiles={homeTiles} />
        </div>
      </section>

      <section className="bg-white py-20 sm:py-24" id="events">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
{activeFilters.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <Link
                  className="inline-flex items-center gap-2 rounded-full border border-sage-700/20 bg-sage-50 px-3 py-2 text-sm font-semibold text-olive transition hover:border-sage-700"
                  href={filter.href}
                  key={filter.key}
                >
                  {filter.label}
                  <span aria-hidden="true">×</span>
                </Link>
              ))}
            </div>
          )}

          <div className="mt-8 grid gap-7">
            {nearbyRadiusOptions.length > 0 && (
              <section className="rounded-card border border-sage-700/15 bg-sage-50 p-5 shadow-soft">
                <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Events nær dig</p>
                <h2 className="mt-2 text-3xl font-medium text-olive">Vælg radius</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {nearbyRadiusOptions.map((option) => (
                    <Link
                      className={
                        selected.distance === option.value || (!selected.distance && option.value === "50")
                          ? "rounded-full bg-olive px-4 py-2 text-sm font-semibold text-white"
                          : "rounded-full bg-white px-4 py-2 text-sm font-semibold text-olive transition hover:bg-cream"
                      }
                      href={option.href}
                      key={option.value}
                    >
                      {option.label}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <EventMap events={mapEvents} mapboxToken={env.mapboxToken} />

            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-rose">
                {hasSearch ? "Søgeresultater" : "Kommende events"}
              </p>
              <h2 className="mt-3 text-5xl font-medium leading-tight text-olive">
                {hasSearch ? "Events der matcher din søgning" : "Førstkommende oplevelser"}
              </h2>
              {!hasSearch && (
                <details className="mt-4 max-w-3xl rounded-card bg-sage-50 px-4 py-3 text-sm leading-6 text-ink/70">
                  <summary className="cursor-pointer font-semibold text-olive">Hvordan udvælges oplevelserne?</summary>
                  <p className="mt-2">
                    For at give plads til både nye og etablerede facilitatorer viser SoulEvents en varieret
                    sammensætning af kommende oplevelser. Derfor vises maksimalt ét event pr. facilitator ad gangen i
                    denne sektion.
                  </p>
                </details>
              )}
            </div>


            {hasSearch ? (
              searchEvents.length > 0 ? (
                <PublicEventList events={searchEvents as never} />
              ) : (
                <div className="grid gap-8">
                  <section className="rounded-card bg-cream p-8 text-center shadow-soft">
                    <CalendarDays className="mx-auto size-8 text-sage-700" aria-hidden="true" />
                    <h3 className="mt-4 text-3xl font-medium text-olive">Der blev ikke fundet events, der matcher dine filtre.</h3>
                    <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-ink/64">
                      Prøv en anden kategori eller et andet område.
                    </p>
                    {selected.q && facilitatorCards.length > 0 && (
                      <div className="mx-auto mt-6 max-w-2xl rounded-card bg-white p-5 text-left shadow-soft">
                        <p className="text-sm font-semibold uppercase tracking-wide text-rose">Facilitator fundet</p>
                        <h4 className="mt-2 text-2xl font-medium text-olive">
                          Måske leder du efter en facilitator?
                        </h4>
                        <div className="mt-4 grid gap-3">
                          {facilitatorCards.slice(0, 3).map((facilitator) => (
                            <Link
                              className="flex items-center justify-between gap-3 rounded-md border border-olive/10 bg-sage-50 px-4 py-3 text-sm font-semibold text-olive transition hover:border-sage-700"
                              href={"/facilitators/" + facilitator.id}
                              key={facilitator.id}
                            >
                              <span>{facilitator.name}</span>
                              <span className="text-xs text-ink/55">Se profil</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              )
            ) : listEvents.length > 0 ? (
              <PublicEventList events={listEvents as never} />
            ) : (
              <div className="grid gap-8 lg:grid-cols-3">
                {featuredEvents.map((event) => (
                  <article
                    className="overflow-hidden rounded-card bg-cream shadow-soft transition hover:-translate-y-1 hover:shadow-lift"
                    key={event.title}
                  >
                    <div className="aspect-video bg-sage-50 p-8">
                      <div className="flex h-full items-center justify-center rounded-card bg-white/70">
                        <Sparkles className="size-10 text-rose" aria-hidden="true" />
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-rose">
                        <span>{event.category}</span>
                        <span className="text-ink/30">/</span>
                        <span>{event.location}</span>
                      </div>
                      <h3 className="mt-3 text-3xl font-medium leading-8 text-olive">{event.title}</h3>
                      <p className="mt-2 text-sm font-semibold text-sage-700">{event.facilitator}</p>
                      <div className="mt-6 flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 text-ink/70">
                          <CalendarDays className="size-4 text-rose" aria-hidden="true" />
                          {event.date}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1.5 font-semibold text-olive">{event.price}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <PublicFacilitatorCarousel facilitators={facilitatorCards} query={facilitatorQuery} />

      <HomeInspirationSections
        featuredFacilitators={featuredFacilitators}
        newFacilitators={newFacilitators}
        themes={homeThemes}
      />

      <section className="bg-white py-20 sm:py-24" id="contact">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-rose">Kontakt</p>
            <h2 className="mt-3 text-5xl font-medium leading-tight text-olive">Skriv til SoulEvents.dk</h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-ink/70">
              Har du spørgsmål, ideer eller brug for hjælp, kan du sende en besked direkte til os.
            </p>
          </div>

          <form action={sendContactMessageAction} className="grid gap-4 rounded-card bg-cream p-6 shadow-soft">
            {contactStatus === "sent" && (
              <p className="rounded-input bg-white px-4 py-3 text-sm font-semibold text-olive">
                Tak for din besked, vi kommer retur hurtigst muligt.
              </p>
            )}
            {contactStatus === "error" && (
              <p className="rounded-input bg-white px-4 py-3 text-sm font-semibold text-terracotta">
                Udfyld navn, e-mail og besked. Beskeden må højst være 500 tegn.
              </p>
            )}
            {contactStatus === "email-missing" && (
              <p className="rounded-input bg-white px-4 py-3 text-sm font-semibold text-terracotta">
                Mailafsendelse mangler opsætning. Tilføj RESEND_API_KEY og RESEND_FROM_EMAIL i .env.local.
              </p>
            )}

            <label className="grid gap-2 text-sm font-semibold text-olive">
              Navn
              <input
                className="h-12 rounded-input border border-olive/15 bg-white px-4 text-base font-normal outline-none transition focus:border-rose"
                maxLength={120}
                name="name"
                required
                type="text"
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-olive">
              E-mail
              <input
                className="h-12 rounded-input border border-olive/15 bg-white px-4 text-base font-normal outline-none transition focus:border-rose"
                maxLength={160}
                name="email"
                required
                type="email"
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-olive">
              Telefon
              <input
                className="h-12 rounded-input border border-olive/15 bg-white px-4 text-base font-normal outline-none transition focus:border-rose"
                maxLength={40}
                name="phone"
                type="tel"
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-olive">
              Besked
              <textarea
                className="min-h-40 rounded-input border border-olive/15 bg-white px-4 py-3 text-base font-normal outline-none transition focus:border-rose"
                maxLength={500}
                name="message"
                required
              />
              <span className="text-xs font-medium text-ink/60">Maks 500 tegn.</span>
            </label>

            <button
              className="inline-flex h-12 items-center justify-center rounded-button bg-rose px-6 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
              type="submit"
            >
              Afsend
            </button>
          </form>
        </div>
      </section>

      <SiteFooterLogin />
    </main>
  );
}
