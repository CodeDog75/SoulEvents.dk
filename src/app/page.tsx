/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CalendarDays,
  Mail,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Fragment } from "react";
import { PartnerAdCarousel } from "@/components/ads/partner-ad-carousel";
import { BrandLogo } from "@/components/brand-logo";
import { EventMap } from "@/components/events/event-map";
import { EventCarouselSection, FacilitatorCarouselSection } from "@/components/events/event-carousel-section";
import { HomeEventSearchForm } from "@/components/events/home-event-search-form";
import { PublicEventList, type PublicEvent } from "@/components/events/public-event-list";
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
    collection?: string;
    view?: string;
    code?: string;
    error?: string;
    error_description?: string;
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

  if (["retreat", "rejse", "rejser"].some((label) => name.includes(label))) {
    keys.add("Retreats & Rejser");
  }

  if (["uddannelse", "uddannelser"].some((label) => name.includes(label))) {
    keys.add("Uddannelse");
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

type HomepageEventCollection = {
  eventIds: string[];
  id: string;
  selection_mode: "automatic" | "manual";
  show_on_desktop: boolean;
  show_on_mobile: boolean;
  sort_order: number | null;
  tagIds: string[];
  title: string;
};

type HomepageEventSection = {
  events: PublicEvent[];
  href: string;
  showOnDesktop?: boolean;
  showOnMobile?: boolean;
  title: string;
};

async function getHomepageEventCollections(): Promise<HomepageEventCollection[]> {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return [];
  }

  const supabase = await createClient();
  const [{ data: collections, error: collectionsError }, { data: tagRelations, error: tagsError }, { data: eventRelations, error: eventsError }] = await Promise.all([
    supabase
      .from("homepage_event_collections")
      .select("id, title, is_active, sort_order, show_on_mobile, show_on_desktop, selection_mode")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase.from("homepage_event_collection_tags").select("collection_id, tag_id"),
    supabase.from("homepage_event_collection_events").select("collection_id, event_id, sort_order").order("sort_order", { ascending: true }),
  ]);

  if (collectionsError || !collections) {
    return [];
  }

  if (tagsError) {
    console.error("Homepage event collection tags could not be loaded", tagsError);
  }

  if (eventsError) {
    console.error("Homepage event collection events could not be loaded", eventsError);
  }

  const tagIdsByCollection = new Map<string, string[]>();
  const eventIdsByCollection = new Map<string, string[]>();

  for (const relation of tagRelations ?? []) {
    const current = tagIdsByCollection.get(relation.collection_id) ?? [];
    current.push(relation.tag_id);
    tagIdsByCollection.set(relation.collection_id, current);
  }

  for (const relation of eventRelations ?? []) {
    const current = eventIdsByCollection.get(relation.collection_id) ?? [];
    current.push(relation.event_id);
    eventIdsByCollection.set(relation.collection_id, current);
  }

  return collections.map((collection) => ({
    eventIds: eventIdsByCollection.get(collection.id) ?? [],
    id: collection.id,
    selection_mode: collection.selection_mode === "manual" ? "manual" : "automatic",
    show_on_desktop: collection.show_on_desktop,
    show_on_mobile: collection.show_on_mobile,
    sort_order: collection.sort_order,
    tagIds: tagIdsByCollection.get(collection.id) ?? [],
    title: collection.title,
  }));
}

function eventsByIdsInOrder(events: PublicEvent[], eventIds: string[]) {
  const eventById = new Map(events.map((event) => [event.id, event]));
  return eventIds.map((eventId) => eventById.get(eventId)).filter(Boolean) as PublicEvent[];
}

function homepageCollectionHref(collectionId: string) {
  return `/?collection=${encodeURIComponent(collectionId)}#events`;
}

function homepageViewHref(view: "nearby" | "new") {
  return `/?view=${view}#events`;
}

function eventMatchesTagIds(event: PublicEvent, tagIds: string[]) {
  if (tagIds.length === 0) {
    return false;
  }

  const selectedTagIds = new Set(tagIds);
  return Boolean(event.event_tags?.some((tag) => tag.tag_id && selectedTagIds.has(tag.tag_id)));
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
  fallback: "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=900&q=80",
};

type HeroImage = {
  image_path: string;
  alt_text: string | null;
};

type WeeklyReflection = {
  title: string;
  reflection_text: string;
  author: string | null;
  background_color: string;
  start_date?: string | null;
  end_date?: string | null;
};

const weeklyReflectionGradients: Record<string, string> = {
  "gradient:lavender-cream": "linear-gradient(135deg, #F1E8F8 0%, #FAF6EF 58%, #FFFDF8 100%)",
  "gradient:sage-sand": "linear-gradient(135deg, #EEF3EA 0%, #F6F1E7 54%, #D8C1A2 130%)",
  "gradient:dusty-purple-beige": "linear-gradient(135deg, #E9DFF1 0%, #FAF7F2 52%, #EFE4D6 100%)",
  "gradient:warm-grey-cream": "linear-gradient(135deg, #ECE8E1 0%, #FAF6EF 60%, #FFFDF8 100%)",
};

function weeklyReflectionBackground(value: string) {
  return weeklyReflectionGradients[value] ?? value;
}

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

async function getActiveWeeklyReflection() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weekly_reflections")
    .select("title, reflection_text, author, background_color, start_date, end_date")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(5);

  if (error || !data || data.length === 0) {
    return null;
  }

  const today = new Date().toISOString().slice(0, 10);
  const reflection = (data as WeeklyReflection[]).find((item) => {
    const hasStarted = !item.start_date || item.start_date <= today;
    const hasNotEnded = !item.end_date || item.end_date >= today;
    return hasStarted && hasNotEnded;
  });

  if (!reflection?.reflection_text?.trim()) {
    return null;
  }

  return {
    title: reflection.title?.trim() || "Ugens refleksion",
    reflectionText: reflection.reflection_text.trim(),
    author: reflection.author?.trim() || null,
    backgroundColor: reflection.background_color || "#FAF6EF",
  };
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
      "id, status, title, short_description, starts_at, created_at, latitude, longitude, city, price_cents, capacity, cover_image_path, event_format, facilitator_profiles!inner(id, status, company_name, profiles(full_name)), regions(name), event_categories(categories(id, name, color_hex)), event_main_categories(main_category_id, main_categories(name, color_hex, image_path)), event_subcategories(subcategory_id, subcategories(name, slug)), event_tags(tag_id, tags(name))",
    )
    .in("status", ["active", "sold_out"])
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
  const [{ data, error }, { data: heroImages }] = await Promise.all([
    supabase
      .from("main_categories")
      .select(
        "id, name, slug, description, color_hex, image_path, sort_order, subcategory_main_categories(subcategories(id, name, sort_order, is_active))",
      )
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("hero_images")
      .select("main_category_id, image_path, sort_order")
      .eq("scope", "main_category")
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  if (error || !data) {
    return [];
  }

  const heroImageByCategoryId = new Map<string, string>();

  for (const heroImage of heroImages ?? []) {
    if (heroImage.main_category_id && heroImage.image_path && !heroImageByCategoryId.has(heroImage.main_category_id)) {
      heroImageByCategoryId.set(heroImage.main_category_id, heroImage.image_path);
    }
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

    const heroImagePath = mainCategory.image_path ?? heroImageByCategoryId.get(mainCategory.id);

    return {
      id: mainCategory.id,
      name: mainCategory.name,
      slug: mainCategory.slug,
      description: mainCategory.description,
      colorHex: mainCategory.color_hex || "#7A4EAB",
      imageUrl: heroImagePath ? supabase.storage.from("media").getPublicUrl(heroImagePath).data.publicUrl : null,
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
                // eslint-disable-next-line @next/next/no-img-element
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


async function getHomepageAds(placement: "middle" | "bottom") {
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

  const mapAds = (ads: any[]) =>
    ads.map((ad: any) => ({
      id: ad.id,
      title: ad.title,
      imageUrl: publicMediaUrl(ad.image_path),
      mobileImageUrl: publicMediaUrl(ad.mobile_image_path),
      altText: ad.alt_text || ad.title,
      targetUrl: ad.target_url,
      displaySeconds: ad.display_seconds ?? 10,
      sponsorName: ad.sponsor_name,
      showTitle: ad.show_title_on_banner ?? true,
      showSponsor: ad.show_sponsor_on_banner ?? true,
    }));

  const applyActiveHomepageFilters = (query: any) =>
    query
      .eq("is_active", true)
      .eq("show_on_homepage", true)
      .or("starts_at.is.null,starts_at.lte." + nowIso)
      .or("ends_at.is.null,ends_at.gte." + nowIso)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false });

  const { data, error } = await applyActiveHomepageFilters(
    supabase
      .from("ads")
      .select("id, title, image_path, mobile_image_path, alt_text, sponsor_name, target_url, priority, display_seconds, show_title_on_banner, show_sponsor_on_banner, clicks_count, homepage_placement"),
  ).eq("homepage_placement", placement);

  if (!error && data) {
    return mapAds(data);
  }

  if (placement !== "bottom") {
    return [];
  }

  const { data: fallbackData, error: fallbackError } = await applyActiveHomepageFilters(
    supabase
      .from("ads")
      .select("id, title, image_path, mobile_image_path, alt_text, sponsor_name, target_url, priority, display_seconds, show_title_on_banner, show_sponsor_on_banner, clicks_count"),
  );

  if (fallbackError || !fallbackData) {
    return [];
  }

  return mapAds(fallbackData);
}

export default async function Home({ searchParams }: HomeProps) {
  const params = searchParams ? await searchParams : {};

  if (params.code || params.error) {
    const callbackParams = new URLSearchParams();

    if (params.code) {
      callbackParams.set("code", params.code);
    }

    if (params.error) {
      callbackParams.set("error", params.error);
    }

    if (params.error_description) {
      callbackParams.set("error_description", params.error_description);
    }

    for (const key of ["flow", "provider", "mode", "next"]) {
      const value = params[key as keyof typeof params];

      if (typeof value === "string" && value) {
        callbackParams.set(key, value);
      }
    }

    redirect(`/auth/callback?${callbackParams.toString()}`);
  }

  const homeHeroImage = await getHomepageHeroImage();
  const weeklyReflection = await getActiveWeeklyReflection();
  const weeklyReflectionParagraphs = weeklyReflection?.reflectionText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean) ?? [];
  const [homepageMiddleAds, homepageBottomAds] = await Promise.all([
    getHomepageAds("middle"),
    getHomepageAds("bottom"),
  ]);
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
  const selectedCollectionId = params.collection ?? "";
  const selectedHomepageView = params.view === "nearby" || params.view === "new" ? params.view : "";
  const hasSearch = Boolean(
    selected.q ||
      selected.area ||
      selected.categoryLabel ||
      selected.date ||
      selected.distance ||
      selected.latitude ||
      selected.longitude ||
      selected.format ||
      selected.country ||
      selectedCollectionId ||
      selectedHomepageView,
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
  const mapSourceEvents = uniqueEventsById(mapOverviewEvents);
  const facilitatorCards = await getHomeFacilitators(facilitatorQuery);
  const [featuredFacilitators, newFacilitators] = await Promise.all([
    getFeaturedHomeFacilitators(),
    getNewHomeFacilitators(),
  ]);
  const adminHomepageEventCollections = await getHomepageEventCollections();
  const homepageEventPool = uniqueEventsById(upcomingEvents as PublicEvent[]);
  const selectedHomepageEventCollection = adminHomepageEventCollections.find((collection) => collection.id === selectedCollectionId);
  const physicalHomepageEvents = homepageEventPool.filter((event) => event.event_format !== "online");
  const newHomepageEvents = [...homepageEventPool].sort(
    (a, b) => new Date(b.created_at ?? b.starts_at).getTime() - new Date(a.created_at ?? a.starts_at).getTime(),
  );
  const eventsForHomepageCollection = (collection: HomepageEventCollection) =>
    collection.selection_mode === "manual"
      ? eventsByIdsInOrder(homepageEventPool, collection.eventIds)
      : homepageEventPool.filter((event) => eventMatchesTagIds(event, collection.tagIds));
  const selectedCollectionEvents = selectedHomepageEventCollection ? eventsForHomepageCollection(selectedHomepageEventCollection) : [];
  const selectedViewEvents =
    selectedHomepageView === "nearby" ? physicalHomepageEvents : selectedHomepageView === "new" ? newHomepageEvents : [];
  const selectedViewTitle =
    selectedHomepageView === "nearby" ? "Events nær dig" : selectedHomepageView === "new" ? "Nye events" : "";
  const displayedSearchEvents = selectedHomepageEventCollection
    ? selectedCollectionEvents
    : selectedHomepageView
      ? selectedViewEvents
      : searchEvents;
  const localServiceProviders = selectedHomepageEventCollection || selectedHomepageView ? [] : await getLocalServiceProviders(selected);
  const adminHomepageEventSections = adminHomepageEventCollections
    .map((collection) => ({
      events: eventsForHomepageCollection(collection).slice(0, 10),
      href: homepageCollectionHref(collection.id),
      showOnDesktop: collection.show_on_desktop,
      showOnMobile: collection.show_on_mobile,
      sortOrder: collection.sort_order ?? 0,
      title: collection.title,
    }))
    .filter((section) => section.events.length > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "da-DK"));
  const homepageEventSections: HomepageEventSection[] = [
    { title: "Events nær dig", href: homepageViewHref("nearby"), events: physicalHomepageEvents.slice(0, 10) },
    { title: "Nye events", href: homepageViewHref("new"), events: newHomepageEvents.slice(0, 10) },
    ...adminHomepageEventSections,
  ];
  const mobileHiddenHomepageEventSections = new Set(["Events nær dig"]);
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
    selectedHomepageEventCollection
      ? { key: "collection", label: selectedHomepageEventCollection.title, href: "/#events" }
      : null,
    selectedHomepageView
      ? { key: "view", label: selectedViewTitle, href: "/#events" }
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

        <header className="relative z-20 md:absolute md:inset-x-0 md:top-0">
          <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-3 sm:px-8 md:py-5">
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

        <div className="relative z-10 mx-auto grid max-w-[1200px] min-w-0 gap-3 px-4 pb-6 pt-1 sm:gap-6 sm:px-8 sm:pb-8 md:pt-0">
          <section className="min-h-[265px] pt-16 md:hidden">
            <h1 className="max-w-[20rem] font-serif text-[2.22rem] font-semibold leading-[1.02] text-[#2F2633] drop-shadow-[0_2px_16px_rgba(255,255,255,0.55)]">
              Oplevelser der nærer krop, sind og sjæl
            </h1>
          </section>

          <section
            className="relative hidden min-h-[540px] overflow-hidden bg-[#FAF6EF] bg-cover bg-center md:block lg:min-h-[580px] xl:min-h-[620px]"
            style={{ backgroundImage: "url('" + (homeHeroImage?.imageUrl ?? homeTileFallbackImages.fallback) + "')" }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(90deg,#FAF6EF_0%,rgba(250,246,239,0.92)_9%,rgba(250,246,239,0.55)_42%,rgba(250,246,239,0.12)_72%,#FAF6EF_100%)]" aria-hidden="true" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(250,246,239,0.28)_0%,rgba(250,246,239,0.03)_46%,rgba(250,246,239,0.82)_86%,#FAF6EF_100%)]" aria-hidden="true" />
            <div className="relative flex min-h-[540px] max-w-[760px] flex-col justify-center px-9 pb-16 pt-40 lg:min-h-[580px] lg:px-12 xl:min-h-[620px]">
              <p className="inline-flex w-max items-center gap-2 rounded-full bg-white/72 px-3 py-1.5 text-xs font-semibold text-[#2F2633] shadow-soft backdrop-blur sm:text-sm">
                <Sparkles className="size-4 text-[#7A4EAB]" aria-hidden="true" />
                SoulEvents.dk
              </p>
              <h1 className="mt-5 max-w-[720px] text-5xl font-semibold leading-[0.98] text-[#2F2633] lg:text-7xl">
                Find events for krop, sind og sjæl
              </h1>
              <p className="mt-5 max-w-[620px] text-lg leading-8 text-[#2F2633]/78">
                Find spirituelle events, fællesskaber og oplevelser over hele Danmark.
              </p>
            </div>
          </section>

          <div className="relative z-20 -mt-16 min-w-0 w-full md:-mt-28" id="find-events">
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

            {homepageEventSections.map((section, index) => {
              const hideOnMobile = mobileHiddenHomepageEventSections.has(section.title) || section.showOnMobile === false;
              const hideOnDesktop = section.showOnDesktop === false;
              const visibilityClass = hideOnMobile && hideOnDesktop ? "hidden" : hideOnMobile ? "hidden md:block" : hideOnDesktop ? "md:hidden" : undefined;

              return (
                <Fragment key={section.title}>
                  <div className={visibilityClass}>
                    <EventCarouselSection events={section.events} href={section.href} title={section.title} />
                  </div>
                  {index === 1 && homepageMiddleAds.length > 0 ? (
                    <PartnerAdCarousel ads={homepageMiddleAds} className="py-1" />
                  ) : null}
                </Fragment>
              );
            })}
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
                  {selectedHomepageEventCollection
                    ? selectedHomepageEventCollection.title
                    : selectedHomepageView
                      ? selectedViewTitle
                      : "Events der matcher din søgning"}
                </h2>
              </div>

              {displayedSearchEvents.length > 0 ? (
                <>
                  <PublicEventList events={displayedSearchEvents as never} />
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

      {facilitatorQuery && <PublicFacilitatorCarousel facilitators={facilitatorCards} query={facilitatorQuery} />}

      <HomeInspirationSections
        featuredFacilitators={featuredFacilitators}
        newFacilitators={newFacilitators}
      />

      {homepageBottomAds.length > 0 && (
        <section className="bg-white py-12 sm:py-14" aria-label="Partnerindhold">
          <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
            <PartnerAdCarousel ads={homepageBottomAds} />
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

      {weeklyReflection && (
        <section className="soulevents-fade-in bg-[#FAF6EF] px-5 py-14 sm:px-8 sm:py-16 lg:py-20" aria-label={weeklyReflection.title}>
          <div className="mx-auto max-w-[1200px]">
            <figure
              className="relative overflow-hidden rounded-[30px] border border-white/75 px-7 py-12 shadow-[0_24px_70px_rgba(47,38,51,0.10)] sm:px-12 sm:py-16 lg:px-16 lg:py-20"
              style={{ background: weeklyReflectionBackground(weeklyReflection.backgroundColor) }}
            >
              <div className="pointer-events-none absolute -right-8 -top-10 hidden size-40 rounded-full border border-white/65 bg-white/20 sm:block" />
              <div className="pointer-events-none absolute bottom-8 right-8 hidden font-serif text-[11rem] leading-none text-white/30 sm:block">
                &rdquo;
              </div>
              <div className="relative mx-auto max-w-[760px]">
                <figcaption className="inline-flex items-center rounded-full bg-white/82 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#7A4EAB] shadow-soft">
                  🌿 {weeklyReflection.title}
                </figcaption>
                <blockquote className="mt-8 space-y-6 font-serif text-3xl font-medium leading-[1.18] text-[#2F2633] sm:text-4xl sm:leading-[1.2]">
                  {weeklyReflectionParagraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </blockquote>
                {weeklyReflection.author && (
                  <p className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-[#2F2633]/58">- {weeklyReflection.author}</p>
                )}
                <p className="mt-10 inline-flex border-t border-[#2F2633]/12 pt-5 text-sm font-semibold text-[#4B5645]">
                  Tag et øjeblik med dig selv.
                </p>
              </div>
            </figure>
          </div>
        </section>
      )}

      <SiteFooterLogin />
    </main>
  );
}
