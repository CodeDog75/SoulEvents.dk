import type { Metadata } from "next";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { organizerBadgesFromFlags } from "@/components/badges/organizer-badges";
import { PublicFacilitatorProfile } from "@/components/facilitator/public-facilitator-profile";
import { subscribeToFacilitatorReminderAction } from "./actions";
import { getCurrentProfile } from "@/lib/auth/roles";
import { getAvailableEventSeatsByEventId } from "@/lib/events/capacity";
import { resolveFacilitatorHero } from "@/lib/facilitators/hero-collection";
import { withFacilitatorMoodImageFallback } from "@/lib/facilitators/mood-image-fallback";
import { facilitatorWorkAreaSlugSet } from "@/lib/facilitators/work-areas";
import { createPageMetadata, publicMediaUrl, stripHtml } from "@/lib/open-graph";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type FacilitatorPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ admin_return?: string; facilitator_return?: string; reminder_message?: string }>;
};

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function ensureUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : "https://" + url;
}

function splitSpecialties(input: string | null | undefined) {
  return (input ?? "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function nameOf(facilitator: any) {
  const profile = first(facilitator?.profiles);
  return facilitator?.company_name || profile?.full_name || "Arrangør";
}

function getBackLink(referer: string | null, currentId: string) {
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

    if (url.pathname === "/facilitators/" + currentId) {
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
  "company_name, facilitator_hero_key, profile_image_path, short_description, long_description, profiles!facilitator_profiles_profile_id_fkey(full_name), facilitator_images(image_path, sort_order)";
const facilitatorMetadataSelectLegacy =
  "company_name, profile_image_path, short_description, long_description, profiles!facilitator_profiles_profile_id_fkey(full_name), facilitator_images(image_path, sort_order)";
const facilitatorSelectWithHero =
  "id, profile_id, company_name, facilitator_hero_key, profile_image_path, short_description, specialties, long_description, website_url, public_email, public_phone, facebook_url, instagram_url, youtube_url, tiktok_url, address_line, postal_code, city, country, is_online_facilitator, is_active_host, is_experienced_host, offers_services, service_description, profiles!facilitator_profiles_profile_id_fkey(full_name, email, phone), regions(name), facilitator_categories(categories(name, slug, color_hex)), facilitator_images(image_path, alt_text, sort_order)";
const facilitatorSelectLegacy =
  "id, profile_id, company_name, profile_image_path, short_description, specialties, long_description, website_url, public_email, public_phone, facebook_url, instagram_url, youtube_url, tiktok_url, address_line, postal_code, city, country, is_online_facilitator, is_active_host, is_experienced_host, offers_services, service_description, profiles!facilitator_profiles_profile_id_fkey(full_name, email, phone), regions(name), facilitator_categories(categories(name, slug, color_hex)), facilitator_images(image_path, alt_text, sort_order)";

export async function generateMetadata({ params }: FacilitatorPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  let { data: facilitator, error: facilitatorError } = await supabase
    .from("facilitator_profiles")
    .select(facilitatorMetadataSelectWithHero)
    .eq("id", id)
    .eq("status", "approved")
    .eq("is_paused", false)
    .eq("is_disabled", false)
    .single();

  if (isMissingHeroKeyColumn(facilitatorError)) {
    const legacyResult = await supabase
      .from("facilitator_profiles")
      .select(facilitatorMetadataSelectLegacy)
      .eq("id", id)
      .eq("status", "approved")
      .eq("is_paused", false)
      .eq("is_disabled", false)
      .single();
    facilitator = legacyResult.data as typeof facilitator;
    facilitatorError = legacyResult.error;
  }

  if (!facilitator) {
    return createPageMetadata({
      title: "Arrangør | SoulEvents.dk",
      description: "Find arrangører på SoulEvents.dk.",
      path: "/facilitators/" + id,
    });
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
  const description = stripHtml(facilitator.short_description || facilitator.long_description) || "Find arrangørprofil på SoulEvents.dk.";

  return createPageMetadata({
    title: name + " | Arrangør på SoulEvents.dk",
    description,
    imageTitle: name,
    imageSubtitle: "Arrangør på SoulEvents.dk",
    imageUrl,
    path: "/facilitators/" + id,
    type: "article",
  });
}

export default async function PublicFacilitatorPage({ params, searchParams }: FacilitatorPageProps) {
  const { id } = await params;
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
    .eq("id", id)
    .eq("status", "approved")
    .eq("is_paused", false)
    .eq("is_disabled", false)
    .single();

  if (isMissingHeroKeyColumn(publicFacilitatorError)) {
    const legacyResult = await supabase
      .from("facilitator_profiles")
      .select(facilitatorSelectLegacy)
      .eq("id", id)
      .eq("status", "approved")
      .eq("is_paused", false)
      .eq("is_disabled", false)
      .single();
    publicFacilitator = legacyResult.data as typeof publicFacilitator;
    publicFacilitatorError = legacyResult.error;
  }

  if (publicFacilitatorError && publicFacilitatorError.code !== "PGRST116") {
    console.error("[facilitator-profile] public lookup failed", {
      code: publicFacilitatorError.code,
      id,
      message: publicFacilitatorError.message,
    });
  }

  let { data: previewFacilitator, error: previewFacilitatorError } =
    !publicFacilitator && ((adminReturnLink && viewer?.role === "admin") || (facilitatorReturnLink && viewer?.role === "facilitator"))
      ? await createAdminClient().from("facilitator_profiles").select(facilitatorSelectWithHero).eq("id", id).single()
      : { data: null, error: null };

  if (isMissingHeroKeyColumn(previewFacilitatorError)) {
    const legacyResult = await createAdminClient().from("facilitator_profiles").select(facilitatorSelectLegacy).eq("id", id).single();
    previewFacilitator = legacyResult.data as typeof previewFacilitator;
    previewFacilitatorError = legacyResult.error;
  }
  if (previewFacilitatorError) {
    console.error("[facilitator-profile] preview lookup failed", {
      code: previewFacilitatorError.code,
      id,
      message: previewFacilitatorError.message,
    });
  }
  const facilitator = publicFacilitator ?? previewFacilitator;

  const facilitatorData = facilitator as any;

  if (!facilitatorData) {
    notFound();
  }

  if (facilitatorReturnLink && (viewer?.role !== "facilitator" || viewer.id !== facilitatorData.profile_id)) {
    notFound();
  }

  await createAdminClient()
    .from("facilitator_profile_views")
    .insert({ facilitator_id: id });

  const { data: events } = await supabase
    .from("events")
    .select(
      "id, status, title, short_description, starts_at, ends_at, city, price_cents, capacity, event_format, cover_image_path, facilitator_profiles!inner(status, company_name, profiles!facilitator_profiles_profile_id_fkey(full_name)), regions(name), event_categories(categories(name, color_hex)), event_main_categories(main_categories(name, color_hex, image_path))",
    )
    .eq("facilitator_id", id)
    .in("status", ["active", "sold_out"])
    .eq("facilitator_profiles.status", "approved")
    .eq("facilitator_profiles.is_paused", false)
    .eq("facilitator_profiles.is_disabled", false)
    .gte("ends_at", new Date().toISOString())
    .order("starts_at", { ascending: true });
  const availableSeatsByEventId = await getAvailableEventSeatsByEventId(createAdminClient(), events ?? []);
  const eventsWithCapacity = (events ?? []).map((event: any) => ({
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
  const specialties = splitSpecialties(facilitatorData.specialties);
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
  const backLink = adminReturnLink ?? facilitatorReturnLink ?? (isOwnProfilePreview ? { href: "/facilitator", label: "Tilbage til dashboard" } : getBackLink(referer, id));
  const badges = organizerBadgesFromFlags({
    isActiveHost: facilitatorData.is_active_host,
    isExperiencedHost: facilitatorData.is_experienced_host,
  });
  const presentationText = facilitatorData.long_description || facilitatorData.short_description || null;
  const publicGalleryImages = galleryWithFallback.isUsingFallback
    ? []
    : galleryWithFallback.images.map((image: any) => ({
        altText: image.alt_text ?? image.altText ?? null,
        imagePath: image.image_path ?? image.imagePath ?? null,
        url: image.url,
      }));

  return (
    <PublicFacilitatorProfile
      backLink={backLink}
      badges={badges}
      categories={categories.map((category: any) => ({
        colorHex: category.color_hex,
        name: category.name,
      }))}
      contact={{
        city: facilitatorData.city,
        country: facilitatorData.country,
        email: publicEmail,
        isOnline: facilitatorData.is_online_facilitator,
        links,
        phone: publicPhone,
        region: region?.name,
      }}
      coverImage={coverImage}
      events={eventsWithCapacity}
      facilitatorId={facilitatorData.id}
      galleryImages={publicGalleryImages}
      name={name}
      presentationText={presentationText}
      profileImageUrl={imageUrl}
      reminderFormAction={subscribeToFacilitatorReminderAction.bind(null, facilitatorData.id)}
      reminderMessage={reminderMessage}
      serviceDescription={facilitatorData.offers_services ? facilitatorData.service_description : null}
      showFallbackNotice={Boolean(adminReturnLink || isOwnProfilePreview)}
      specialties={specialties}
    />
  );
}
