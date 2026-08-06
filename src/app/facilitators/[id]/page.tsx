import type { Metadata } from "next";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { TrackFacilitatorProfileView } from "@/components/analytics/track-facilitator-profile-view";
import { organizerBadgesFromFlags } from "@/components/badges/organizer-badges";
import { PublicFacilitatorProfile } from "@/components/facilitator/public-facilitator-profile";
import { subscribeToFacilitatorReminderAction } from "./actions";
import { getCurrentProfile } from "@/lib/auth/roles";
import { getAvailableEventSeatsByEventId } from "@/lib/events/capacity";
import { getUserFacingEventStatus } from "@/lib/events/user-facing-status";
import { resolveFacilitatorHero } from "@/lib/facilitators/hero-collection";
import { withFacilitatorMoodImageFallback } from "@/lib/facilitators/mood-image-fallback";
import { facilitatorWorkAreaSlugSet } from "@/lib/facilitators/work-areas";
import { profileCountryName } from "@/lib/locations/countries";
import { absoluteUrl, createPageMetadata, publicMediaUrl } from "@/lib/open-graph";
import { buildFacilitatorMetadata, buildProfilePageJsonLd } from "@/lib/seo/public-page-metadata";
import { publicFacilitatorPath } from "@/lib/slug";
import { publicReturnLabel, safePublicReturnPath } from "@/lib/return-to";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type FacilitatorPageProps = {
  params: Promise<{ id?: string; slug?: string }>;
  searchParams?: Promise<{ admin_return?: string; facilitator_return?: string; reminder_message?: string; return_to?: string }>;
};

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function facilitatorIdentifier(params: { id?: string; slug?: string }) {
  return params.slug ?? params.id ?? "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function withSearch(path: string, searchParams: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? path + "?" + query : path;
}

function ensureUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : "https://" + url;
}

function normalizeSpecialtyText(input: string | null | undefined) {
  return (input ?? "").replace(/\s+/g, " ").trim();
}

function facilitatorCategories(facilitator: any) {
  return (
    facilitator?.facilitator_categories
      ?.map((row: any) => (Array.isArray(row.categories) ? row.categories[0] : row.categories))
      .filter((category: any) => category?.slug && facilitatorWorkAreaSlugSet.has(category.slug)) ?? []
  );
}

function nameOf(facilitator: any) {
  const profile = first(facilitator?.profiles);
  return facilitator?.company_name || profile?.full_name || "Arrangør";
}

function getBackLink(referer: string | null, currentPath: string) {
  if (!referer) {
    return { href: "/facilitators", label: "Tilbage til arrangører" };
  }

  try {
    const url = new URL(referer);

    if (url.pathname === "/") {
      return { href: "/#events", label: "Tilbage til forsiden" };
    }

    if (url.pathname === "/facilitators") {
      return { href: "/facilitators", label: "Tilbage til arrangører" };
    }

    if (url.pathname === currentPath || url.pathname.startsWith("/facilitators/") || url.pathname.startsWith("/arrangor/")) {
      return { href: "/facilitators", label: "Tilbage til arrangører" };
    }
  } catch {
    return { href: "/facilitators", label: "Tilbage til arrangører" };
  }

  return { href: "/facilitators", label: "Tilbage til arrangører" };
}

function getAdminReturnLink(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;

  try {
    const url = new URL(value, "https://soulevents.local");

    if (!url.pathname.startsWith("/admin")) return null;

    const href = url.pathname + url.search + url.hash;
    const label = url.pathname.startsWith("/admin/users") ? "Tilbage til arrangøroversigten" : "Tilbage til admin-dashboardet";

    return { href, label };
  } catch {
    return null;
  }
}

function getFacilitatorReturnLink(value: string | undefined) {
  if (value !== "/facilitator") return null;
  return { href: value, label: "Tilbage til dashboard" };
}

function isMissingHeroKeyColumn(error: { code?: string; message?: string } | null) {
  return Boolean(
    error &&
      (error.code === "42703" ||
        error.code === "PGRST204" ||
        error.message?.includes("facilitator_hero_key") ||
        error.message?.includes("schema cache")),
  );
}

const facilitatorMetadataSelectWithHero =
  "id, slug, host_reference_id, company_name, facilitator_hero_key, profile_image_path, short_description, specialties, long_description, service_description, city, country, country_name, region_text, show_public_location, profiles!facilitator_profiles_profile_id_fkey(full_name), regions(name), facilitator_categories(categories(name, slug)), facilitator_images(image_path, sort_order)";
const facilitatorMetadataSelectLegacy =
  "id, slug, host_reference_id, company_name, profile_image_path, short_description, specialties, long_description, service_description, city, country, country_name, region_text, profiles!facilitator_profiles_profile_id_fkey(full_name), regions(name), facilitator_categories(categories(name, slug)), facilitator_images(image_path, sort_order)";
const facilitatorSelectWithHero =
  "id, profile_id, slug, host_reference_id, company_name, facilitator_hero_key, profile_image_path, short_description, specialties, long_description, website_url, public_email, public_phone, facebook_url, instagram_url, youtube_url, tiktok_url, address_line, postal_code, city, country, country_name, region_text, show_public_location, is_online_facilitator, is_active_host, is_experienced_host, offers_services, service_description, profiles!facilitator_profiles_profile_id_fkey(full_name, email, phone), regions(name), facilitator_categories(categories(name, slug, color_hex)), facilitator_images(image_path, alt_text, sort_order)";
const facilitatorSelectLegacy =
  "id, profile_id, slug, host_reference_id, company_name, profile_image_path, short_description, specialties, long_description, website_url, public_email, public_phone, facebook_url, instagram_url, youtube_url, tiktok_url, address_line, postal_code, city, country, country_name, region_text, is_online_facilitator, is_active_host, is_experienced_host, offers_services, service_description, profiles!facilitator_profiles_profile_id_fkey(full_name, email, phone), regions(name), facilitator_categories(categories(name, slug, color_hex)), facilitator_images(image_path, alt_text, sort_order)";
const publicEventSelect =
  "id, slug, status, title, short_description, starts_at, ends_at, city, price_cents, capacity, event_format, cover_image_path, facilitator_profiles!inner(id, status, company_name, profiles!facilitator_profiles_profile_id_fkey(full_name)), event_co_organizers(created_at, status, facilitator_profiles!event_co_organizers_co_organizer_profile_id_fkey(id, slug, company_name, profiles!facilitator_profiles_profile_id_fkey(full_name))), regions(name), event_categories(categories(name, color_hex)), event_main_categories(main_categories(name, color_hex, image_path))";

function sortEventsByStartDate<T extends { starts_at: string }>(events: T[]) {
  return [...events].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
}

function sortEventsByEndDateDesc<T extends { ends_at?: string | null; starts_at: string }>(events: T[]) {
  return [...events].sort((a, b) => {
    const aEnd = new Date(a.ends_at || a.starts_at).getTime();
    const bEnd = new Date(b.ends_at || b.starts_at).getTime();
    return bEnd - aEnd;
  });
}

function uniqueProfileEvents(primaryEvents: any[], coOrganizerEvents: any[], sortEvents = sortEventsByStartDate) {
  const byId = new Map<string, any>();

  for (const event of primaryEvents) {
    byId.set(event.id, { ...event, organizer_role: "primary" });
  }

  for (const event of coOrganizerEvents) {
    if (!byId.has(event.id)) {
      byId.set(event.id, { ...event, organizer_role: "coOrganizer" });
    }
  }

  return sortEvents([...byId.values()]);
}

export async function generateMetadata({ params }: FacilitatorPageProps): Promise<Metadata> {
  const identifier = facilitatorIdentifier(await params);
  const supabase = await createClient();
  let { data: facilitator, error: facilitatorError } = await supabase
    .from("facilitator_profiles")
    .select(facilitatorMetadataSelectWithHero)
    .eq("slug", identifier)
    .eq("status", "approved")
    .eq("is_paused", false)
    .eq("is_disabled", false)
    .single();

  if (isMissingHeroKeyColumn(facilitatorError)) {
    const legacyResult = await supabase
      .from("facilitator_profiles")
      .select(facilitatorMetadataSelectLegacy)
      .eq("slug", identifier)
      .eq("status", "approved")
      .eq("is_paused", false)
      .eq("is_disabled", false)
      .single();
    facilitator = legacyResult.data as typeof facilitator;
    facilitatorError = legacyResult.error;
  }

  if (!facilitator && isUuid(identifier)) {
    const fallbackResult = await supabase
      .from("facilitator_profiles")
      .select(facilitatorMetadataSelectWithHero)
      .eq("id", identifier)
      .eq("status", "approved")
      .eq("is_paused", false)
      .eq("is_disabled", false)
      .single();
    facilitator = fallbackResult.data as typeof facilitator;
  }

  if (!facilitator) {
    return {
      ...createPageMetadata({
        title: "Arrangør | SoulEvents.dk",
        description: "Find arrangører på SoulEvents.dk.",
        path: publicFacilitatorPath(identifier || "arrangoer"),
      }),
      robots: { index: false, follow: false },
    };
  }

  const name = nameOf(facilitator);
  const galleryImages = [...(((facilitator as any).facilitator_images ?? []) as Array<{ image_path: string | null; sort_order: number | null }>)]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const moodImage = resolveFacilitatorHero({
    fallbackAltText: "Roligt SoulEvents naturbillede",
    heroKey: (facilitator as any).facilitator_hero_key,
    moodImages: galleryImages.map((image) => ({ imagePath: image.image_path, sortOrder: image.sort_order })),
    preferCustomWhenUnset: true,
    resolveImagePath: (imagePath) => publicMediaUrl(supabase, imagePath),
  });
  const imageUrl = facilitator.profile_image_path ? publicMediaUrl(supabase, facilitator.profile_image_path) : moodImage.url;
  const { data: upcomingEvents } = await supabase
    .from("events")
    .select("title")
    .eq("facilitator_id", facilitator.id)
    .in("status", ["active", "sold_out"])
    .gte("ends_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(2);
  const metadata = buildFacilitatorMetadata({
    categories: facilitatorCategories(facilitator).map((category: any) => category.name),
    city: (facilitator as any).show_public_location === false ? null : facilitator.city,
    country: facilitator.country,
    countryName: (facilitator as any).country_name,
    eventTitles: (upcomingEvents ?? []).map((event) => event.title),
    name,
    presentationText: facilitator.long_description || facilitator.short_description,
    region: (facilitator as any).show_public_location === false ? null : first((facilitator as any).regions)?.name || (facilitator as any).region_text,
    serviceDescription: (facilitator as any).service_description,
    specialties: normalizeSpecialtyText((facilitator as any).specialties) ? [normalizeSpecialtyText((facilitator as any).specialties)] : [],
  });

  return createPageMetadata({
    title: metadata.title,
    description: metadata.description,
    imageTitle: name,
    imageSubtitle: "Arrangør på SoulEvents.dk",
    imageUrl,
    path: publicFacilitatorPath(facilitator.slug),
    type: "article",
  });
}

export default async function PublicFacilitatorPage({ params, searchParams }: FacilitatorPageProps) {
  const resolvedParams = await params;
  const identifier = facilitatorIdentifier(resolvedParams);
  const isLegacyRoute = Boolean(resolvedParams.id);
  const resolvedSearchParams = await searchParams;
  const reminderMessage = resolvedSearchParams?.reminder_message ?? "";
  const adminReturnLink = getAdminReturnLink(resolvedSearchParams?.admin_return);
  const facilitatorReturnLink = getFacilitatorReturnLink(resolvedSearchParams?.facilitator_return);
  const referer = (await headers()).get("referer");
  const supabase = await createClient();
  const viewer = await getCurrentProfile();

  let { data: publicFacilitator, error: publicFacilitatorError } = await supabase
    .from("facilitator_profiles")
    .select(facilitatorSelectWithHero)
    .eq("slug", identifier)
    .eq("status", "approved")
    .eq("is_paused", false)
    .eq("is_disabled", false)
    .single();

  if (isMissingHeroKeyColumn(publicFacilitatorError)) {
    const legacyResult = await supabase
      .from("facilitator_profiles")
      .select(facilitatorSelectLegacy)
      .eq("slug", identifier)
      .eq("status", "approved")
      .eq("is_paused", false)
      .eq("is_disabled", false)
      .single();
    publicFacilitator = legacyResult.data as typeof publicFacilitator;
    publicFacilitatorError = legacyResult.error;
  }

  if (!publicFacilitator && isUuid(identifier)) {
    const fallbackResult = await supabase
      .from("facilitator_profiles")
      .select(facilitatorSelectWithHero)
      .eq("id", identifier)
      .eq("status", "approved")
      .eq("is_paused", false)
      .eq("is_disabled", false)
      .single();
    publicFacilitator = fallbackResult.data as typeof publicFacilitator;
    publicFacilitatorError = fallbackResult.error;
  }

  if (publicFacilitatorError && publicFacilitatorError.code !== "PGRST116") {
    console.error("[facilitator-profile] public lookup failed", {
      code: publicFacilitatorError.code,
      id: identifier,
      message: publicFacilitatorError.message,
    });
  }

  const canPreviewFacilitator =
    !publicFacilitator && ((adminReturnLink && viewer?.role === "admin") || (facilitatorReturnLink && viewer?.role === "facilitator"));
  let { data: previewFacilitator, error: previewFacilitatorError } = canPreviewFacilitator
    ? isUuid(identifier)
      ? await createAdminClient().from("facilitator_profiles").select(facilitatorSelectWithHero).eq("id", identifier).single()
      : await createAdminClient().from("facilitator_profiles").select(facilitatorSelectWithHero).eq("slug", identifier).single()
    : { data: null, error: null };

  if (isMissingHeroKeyColumn(previewFacilitatorError)) {
    const legacyResult = isUuid(identifier)
      ? await createAdminClient().from("facilitator_profiles").select(facilitatorSelectLegacy).eq("id", identifier).single()
      : await createAdminClient().from("facilitator_profiles").select(facilitatorSelectLegacy).eq("slug", identifier).single();
    previewFacilitator = legacyResult.data as typeof previewFacilitator;
    previewFacilitatorError = legacyResult.error;
  }
  if (previewFacilitatorError) {
    console.error("[facilitator-profile] preview lookup failed", {
      code: previewFacilitatorError.code,
      id: identifier,
      message: previewFacilitatorError.message,
    });
  }
  const facilitator = publicFacilitator ?? previewFacilitator;

  const facilitatorData = facilitator as any;

  if (!facilitatorData) {
    notFound();
  }

  if (isLegacyRoute && facilitatorData.slug) {
    permanentRedirect(
      withSearch(publicFacilitatorPath(facilitatorData.slug), {
        admin_return: resolvedSearchParams?.admin_return,
        facilitator_return: resolvedSearchParams?.facilitator_return,
        reminder_message: resolvedSearchParams?.reminder_message,
        return_to: resolvedSearchParams?.return_to,
      }),
    );
  }

  if (facilitatorReturnLink && (viewer?.role !== "facilitator" || viewer.id !== facilitatorData.profile_id)) {
    notFound();
  }

  const nowIso = new Date().toISOString();
  const heldEventStatuses = ["active", "sold_out", "completed"];
  const pastEventLimit = 12;

  const { data: events } = await supabase
    .from("events")
    .select(publicEventSelect)
    .eq("facilitator_id", facilitatorData.id)
    .in("status", ["active", "sold_out"])
    .eq("facilitator_profiles.status", "approved")
    .eq("facilitator_profiles.is_paused", false)
    .eq("facilitator_profiles.is_disabled", false)
    .gte("ends_at", nowIso)
    .order("starts_at", { ascending: true });
  const { data: coOrganizerRows } = await supabase
    .from("event_co_organizers")
    .select(
      "event_id, status, events!event_co_organizers_event_id_fkey!inner(" +
        publicEventSelect +
        ")",
    )
    .eq("co_organizer_profile_id", facilitatorData.id)
    .eq("status", "accepted")
    .in("events.status", ["active", "sold_out"])
    .eq("events.facilitator_profiles.status", "approved")
    .eq("events.facilitator_profiles.is_paused", false)
    .eq("events.facilitator_profiles.is_disabled", false)
    .gte("events.ends_at", nowIso);
  const coOrganizerEvents =
    coOrganizerRows
      ?.map((row: any) => first(row.events))
      .filter((event: any) => Boolean(event)) ?? [];
  const profileEvents = uniqueProfileEvents(events ?? [], coOrganizerEvents);
  const { data: pastPrimaryEvents } = await supabase
    .from("events")
    .select(publicEventSelect)
    .eq("facilitator_id", facilitatorData.id)
    .in("status", heldEventStatuses)
    .eq("facilitator_profiles.status", "approved")
    .eq("facilitator_profiles.is_paused", false)
    .eq("facilitator_profiles.is_disabled", false)
    .lt("ends_at", nowIso)
    .order("ends_at", { ascending: false })
    .limit(pastEventLimit);
  const { data: pastCoOrganizerRows } = await supabase
    .from("event_co_organizers")
    .select(
      "event_id, status, events!event_co_organizers_event_id_fkey!inner(" +
        publicEventSelect +
        ")",
    )
    .eq("co_organizer_profile_id", facilitatorData.id)
    .eq("status", "accepted")
    .in("events.status", heldEventStatuses)
    .eq("events.facilitator_profiles.status", "approved")
    .eq("events.facilitator_profiles.is_paused", false)
    .eq("events.facilitator_profiles.is_disabled", false)
    .lt("events.ends_at", nowIso)
    .order("ends_at", { ascending: false, referencedTable: "events" })
    .limit(pastEventLimit);
  const pastCoOrganizerEvents =
    pastCoOrganizerRows
      ?.map((row: any) => first(row.events))
      .filter((event: any) => Boolean(event)) ?? [];
  const pastEvents = uniqueProfileEvents(pastPrimaryEvents ?? [], pastCoOrganizerEvents, sortEventsByEndDateDesc)
    .filter((event: any) => getUserFacingEventStatus(event) === "held")
    .slice(0, pastEventLimit);
  const availableSeatsByEventId = await getAvailableEventSeatsByEventId(createAdminClient(), profileEvents);
  const eventsWithCapacity = profileEvents.map((event: any) => ({
    ...event,
    available_seats: availableSeatsByEventId.get(event.id) ?? null,
  }));

  const profile = first(facilitatorData.profiles);
  const region = first(facilitatorData.regions);
  const name = nameOf(facilitator);
  const imageUrl = facilitatorData.profile_image_path
    ? supabase.storage.from("media").getPublicUrl(facilitatorData.profile_image_path).data.publicUrl
    : null;
  const gallery =
    [...(facilitatorData.facilitator_images ?? [])]
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .filter((image: any) => image.image_path)
      .slice(0, 10)
      .map((image: any) => ({
        ...image,
        url: supabase.storage.from("media").getPublicUrl(image.image_path).data.publicUrl,
      })) ?? [];
  const galleryWithFallback = withFacilitatorMoodImageFallback(gallery, {
    fallbackAltText: `Stemningsbillede for ${name}`,
  });
  const coverImage = resolveFacilitatorHero({
    fallbackAltText: `Stemningsbillede for ${name}`,
    heroKey: facilitatorData.facilitator_hero_key,
    moodImages: gallery.map((image: any) => ({
      altText: image.alt_text,
      imagePath: image.image_path,
      sortOrder: image.sort_order,
      url: image.url,
    })),
    preferCustomWhenUnset: true,
  });
  const categories =
    facilitatorData.facilitator_categories
      ?.map((row: any) => (Array.isArray(row.categories) ? row.categories[0] : row.categories))
      .filter((category: any) => category?.slug && facilitatorWorkAreaSlugSet.has(category.slug)) ?? [];
  const specialty = normalizeSpecialtyText(facilitatorData.specialties);
  const publicEmail = facilitatorData.public_email || profile?.email || null;
  const publicPhone = facilitatorData.public_phone || profile?.phone || null;
  const links = [
    facilitatorData.website_url ? { label: "Hjemmeside", href: ensureUrl(facilitatorData.website_url) } : null,
    facilitatorData.facebook_url ? { label: "Facebook", href: ensureUrl(facilitatorData.facebook_url) } : null,
    facilitatorData.instagram_url ? { label: "Instagram", href: ensureUrl(facilitatorData.instagram_url) } : null,
    facilitatorData.youtube_url ? { label: "YouTube", href: ensureUrl(facilitatorData.youtube_url) } : null,
    facilitatorData.tiktok_url ? { label: "TikTok", href: ensureUrl(facilitatorData.tiktok_url) } : null,
  ].filter((link): link is { label: string; href: string } => Boolean(link));
  const isOwnProfilePreview = viewer?.role === "facilitator" && viewer.id === facilitatorData.profile_id;
  const currentProfilePath = publicFacilitatorPath(facilitatorData.slug || facilitatorData.id);
  const publicReturnLink = safePublicReturnPath(resolvedSearchParams?.return_to, currentProfilePath);
  const backLink =
    adminReturnLink ??
    facilitatorReturnLink ??
    (publicReturnLink ? { href: publicReturnLink, label: publicReturnLabel(publicReturnLink) } : null) ??
    (isOwnProfilePreview ? { href: "/facilitator", label: "Tilbage til dashboard" } : getBackLink(referer, currentProfilePath));
  const badges = organizerBadgesFromFlags({
    isActiveHost: facilitatorData.is_active_host,
    isExperiencedHost: facilitatorData.is_experienced_host,
  });
  const presentationText = facilitatorData.long_description || facilitatorData.short_description || null;
  const showPublicLocation = facilitatorData.show_public_location !== false;
  const publicCity = showPublicLocation ? facilitatorData.city : null;
  const publicRegion = showPublicLocation ? region?.name || facilitatorData.region_text : null;
  const publicCountry = showPublicLocation
    ? profileCountryName(facilitatorData.country, facilitatorData.country_name)
    : "Danmark";
  const publicGalleryImages = galleryWithFallback.isUsingFallback
    ? []
    : galleryWithFallback.images.map((image: any) => ({
        altText: image.alt_text ?? image.altText ?? null,
        imagePath: image.image_path ?? image.imagePath ?? null,
        url: image.url,
      }));
  const canonicalProfileUrl = absoluteUrl(publicFacilitatorPath(facilitatorData.slug || facilitatorData.id));
  const profileJsonLd = buildProfilePageJsonLd({
    canonicalUrl: canonicalProfileUrl,
    categories: categories.map((category: any) => category.name),
    city: publicCity,
    country: facilitatorData.country,
    countryName: facilitatorData.country_name,
    email: publicEmail,
    eventTitles: eventsWithCapacity.map((event: any) => event.title),
    imageUrl: imageUrl || coverImage.url,
    links,
    name,
    phone: publicPhone,
    presentationText,
    region: publicRegion,
    serviceDescription: facilitatorData.offers_services ? facilitatorData.service_description : null,
    specialties: specialty ? [specialty] : [],
  });

  return (
    <>
      {publicFacilitator && !adminReturnLink && !facilitatorReturnLink && !isOwnProfilePreview ? (
        <TrackFacilitatorProfileView facilitatorId={facilitatorData.id} />
      ) : null}
      {publicFacilitator ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(profileJsonLd).replace(/</g, "\\u003c") }}
        />
      ) : null}
      <PublicFacilitatorProfile
        backLink={backLink}
        badges={badges}
        categories={categories.map((category: any) => ({
          colorHex: category.color_hex,
          name: category.name,
        }))}
        contact={{
          city: publicCity,
          country: publicCountry,
          email: publicEmail,
          isOnline: facilitatorData.is_online_facilitator,
          links,
          phone: publicPhone,
          region: publicRegion,
        }}
        coverImage={coverImage}
        eventReturnTo={currentProfilePath}
        events={eventsWithCapacity}
        facilitatorId={facilitatorData.id}
        facilitatorSlug={facilitatorData.slug}
        galleryImages={publicGalleryImages}
        hostReferenceId={facilitatorData.host_reference_id}
        name={name}
        pastEvents={pastEvents}
        presentationText={presentationText}
        profileImageUrl={imageUrl}
        reminderFormAction={subscribeToFacilitatorReminderAction.bind(null, facilitatorData.id)}
        reminderMessage={reminderMessage}
        serviceDescription={facilitatorData.offers_services ? facilitatorData.service_description : null}
        showFallbackNotice={Boolean(adminReturnLink || isOwnProfilePreview)}
        specialty={specialty}
      />
    </>
  );
}
