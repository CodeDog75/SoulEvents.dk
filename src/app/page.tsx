/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CalendarDays,
  Mail,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { PartnerAdCarousel } from "@/components/ads/partner-ad-carousel";
import { BrandLogo } from "@/components/brand-logo";
import { EventMap } from "@/components/events/event-map";
import { EventCarouselSection, FacilitatorCarouselSection } from "@/components/events/event-carousel-section";
import { HomeEventSearchForm } from "@/components/events/home-event-search-form";
import { PublicEventList, type PublicEvent } from "@/components/events/public-event-list";
import { HomeDiscoveryTiles } from "@/components/home/home-discovery-tiles";
import { HomeInspirationSections } from "@/components/home/home-inspiration-sections";
import { MobileHomeMenu } from "@/components/home/mobile-home-menu";
import { PublicFacilitatorCarousel } from "@/components/facilitator/public-facilitator-carousel";
import { SiteFooterLogin } from "@/components/site-footer-login";
import { env } from "@/lib/env";
import { getAreaOption } from "@/lib/regions/areas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type LocalServiceProvider = {
  id: string;
  name: string;
  imageUrl: string | null;
  serviceTitles: string[];
  city: string | null;
  area: string | null;
  description: string;
  latitude: number | null;
  longitude: number | null;
  distanceKm?: number | null;
};

type HomeProps = {
  searchParams?: Promise<{
    q?: string;
    area?: string;
    category_label?: string;
    date?: string;
    distance?: string;
    latitude?: string;
    longitude?: string;
    format?: string;
    country?: string;
    facilitator_q?: string;
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
  event: {
    event_categories?: Array<{ categories?: { name?: string } | Array<{ name?: string }> | null }>;
    event_main_categories?: Array<{ main_categories?: { name?: string | null } | Array<{ name?: string | null }> | null }>;
    event_subcategories?: Array<{ subcategories?: { name?: string | null } | Array<{ name?: string | null }> | null }>;
  },
  categoryLabel: string,
) {
  if (!categoryLabel) {
    return true;
  }

  return Boolean(
    getEventCategoryNames(event).some((name) => normalizeText(name) === normalizeText(categoryLabel)),
  );
}

function getEventCategoryNames(event: {
  event_categories?: Array<{ categories?: { name?: string | null } | Array<{ name?: string | null }> | null }>;
  event_main_categories?: Array<{ main_categories?: { name?: string | null } | Array<{ name?: string | null }> | null }>;
  event_subcategories?: Array<{ subcategories?: { name?: string | null } | Array<{ name?: string | null }> | null }>;
}) {
  return [
    ...(event.event_categories ?? []).map((row) => (Array.isArray(row.categories) ? row.categories[0] : row.categories)?.name),
    ...(event.event_main_categories ?? []).map((row) => (Array.isArray(row.main_categories) ? row.main_categories[0] : row.main_categories)?.name),
    ...(event.event_subcategories ?? []).map((row) => (Array.isArray(row.subcategories) ? row.subcategories[0] : row.subcategories)?.name),
  ].filter((name): name is string => Boolean(name));
}

function getMainCategoryFallbackKeys(categoryName: string) {
  const name = normalizeText(categoryName);
  const keys = new Set<string>();

  if (["meditation", "mindfulness", "nærvær", "naervaer", "breathwork", "åndedræt", "aandedraet"].some((label) => name.includes(label))) {
    keys.add("Meditation & Nærvær");
  }

  if (["yoga", "dans", "krop", "kropsarbejde", "bevægelse", "bevaegelse", "sauna", "saunagus", "velvære", "velvaere", "natur"].some((label) => name.includes(label))) {
    keys.add("Bevægelse & Krop");
  }

  if (["healing", "energi", "shamanisme", "chakra", "terapi"].some((label) => name.includes(label))) {
    keys.add("Healing & Energiarbejde");
  }

  if (["lyd", "musik", "kirtan", "koncert", "sang"].some((label) => name.includes(label))) {
    keys.add("Lyd & Musik");
  }

  if (["ceremoni", "ritual", "cirkel", "fællesskab", "faellesskab", "shamanisme", "tantra"].some((label) => name.includes(label))) {
    keys.add("Ceremonier & Ritualer");
  }

  if (["udvikling", "coaching", "workshop", "kursus", "læring", "laering"].some((label) => name.includes(label))) {
    keys.add("Personlig Udvikling");
  }

  return [...keys];
}

function getMainCategoryKeys(event: {
  event_categories?: Array<{ categories?: { name?: string | null } | Array<{ name?: string | null }> | null }>;
  event_main_categories?: Array<{
    main_category_id?: string | null;
    main_categories?: { name?: string | null } | Array<{ name?: string | null }> | null;
  }>;
  event_subcategories?: Array<{ subcategories?: { name?: string | null } | Array<{ name?: string | null }> | null }>;
}) {
  const mainCategoryKeys =
    event.event_main_categories?.flatMap((row) => {
      const category = Array.isArray(row.main_categories) ? row.main_categories[0] : row.main_categories;
      return [row.main_category_id, category?.name].filter((value): value is string => Boolean(value));
    }) ?? [];

  if (mainCategoryKeys.length > 0) {
    return mainCategoryKeys;
  }

  return (
    [
      ...(event.event_categories ?? []).map((row) => (Array.isArray(row.categories) ? row.categories[0] : row.categories)?.name),
      ...(event.event_subcategories ?? []).map((row) => (Array.isArray(row.subcategories) ? row.subcategories[0] : row.subcategories)?.name),
    ]
      .filter((name): name is string => Boolean(name))
      .flatMap((name) => [name, ...getMainCategoryFallbackKeys(name)])
  );
}

function getMainCategoryEventCounts(events: Array<{
  id: string;
  event_categories?: Array<{ categories?: { name?: string | null } | Array<{ name?: string | null }> | null }>;
  event_main_categories?: Array<{
    main_category_id?: string | null;
    main_categories?: { name?: string | null } | Array<{ name?: string | null }> | null;
  }>;
  event_subcategories?: Array<{ subcategories?: { name?: string | null } | Array<{ name?: string | null }> | null }>;
}>) {
  const counts: Record<string, number> = {};

  for (const event of uniqueEventsById(events)) {
    for (const key of new Set(getMainCategoryKeys(event))) {
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }

  return counts;
}

function getExperienceGroupEventCounts(
  groups: Array<{ id: string; name: string; subcategories?: Array<{ name: string; value?: string | null }> }>,
  events: Array<{
    id: string;
    event_categories?: Array<{ categories?: { name?: string | null } | Array<{ name?: string | null }> | null }>;
    event_main_categories?: Array<{
      main_category_id?: string | null;
      main_categories?: { name?: string | null } | Array<{ name?: string | null }> | null;
    }>;
    event_subcategories?: Array<{ subcategories?: { name?: string | null } | Array<{ name?: string | null }> | null }>;
  }>,
) {
  const counts: Record<string, number> = {};

  for (const event of uniqueEventsById(events)) {
    const eventKeys = new Set(getMainCategoryKeys(event));

    for (const group of groups) {
      const groupKeys = [
        group.id,
        group.name,
        ...(group.subcategories ?? []).flatMap((subcategory) => [subcategory.name, subcategory.value].filter(Boolean)),
      ].filter((value): value is string => Boolean(value));

      if (groupKeys.some((key) => eventKeys.has(key))) {
        counts[group.id] = (counts[group.id] ?? 0) + 1;
      }
    }
  }

  return counts;
}

function experienceGroupHasEvents(
  group: { id: string; name: string; subcategories?: Array<{ name: string; value?: string | null }> },
  counts: Record<string, number>,
) {
  if ((counts[group.id] ?? counts[group.name] ?? 0) > 0) {
    return true;
  }

  return (
    group.subcategories?.some((subcategory) => {
      const keys = [subcategory.name, subcategory.value].filter((value): value is string => Boolean(value));
      return keys.some((key) => (counts[key] ?? 0) > 0);
    }) ?? false
  );
}

function eventMatchesAnyLabel(event: PublicEvent, labels: string[]) {
  const haystack = getEventCategoryNames(event).join(" ").toLowerCase();
  return labels.some((label) => haystack.includes(label.toLowerCase()));
}

function categoryPageHref(experienceGroups: Array<{ slug: string; name: string }>, fallback: string, labels: string[]) {
  const group = experienceGroups.find((item) => labels.some((label) => item.name.toLowerCase().includes(label.toLowerCase())));
  return group ? "/categories/" + group.slug : fallback;
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



const homeTileFallbackImages = {
  nearby: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=900&q=80",
  map: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
  online: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
  facilitators: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80",
  allEvents: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=900&q=80",
  meditation: "https://images.unsplash.com/photo-1545389336-cf090694435e?auto=format&fit=crop&w=900&q=80",
  sound: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=900&q=80",
  body: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=80",
  sauna: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80",
  ceremony: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80",
  fallback: "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=900&q=80",
};

function getHomeTileFallbackImage(tile: { id?: string | null; title?: string | null; tile_type?: string | null }) {
  const id = (tile.id ?? "").toLowerCase();
  const title = (tile.title ?? "").toLowerCase();

  if (id.includes("nearby") || title.includes("nær")) return homeTileFallbackImages.nearby;
  if (id.includes("map") || title.includes("kort")) return homeTileFallbackImages.map;
  if (id.includes("online") || title.includes("online")) return homeTileFallbackImages.online;
  if (id.includes("facilitator") || title.includes("arrangør")) return homeTileFallbackImages.facilitators;
  if (id.includes("all-events") || title.includes("alle events")) return homeTileFallbackImages.allEvents;
  if (id.includes("meditation") || title.includes("meditation") || title.includes("nærvær")) return homeTileFallbackImages.meditation;
  if (id.includes("sound") || title.includes("lyd") || title.includes("musik") || title.includes("lydbad")) return homeTileFallbackImages.sound;
  if (id.includes("body") || title.includes("bevægelse") || title.includes("yoga") || title.includes("krop")) return homeTileFallbackImages.body;
  if (title.includes("sauna") || title.includes("velvære")) return homeTileFallbackImages.sauna;
  if (title.includes("ceremoni") || title.includes("ritual")) return homeTileFallbackImages.ceremony;

  return homeTileFallbackImages.fallback;
}

type HeroImage = {
  image_path: string;
  alt_text: string | null;
};

function pickRandomItem<T>(items: T[]) {
  if (items.length === 0) {
    return null;
  }

  return items[Math.floor(Math.random() * items.length)];
}

async function getHomepageHeroImage() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hero_images")
    .select("image_path, alt_text")
    .eq("scope", "homepage")
    .eq("is_active", true)
    .order("sort_order");

  if (error || !data || data.length === 0) {
    return null;
  }

  const image = pickRandomItem(data as HeroImage[]);
  if (!image) {
    return null;
  }

  return {
    imageUrl: supabase.storage.from("media").getPublicUrl(image.image_path).data.publicUrl,
    altText: image.alt_text,
  };
}

const fallbackHomeTiles = [
  { id: "nearby", title: "Events nær dig", description: "Find oplevelser tæt på din aktuelle placering.", href: "/#events", imageUrl: homeTileFallbackImages.nearby, tileType: "nearby" as const },
  { id: "map", title: "Alle events på kort", description: "Udforsk events visuelt på kortet.", href: "/#map", imageUrl: homeTileFallbackImages.map, tileType: "navigation" as const },
  { id: "online", title: "Online events", description: "Find events du kan deltage i hjemmefra.", href: "/?format=online#events", imageUrl: homeTileFallbackImages.online, tileType: "navigation" as const },
  { id: "facilitators", title: "Arrangører", description: "Gå på opdagelse blandt SoulEvents arrangører.", href: "/facilitators", imageUrl: homeTileFallbackImages.facilitators, tileType: "navigation" as const },
  { id: "all-events", title: "Alle events", description: "Se kommende events i kronologisk rækkefølge.", href: "/#events", imageUrl: homeTileFallbackImages.allEvents, tileType: "navigation" as const },
  { id: "meditation", title: "Meditation & Nærvær", description: "Rolige events med meditation og fordybelse.", href: "/?category_label=Meditation#events", imageUrl: homeTileFallbackImages.meditation, tileType: "category" as const },
  { id: "sound", title: "Lyd & Musik", description: "Lydbade, kirtan og musikalske oplevelser.", href: "/?category_label=Lydbad#events", imageUrl: homeTileFallbackImages.sound, tileType: "category" as const },
  { id: "body", title: "Bevægelse & Krop", description: "Yoga, breathwork, dans og kropslige praksisser.", href: "/?category_label=Yoga#events", imageUrl: homeTileFallbackImages.body, tileType: "category" as const },
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
    imageUrl: tile.image_path ? supabase.storage.from("media").getPublicUrl(tile.image_path).data.publicUrl : getHomeTileFallbackImage(tile),
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
  country: string;
}) {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return [];
  }

  const supabase = await createClient();
  const { data: regions } = await supabase.from("regions").select("id, name, slug").order("sort_order");

  let query = supabase
    .from("events")
    .select(
      "id, title, short_description, starts_at, created_at, latitude, longitude, city, price_cents, capacity, cover_image_path, event_format, facilitator_profiles!inner(id, status, company_name, profiles(full_name)), regions(name), event_categories(categories(id, name, color_hex)), event_main_categories(main_category_id, main_categories(name, color_hex, image_path)), event_subcategories(subcategory_id, subcategories(name, slug))",
    )
    .eq("status", "active")
    .eq("facilitator_profiles.status", "approved")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  if (selected.country === "udenfor-danmark") {
    query = query.neq("country", "Danmark");
  }

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
    query = query.eq("event_format", "online");
  } else if (selected.format === "physical") {
    query = query.eq("event_format", "physical");
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



function getCategoryEventCounts(events: Array<{
  event_categories?: Array<{ categories?: { name?: string } | Array<{ name?: string }> | null }>;
  event_subcategories?: Array<{ subcategories?: { name?: string } | Array<{ name?: string }> | null }>;
}>) {
  const counts: Record<string, number> = {};

  for (const event of events) {
    const eventCategories = new Set<string>();

    for (const row of event.event_categories ?? []) {
      const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
      if (category?.name) {
        eventCategories.add(category.name);
      }
    }

    for (const row of event.event_subcategories ?? []) {
      const subcategory = Array.isArray(row.subcategories) ? row.subcategories[0] : row.subcategories;
      if (subcategory?.name) {
        eventCategories.add(subcategory.name);
      }
    }

    for (const categoryName of eventCategories) {
      counts[categoryName] = (counts[categoryName] ?? 0) + 1;
    }
  }

  return counts;
}

async function getExperienceGroups() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("main_categories")
    .select(
      "id, name, slug, description, color_hex, image_path, sort_order, subcategory_main_categories(subcategories(id, name, sort_order, is_active))",
    )
    .eq("is_active", true)
    .order("sort_order");

  if (error || !data) {
    return [];
  }

  return data.map((mainCategory: any) => {
    const subcategories =
      mainCategory.subcategory_main_categories
        ?.map((row: any) => (Array.isArray(row.subcategories) ? row.subcategories[0] : row.subcategories))
        .filter((subcategory: any) => subcategory?.is_active)
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, "da-DK"))
        .map((subcategory: any) => ({
          id: subcategory.id,
          name: subcategory.name,
          value: subcategory.name,
        })) ?? [];

    return {
      id: mainCategory.id,
      name: mainCategory.name,
      slug: mainCategory.slug,
      description: mainCategory.description,
      colorHex: mainCategory.color_hex || "#7A4EAB",
      imageUrl: mainCategory.image_path ? supabase.storage.from("media").getPublicUrl(mainCategory.image_path).data.publicUrl : null,
      subcategories,
    };
  });
}

function localServiceTextMatchesCategory(provider: any, categoryLabel: string) {
  if (!categoryLabel) return true;
  const needle = categoryLabel.toLowerCase();
  const serviceTitles = (provider.facilitator_service_titles ?? [])
    .map((row: any) => {
      const title = Array.isArray(row.service_titles) ? row.service_titles[0] : row.service_titles;
      return title?.name ?? "";
    })
    .join(" ");
  const categories = (provider.facilitator_categories ?? [])
    .map((row: any) => {
      const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
      return category?.name ?? "";
    })
    .join(" ");
  const tags = (provider.facilitator_tags ?? [])
    .map((row: any) => {
      const tag = Array.isArray(row.tags) ? row.tags[0] : row.tags;
      return tag?.name ?? "";
    })
    .join(" ");
  const haystack = [
    provider.company_name,
    provider.short_description,
    provider.service_description,
    provider.service_other_title,
    serviceTitles,
    categories,
    tags,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(needle);
}

async function getLocalServiceProviders(selected: {
  area: string;
  categoryLabel: string;
  distance: string;
  latitude: string;
  longitude: string;
}) {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return [];
  }

  const supabase = await createClient();
  const { data: providers } = await supabase
    .from("facilitator_profiles")
    .select(
      "id, company_name, profile_image_path, short_description, service_description, service_other_title, city, country, latitude, longitude, offers_services, show_in_local_service_results, profiles(full_name), regions(name, slug), facilitator_categories(categories(name)), facilitator_tags(tags(name)), facilitator_service_titles(service_titles(name, is_active))",
    )
    .eq("status", "approved")
    .eq("offers_services", true)
    .eq("show_in_local_service_results", true)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .limit(24);

  const selectedArea = getAreaOption(selected.area);
  const userLatitude = parseCoordinate(selected.latitude);
  const userLongitude = parseCoordinate(selected.longitude);
  const selectedDistance = selected.distance === "all" ? "all" : Number(selected.distance || "50");
  const userLocation =
    userLatitude !== null && userLongitude !== null ? { latitude: userLatitude, longitude: userLongitude } : null;

  return (providers ?? [])
    .filter((provider: any) => {
      const region = Array.isArray(provider.regions) ? provider.regions[0] : provider.regions;
      const areaMatches = !selectedArea || (region?.slug && selectedArea.slugs.includes(region.slug));
      if (!areaMatches) return false;
      if (!localServiceTextMatchesCategory(provider, selected.categoryLabel)) return false;

      if (userLocation && typeof selectedDistance === "number" && [10, 25, 50, 100].includes(selectedDistance)) {
        const distance = distanceInKm(userLocation, { latitude: provider.latitude, longitude: provider.longitude });
        return distance <= selectedDistance;
      }

      return true;
    })
    .map((provider: any) => {
      const profile = Array.isArray(provider.profiles) ? provider.profiles[0] : provider.profiles;
      const region = Array.isArray(provider.regions) ? provider.regions[0] : provider.regions;
      const serviceTitles = (provider.facilitator_service_titles ?? [])
        .map((row: any) => {
          const title = Array.isArray(row.service_titles) ? row.service_titles[0] : row.service_titles;
          return title?.name ?? "";
        })
        .filter(Boolean)
        .slice(0, 3);
      const distanceKm =
        userLocation && typeof provider.latitude === "number" && typeof provider.longitude === "number"
          ? distanceInKm(userLocation, { latitude: provider.latitude, longitude: provider.longitude })
          : null;

      return {
        id: provider.id,
        name: provider.company_name || profile?.full_name || "Arrangør",
        imageUrl: provider.profile_image_path
          ? supabase.storage.from("media").getPublicUrl(provider.profile_image_path).data.publicUrl
          : null,
        serviceTitles,
        city: provider.city || null,
        area: region?.name || provider.country || null,
        description: provider.service_description || provider.short_description || "",
        latitude: provider.latitude,
        longitude: provider.longitude,
        distanceKm,
      };
    })
    .sort((a: LocalServiceProvider, b: LocalServiceProvider) => {
      if (typeof a.distanceKm === "number" && typeof b.distanceKm === "number") return a.distanceKm - b.distanceKm;
      return a.name.localeCompare(b.name, "da");
    });
}

function LocalServiceProviderSection({ providers }: { providers: LocalServiceProvider[] }) {
  if (providers.length === 0) return null;

  return (
    <section className="mt-10 rounded-card border border-[#E5D4F7] bg-[#FAF6EF] p-5 shadow-soft sm:p-6">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#7A4EAB]">Også i området</p>
        <h3 className="mt-2 text-2xl font-medium text-[#2F2633]">Lokale tilbud og sessioner</h3>
        <p className="mt-2 text-sm leading-6 text-[#2F2633]/70">
          Find arrangører, behandlere og undervisere med faste tilbud nær dig.
        </p>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {providers.slice(0, 3).map((provider) => (
          <Link
            className="group rounded-card border border-white bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-[#D7C4F0]"
            href={"/facilitators/" + provider.id}
            key={provider.id}
          >
            <div className="flex items-start gap-3">
              {provider.imageUrl ? (
                <img alt="" className="size-14 rounded-full object-cover" src={provider.imageUrl} />
              ) : (
                <span className="flex size-14 items-center justify-center rounded-full bg-[#EDE4F7] text-lg font-semibold text-[#7A4EAB]">
                  {provider.name.slice(0, 1)}
                </span>
              )}
              <div className="min-w-0">
                <h4 className="text-base font-semibold text-[#2F2633]">{provider.name}</h4>
                <p className="mt-1 text-xs text-[#2F2633]/58">{[provider.city, provider.area].filter(Boolean).join(", ")}</p>
              </div>
            </div>
            {provider.serviceTitles.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {provider.serviceTitles.map((title) => (
                  <span className="rounded-full bg-[#EDE4F7] px-3 py-1 text-xs font-semibold text-[#7A4EAB]" key={title}>
                    {title}
                  </span>
                ))}
              </div>
            )}
            {provider.description && <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#2F2633]/70">{provider.description}</p>}
            <span className="mt-4 inline-flex text-sm font-semibold text-[#7A4EAB] transition group-hover:text-[#2F2633]">Se profil</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function mapFacilitatorCard(facilitator: any, supabase: Awaited<ReturnType<typeof createClient>>) {
  const profile = Array.isArray(facilitator.profiles) ? facilitator.profiles[0] : facilitator.profiles;
  const categories =
    facilitator.facilitator_categories
      ?.map((row: any) => (Array.isArray(row.categories) ? row.categories[0] : row.categories))
      .filter(Boolean) ?? [];

  return {
    id: facilitator.id,
    name: facilitator.company_name || profile?.full_name || "Arrangør",
    imageUrl: facilitator.profile_image_path
      ? supabase.storage.from("media").getPublicUrl(facilitator.profile_image_path).data.publicUrl
      : null,
    city: facilitator.city,
    tagline: facilitator.short_description || "",
    primaryCategory: categories[0]?.name ?? null,
    isOnline: Boolean(facilitator.is_online),
    isActiveHost: Boolean(facilitator.is_active_host),
    isExperiencedHost: Boolean(facilitator.is_experienced_host),
  };
}

async function getFeaturedHomeFacilitators() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facilitator_profiles")
    .select("id, company_name, profile_image_path, short_description, city, is_online, is_active_host, is_experienced_host, profiles(full_name), facilitator_categories(categories(name, color_hex))")
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
    .select("id, company_name, profile_image_path, short_description, city, is_online, is_active_host, is_experienced_host, profiles(full_name), facilitator_categories(categories(name, color_hex))")
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
    .select(
      "id, company_name, profile_image_path, short_description, long_description, city, postal_code, country, is_online_facilitator, is_active_host, is_experienced_host, website_url, facebook_url, instagram_url, profiles(full_name), regions(name), facilitator_categories(categories(name, color_hex)), facilitator_tags(tags(name))",
    )
    .eq("status", "approved");

  const term = normalizeText(queryText);
  const filtered = (facilitators ?? []).filter((facilitator: any) => {
    const profile = Array.isArray(facilitator.profiles) ? facilitator.profiles[0] : facilitator.profiles;
    const region = Array.isArray(facilitator.regions) ? facilitator.regions[0] : facilitator.regions;
    const categories =
      facilitator.facilitator_categories
        ?.map((row: any) => (Array.isArray(row.categories) ? row.categories[0] : row.categories))
        .filter(Boolean) ?? [];
    const categoryNames = categories.map((category: any) => category.name).filter(Boolean).join(" ");
    const tagNames =
      facilitator.facilitator_tags
        ?.map((row: any) => (Array.isArray(row.tags) ? row.tags[0] : row.tags)?.name)
        .filter(Boolean)
        .join(" ") ?? "";
    const onlineWords = facilitator.is_online_facilitator ? "online online arrangør digital fjernundervisning hjemmefra" : "";
    const searchText = [
      facilitator.company_name,
      profile?.full_name,
      facilitator.short_description,
      facilitator.long_description,
      facilitator.city,
      facilitator.postal_code,
      facilitator.country,
      region?.name,
      categoryNames,
      tagNames,
      onlineWords,
    ]
      .filter(Boolean)
      .join(" ");

    return !term || normalizeText(searchText).includes(term);
  });

  const mapped = filtered.map((facilitator: any) => {
    const profile = Array.isArray(facilitator.profiles) ? facilitator.profiles[0] : facilitator.profiles;
    const region = Array.isArray(facilitator.regions) ? facilitator.regions[0] : facilitator.regions;
    const categories =
      facilitator.facilitator_categories
        ?.map((row: any) => (Array.isArray(row.categories) ? row.categories[0] : row.categories))
        .filter(Boolean) ?? [];

    return {
      id: facilitator.id,
      name: facilitator.company_name || profile?.full_name || "Arrangør",
      imageUrl: facilitator.profile_image_path
        ? supabase.storage.from("media").getPublicUrl(facilitator.profile_image_path).data.publicUrl
        : null,
      tagline: facilitator.short_description || "",
      city: facilitator.city || region?.name || facilitator.country || null,
      isActiveHost: Boolean(facilitator.is_active_host),
    isExperiencedHost: Boolean(facilitator.is_experienced_host),
      categories,
    };
  });

  return mapped.sort(() => Math.random() - 0.5).slice(0, queryText ? 24 : 12);
}


async function getHomepageAds() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return [];
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return [];
  }
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("ads")
    .select("id, title, image_path, alt_text, sponsor_name, target_url, priority, display_seconds, show_title_on_banner, show_sponsor_on_banner, clicks_count")
    .eq("is_active", true)
    .eq("show_on_homepage", true)
    .or("starts_at.is.null,starts_at.lte." + nowIso)
    .or("ends_at.is.null,ends_at.gte." + nowIso)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data
    .map((ad: any) => ({
      id: ad.id,
      title: ad.title,
      imageUrl: publicMediaUrl(ad.image_path),
      altText: ad.alt_text || ad.title,
      targetUrl: ad.target_url,
      displaySeconds: ad.display_seconds ?? 10,
      sponsorName: ad.sponsor_name,
      showTitle: ad.show_title_on_banner ?? true,
      showSponsor: ad.show_sponsor_on_banner ?? true,
    }));
}

export default async function Home({ searchParams }: HomeProps) {
  const params = searchParams ? await searchParams : {};
  const homeTiles = await getHomeTiles();
  const homeHeroImage = await getHomepageHeroImage();
  const homepageAds = await getHomepageAds();
  const discoveryTiles = [
    ...homeTiles.filter(
      (tile) => tile.tileType !== "category" && tile.id !== "become-host" && tile.href !== "/auth/signup",
    ),
    {
      id: "become-host",
      title: "Del dine events",
      description: "Del det, du skaber, med mennesker der aktivt søger nærvær, fællesskab og udvikling.",
      href: "/auth/signup",
      imageUrl: homeTileFallbackImages.facilitators,
      tileType: "navigation" as const,
    },
  ];
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
    country: params.country ?? "",
  };
  const hasSearch = Boolean(
    selected.q ||
      selected.area ||
      selected.categoryLabel ||
      selected.date ||
      selected.distance ||
      selected.latitude ||
      selected.longitude ||
      selected.format ||
      selected.country,
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
    country: "",
    format: "",
  });
  const categoryAvailabilityEvents = await getSearchEvents({
    ...selected,
    q: "",
    categoryLabel: "",
    date: "",
    distance: "",
    latitude: "",
    longitude: "",
    format: "",
  });
  const mapOverviewEvents = await getSearchEvents({
    ...selected,
    q: "",
    area: "",
    date: "",
    distance: "",
    latitude: "",
    longitude: "",
    format: "",
  });
  const categoryEventCounts = getCategoryEventCounts(categoryAvailabilityEvents);
  const experienceGroups = await getExperienceGroups();
  const mainCategoryEventCounts = getMainCategoryEventCounts(categoryAvailabilityEvents);
  const homepageExperienceGroups = experienceGroups.filter((group) => experienceGroupHasEvents(group, mainCategoryEventCounts));
  const homepageExperienceGroupCounts = getExperienceGroupEventCounts(homepageExperienceGroups, categoryAvailabilityEvents);
  const searchEvents = hasSearch ? await getSearchEvents(selected) : [];
  const localServiceProviders = await getLocalServiceProviders(selected);
  const mapSourceEvents = uniqueEventsById(mapOverviewEvents);
  const facilitatorCards = await getHomeFacilitators(facilitatorQuery);
  const [featuredFacilitators, newFacilitators] = await Promise.all([
    getFeaturedHomeFacilitators(),
    getNewHomeFacilitators(),
  ]);
  const homepageEventPool = uniqueEventsById(upcomingEvents as PublicEvent[]);
  const physicalHomepageEvents = homepageEventPool.filter((event) => event.event_format !== "online");
  const newHomepageEvents = [...homepageEventPool].sort(
    (a, b) => new Date(b.created_at ?? b.starts_at).getTime() - new Date(a.created_at ?? a.starts_at).getTime(),
  );
  const saunaEvents = homepageEventPool.filter((event) => eventMatchesAnyLabel(event, ["Sauna", "Saunagus", "Velvære"]));
  const yogaEvents = homepageEventPool.filter((event) => eventMatchesAnyLabel(event, ["Yoga"]));
  const meditationEvents = homepageEventPool.filter((event) => eventMatchesAnyLabel(event, ["Meditation", "Mindfulness", "Nærvær"]));
  const retreatEvents = homepageEventPool.filter((event) => eventMatchesAnyLabel(event, ["Retreat", "Rejse", "Rejser"]));
  const onlineHomepageEvents = homepageEventPool.filter((event) => event.event_format === "online");
  const homepageEventSections = [
    { title: "Events nær dig", href: "/#find-events", events: physicalHomepageEvents.slice(0, 10) },
    { title: "Nye events", href: "/events", events: newHomepageEvents.slice(0, 10) },
    {
      title: "Sauna & Velvære",
      href: categoryPageHref(experienceGroups, "/?category_label=Saunagus#events", ["Sauna", "Velvære"]),
      events: saunaEvents.slice(0, 10),
    },
    {
      title: "Yoga",
      href: categoryPageHref(experienceGroups, "/?category_label=Yoga#events", ["Yoga", "Bevægelse", "Krop"]),
      events: yogaEvents.slice(0, 10),
    },
    {
      title: "Meditation",
      href: categoryPageHref(experienceGroups, "/?category_label=Meditation#events", ["Meditation", "Nærvær"]),
      events: meditationEvents.slice(0, 10),
    },
    {
      title: "Retreats & Rejser",
      href: categoryPageHref(experienceGroups, "/?category_label=Retreat#events", ["Retreat", "Rejse"]),
      events: retreatEvents.slice(0, 10),
    },
    { title: "Online events", href: "/?format=online#events", events: onlineHomepageEvents.slice(0, 10) },
  ];
  const mapEvents = mapSourceEvents.map((event) => {
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
      facilitatorName: facilitatorProfile?.company_name || facilitatorUser?.full_name || "Arrangør",
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
    country: selected.country,
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
    selected.country === "udenfor-danmark"
      ? { key: "country", label: "Events i udlandet", href: removeSearchParam(activeFilterParams, "country") }
      : null,
    selected.latitude && selected.longitude
      ? { key: "nearby", label: "I nærheden", href: "/#events" }
      : null,
  ].filter((filter): filter is { key: string; label: string; href: string } => Boolean(filter));

  return (
    <main className="min-h-screen overflow-x-clip bg-[#FAF6EF] text-[#2F2633]">
      <section className="relative overflow-hidden bg-[#FAF6EF] pb-8 md:bg-[linear-gradient(180deg,#FAF6EF_0%,#F7F0FA_58%,#FAF6EF_100%)] md:pb-10">
        <div
          className="absolute inset-x-0 top-0 h-[405px] bg-cover bg-center md:hidden"
          style={{ backgroundImage: "url('" + (homeHeroImage?.imageUrl ?? homeTileFallbackImages.fallback) + "')" }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 top-0 h-[405px] bg-[linear-gradient(90deg,rgba(250,246,239,0.84)_0%,rgba(250,246,239,0.36)_55%,rgba(250,246,239,0.08)_100%)] md:hidden"
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 top-0 h-[480px] bg-[linear-gradient(180deg,rgba(250,246,239,0.20)_0%,rgba(250,246,239,0.02)_48%,rgba(250,246,239,0.90)_84%,#FAF6EF_100%)] md:hidden"
          aria-hidden="true"
        />
        <div className="absolute left-1/2 top-8 hidden h-72 w-72 -translate-x-1/2 rounded-full bg-white/50 blur-3xl md:block" aria-hidden="true" />

        <header className="relative z-10">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3 sm:px-8 md:py-5">
            <Link aria-label="SoulEvents.dk forside" className="inline-flex items-center gap-2.5" href="/">
              <BrandLogo className="h-12 w-12 sm:h-16 sm:w-16 md:h-28 md:w-28 lg:h-32 lg:w-32" priority />
              <span className="font-serif text-xl font-semibold leading-none text-[#2F2633] md:hidden">SoulEvents</span>
            </Link>

            <nav className="hidden items-center gap-9 text-[15px] font-semibold tracking-[0.01em] text-[#2F2633] md:flex">
              <a className="transition hover:text-[#7A4EAB]" href="#find-events">
                Events
              </a>
              <a className="transition hover:text-[#7A4EAB]" href="#map">
                Kort
              </a>
              <Link className="transition hover:text-[#7A4EAB]" href="/facilitators">
                Arrangører
              </Link>
              <Link className="transition hover:text-[#7A4EAB]" href="/inspiration">
                Inspiration
              </Link>
              <a className="transition hover:text-[#7A4EAB]" href="#categories">
                Kategorier
              </a>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#D8A7B1] px-5 text-sm font-semibold text-[#2F2633] shadow-soft transition hover:-translate-y-0.5 hover:bg-[#C9939F]"
                href="#find-events"
              >
                Find events
              </Link>
              <Link className="transition hover:text-[#7A4EAB]" href="/auth/login">
                Login
              </Link>
            </nav>

            <MobileHomeMenu />
          </div>
        </header>

        <div className="relative z-10 mx-auto grid max-w-[1200px] min-w-0 gap-3 px-4 pb-6 pt-1 sm:gap-6 sm:px-8 sm:pb-8 md:pt-3">
          <section className="min-h-[265px] pt-16 md:hidden">
            <h1 className="max-w-[20rem] font-serif text-[2.22rem] font-semibold leading-[1.02] text-[#2F2633] drop-shadow-[0_2px_16px_rgba(255,255,255,0.55)]">
              Oplevelser der nærer krop, sind og sjæl
            </h1>
          </section>

          <section className="hidden overflow-hidden rounded-[28px] border border-white/80 bg-white/82 shadow-[0_18px_50px_rgba(47,38,51,0.10)] backdrop-blur md:grid md:grid-cols-[1.05fr_0.95fr]">
            <div className="p-4 sm:p-7 lg:p-9">
              <p className="inline-flex items-center gap-2 rounded-full bg-[#FAF6EF] px-3 py-1.5 text-xs font-semibold text-[#2F2633] shadow-soft sm:text-sm">
                <Sparkles className="size-4 text-[#7A4EAB]" aria-hidden="true" />
                SoulEvents.dk
              </p>
              <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight text-[#2F2633] sm:mt-4 sm:text-6xl sm:leading-[0.98] lg:text-7xl">
                Find events for krop, sind og sjæl
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#2F2633]/76 sm:mt-3 sm:text-lg sm:leading-7">
                Find spirituelle events, fællesskaber og oplevelser over hele Danmark.
              </p>
            </div>
            <div
              className="min-h-[120px] bg-cover bg-center sm:min-h-[240px] md:min-h-full"
              style={{ backgroundImage: "url('" + (homeHeroImage?.imageUrl ?? homeTileFallbackImages.fallback) + "')" }}
              aria-hidden="true"
            />
          </section>

          <div className="-mt-16 min-w-0 max-w-5xl md:mt-0" id="find-events">
            <div className="mb-3 hidden max-w-2xl md:block">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Find din næste oplevelse</p>
              <h2 className="mt-1 text-2xl font-medium leading-tight text-[#2F2633] sm:text-4xl">Søg efter det, der passer til dig</h2>
            </div>
            <HomeEventSearchForm
              categoryEventCounts={categoryEventCounts}
              experienceGroupEventCounts={homepageExperienceGroupCounts}
              experienceGroups={homepageExperienceGroups}
              selected={selected}
            />
          </div>
        </div>
      </section>

      {!hasSearch && (
        <section className="bg-white py-12 sm:py-12" id="events">
          <div className="mx-auto grid max-w-[1200px] gap-7 px-5 sm:gap-9 sm:px-8">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Aktuelle oplevelser</p>
              <h2 className="mt-1 text-4xl font-medium leading-tight text-[#2F2633] sm:text-5xl">Find dit næste event</h2>
            </div>

            {homepageEventSections.map((section) => (
              <EventCarouselSection events={section.events} href={section.href} key={section.title} title={section.title} />
            ))}
          </div>
        </section>
      )}

      {hasSearch && (
        <section className="bg-white py-16 sm:py-16" id="events">
          <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {activeFilters.map((filter) => (
                  <Link
                    className="inline-flex items-center gap-2 rounded-full border border-sage-700/20 bg-[#EDE4F7]/55 px-3 py-2 text-sm font-semibold text-[#2F2633] transition hover:border-sage-700"
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
                <section className="rounded-card border border-sage-700/15 bg-[#EDE4F7]/55 p-5 shadow-soft">
                  <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Events nær dig</p>
                  <h2 className="mt-2 text-3xl font-medium text-[#2F2633]">Vælg radius</h2>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {nearbyRadiusOptions.map((option) => (
                      <Link
                        className={
                          selected.distance === option.value || (!selected.distance && option.value === "50")
                            ? "rounded-full bg-olive px-4 py-2 text-sm font-semibold text-white"
                            : "rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#2F2633] transition hover:bg-[#FAF6EF]"
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

              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Søgeresultater</p>
                <h2 className="mt-3 text-4xl font-medium leading-tight text-[#2F2633] sm:text-5xl">
                  Events der matcher din søgning
                </h2>
              </div>

              {searchEvents.length > 0 ? (
                <>
                  <PublicEventList events={searchEvents as never} />
                  <LocalServiceProviderSection providers={localServiceProviders} />
                </>
              ) : (
                <div className="grid gap-8">
                  <section className="rounded-card bg-[#FAF6EF] p-8 text-center shadow-soft">
                    <CalendarDays className="mx-auto size-8 text-sage-700" aria-hidden="true" />
                    <h3 className="mt-4 text-3xl font-medium text-[#2F2633]">
                      Der blev ikke fundet events, der matcher dine filtre.
                    </h3>
                    <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-ink/64">
                      Prøv en anden kategori eller et andet område.
                    </p>
                    {selected.q && facilitatorCards.length > 0 && (
                      <div className="mx-auto mt-6 max-w-2xl rounded-card bg-white p-5 text-left shadow-soft">
                        <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Arrangør fundet</p>
                        <h4 className="mt-2 text-2xl font-medium text-[#2F2633]">
                          Måske leder du efter en arrangør?
                        </h4>
                        <div className="mt-4 grid gap-3">
                          {facilitatorCards.slice(0, 3).map((facilitator) => (
                            <Link
                              className="flex items-center justify-between gap-3 rounded-md border border-olive/10 bg-[#EDE4F7]/55 px-4 py-3 text-sm font-semibold text-[#2F2633] transition hover:border-sage-700"
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
              )}
            </div>
          </div>
        </section>
      )}

      <section className="bg-[#FAF6EF] py-14 sm:py-14" id="map">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
          <div className="mb-4 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Danmarkskort</p>
            <h2 className="mt-1 text-3xl font-medium leading-tight text-[#2F2633] sm:text-5xl">Udforsk events på kort</h2>
          </div>
          <EventMap events={mapEvents} mapboxStyleUrl={env.mapboxStyleUrl} mapboxToken={env.mapboxToken} serviceProviders={localServiceProviders} />
        </div>
      </section>

      {!hasSearch && (
        <section className="bg-white py-12 sm:py-12" id="facilitators">
          <div className="mx-auto grid max-w-[1200px] gap-8 px-5 sm:px-8">
            <FacilitatorCarouselSection facilitators={facilitatorCards} href="/facilitators" title="Mød arrangørerne" />
          </div>
        </section>
      )}

      <section className="bg-white py-12 sm:py-12" id="categories">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
          <div className="mb-4 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Kategorier og inspiration</p>
            <h2 className="mt-1 text-3xl font-medium leading-tight text-[#2F2633] sm:text-5xl">Gå på opdagelse</h2>
          </div>
          <HomeDiscoveryTiles tiles={discoveryTiles} />
        </div>
      </section>


      {facilitatorQuery && <PublicFacilitatorCarousel facilitators={facilitatorCards} query={facilitatorQuery} />}

      <HomeInspirationSections
        featuredFacilitators={featuredFacilitators}
        newFacilitators={newFacilitators}
      />

      {homepageAds.length > 0 && (
        <section className="bg-white py-12 sm:py-14" aria-label="Partnerindhold">
          <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
            <PartnerAdCarousel ads={homepageAds} />
          </div>
        </section>
      )}

      <section className="bg-[#FAF6EF] py-12 sm:py-12" id="contact">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
          <div className="rounded-[28px] bg-white p-5 shadow-soft sm:p-7 md:flex md:items-center md:justify-between md:gap-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Kontakt</p>
              <h2 className="mt-2 text-3xl font-medium leading-tight text-[#2F2633] sm:text-4xl">Skriv til SoulEvents.dk</h2>
              <p className="mt-3 max-w-xl text-base leading-7 text-ink/70">
                Har du spørgsmål, ideer eller brug for hjælp, kan du sende en besked direkte til os.
              </p>
            </div>
            <Link
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-button bg-[#7A4EAB] px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift md:mt-0 md:w-auto"
              href="/contact"
            >
              <Mail className="size-4" aria-hidden="true" />
              Åbn kontaktformular
            </Link>
          </div>
        </div>
      </section>

      <SiteFooterLogin />
    </main>
  );
}
