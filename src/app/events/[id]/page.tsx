import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowLeft, CalendarDays, CircleUserRound, ExternalLink, Mail, MapPinned, Phone, Ticket } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { OrganizerBadges } from "@/components/badges/organizer-badges";
import { CapacityBadge } from "@/components/events/capacity-badge";
import { BookingForm } from "@/components/events/detail/booking-form";
import { ShareEventButton } from "@/components/events/detail/share-event-button";
import { SoulEventsIdTag } from "@/components/facilitator/soulevents-id-tag";
import { getCurrentProfile } from "@/lib/auth/roles";
import { getAvailableEventSeats } from "@/lib/events/capacity";
import { getUserFacingEventStatus, isEventPastEnd } from "@/lib/events/user-facing-status";
import { absoluteUrl, createPageMetadata, publicMediaUrl } from "@/lib/open-graph";
import { buildEventJsonLd, buildEventMetadata } from "@/lib/seo/public-page-metadata";
import { publicEventPath, publicFacilitatorPath } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type EventDetailPageProps = {
  params: Promise<{
    id?: string;
    slug?: string;
  }>;
  searchParams: Promise<{ admin_return?: string; booking?: string; message?: string; return_to?: string }>;
};

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function eventIdentifier(params: { id?: string; slug?: string }) {
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

function safeFacilitatorReturnPath(path: string | undefined) {
  if (!path) return null;
  return path === "/facilitator/events" || path.startsWith("/facilitator/events?") || path.startsWith("/facilitator/events#")
    ? path
    : null;
}

function specialtyMetadataValues(input: string | null | undefined) {
  const specialty = (input ?? "").replace(/\s+/g, " ").trim();
  return specialty ? [specialty] : [];
}

export async function generateMetadata({ params }: EventDetailPageProps): Promise<Metadata> {
  const identifier = eventIdentifier(await params);
  const supabase = await createClient();
  let { data: event } = await supabase
    .from("events")
    .select(
      `
      id,
      slug,
      status,
      title,
      short_description,
      long_description,
      starts_at,
      ends_at,
      city,
      event_format,
      cover_image_path,
      facilitator_profiles!inner(
        status,
        is_paused,
        is_disabled,
        host_reference_id,
        company_name,
        specialties,
        facilitator_categories(categories(name, slug)),
        profiles!facilitator_profiles_profile_id_fkey(full_name)
      ),
      regions(name),
      event_categories(categories(name, color_hex)),
      event_main_categories(main_categories(name, image_path)),
      event_tags(tags(name)),
      event_images(image_path, sort_order)
    `,
    )
    .eq("slug", identifier)
    .maybeSingle();

  if (!event && isUuid(identifier)) {
    const fallbackResult = await supabase
      .from("events")
      .select(
        `
        id,
        slug,
        status,
        title,
        short_description,
        long_description,
        starts_at,
        ends_at,
        city,
        event_format,
        cover_image_path,
        facilitator_profiles!inner(
          status,
          is_paused,
          is_disabled,
          host_reference_id,
          company_name,
          specialties,
          facilitator_categories(categories(name, slug)),
          profiles!facilitator_profiles_profile_id_fkey(full_name)
        ),
        regions(name),
        event_categories(categories(name, color_hex)),
        event_main_categories(main_categories(name, image_path)),
        event_tags(tags(name)),
        event_images(image_path, sort_order)
      `,
      )
      .eq("id", identifier)
      .maybeSingle();
    event = fallbackResult.data;
  }

  const facilitator = first((event as any)?.facilitator_profiles);
  const isPublishedEvent = event ? ["active", "sold_out"].includes(event.status) : false;
  const isExpiredEvent = event ? isEventPastEnd(event) : true;
  const isPublicEvent =
    isPublishedEvent &&
    !isExpiredEvent &&
    facilitator?.status === "approved" &&
    !facilitator?.is_paused &&
    !facilitator?.is_disabled;

  if (!event || !isPublicEvent) {
    return {
      ...createPageMetadata({
        title: "Event | SoulEvents.dk",
        description: "Find nærværende events på SoulEvents.dk.",
        path: publicEventPath(identifier || "event"),
      }),
      robots: { index: false, follow: false },
    };
  }

  const images = [...(((event as any).event_images ?? []) as Array<{ image_path: string | null; sort_order: number | null }>)]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const mainCategories: Array<{ name: string | null; image_path: string | null }> =
    ((event as any).event_main_categories ?? [])
      .map((row: any) => first(row.main_categories))
      .filter((category: any): category is { name: string | null; image_path: string | null } => Boolean(category)) ?? [];
  const categoryCoverPath = mainCategories.find((category) => category.image_path)?.image_path ?? null;
  const eventImagePath = event.cover_image_path || images.find((image) => image.image_path)?.image_path || categoryCoverPath;
  const imageUrl = eventImagePath ? publicMediaUrl(supabase, eventImagePath) : null;
  const facilitatorUser = first(facilitator?.profiles);
  const facilitatorName = facilitator?.company_name || facilitatorUser?.full_name || "SoulEvents";
  const categories = [
    ...(((event as any).event_main_categories ?? [])
      .map((row: any) => first(row.main_categories)?.name)
      .filter(Boolean) as string[]),
    ...(((event as any).event_categories ?? [])
      .map((row: any) => first(row.categories)?.name)
      .filter(Boolean) as string[]),
  ];
  const tags =
    ((event as any).event_tags ?? [])
      .map((row: any) => first(row.tags)?.name)
      .filter(Boolean) ?? [];
  const organizerCategories =
    facilitator?.facilitator_categories
      ?.map((row: any) => first(row.categories))
      .filter((category: any) => category?.slug)
      .map((category: any) => category.name) ?? [];
  const metadata = buildEventMetadata({
    categories,
    city: event.city,
    description: event.long_description,
    eventFormat: event.event_format,
    organizerCategories,
    organizerName: facilitatorName,
    organizerSpecialties: specialtyMetadataValues((facilitator as any)?.specialties),
    startsAt: event.starts_at,
    tags,
    title: event.title,
  });

  return createPageMetadata({
    title: metadata.title,
    description: metadata.description,
    imageTitle: event.title,
    imageSubtitle: "Event af " + facilitatorName,
    imageUrl,
    path: publicEventPath(event.slug),
    type: "article",
  });
}

function formatEventFormat(format?: string | null) {
  if (format === "online") return "💻 Online";
  return "📍 Fysisk";
}

function formatPrice(priceCents: number) {
  if (priceCents === 0) {
    return "Gratis";
  }

  return new Intl.NumberFormat("da-DK").format(priceCents / 100) + " kr.";
}

function formatEventDuration(startsAt: string, endsAt: string | null) {
  if (!endsAt) return null;

  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  const durationMs = end - start;

  if (!Number.isFinite(durationMs) || durationMs <= 0) return null;

  const hours = durationMs / (1000 * 60 * 60);

  if (hours < 24) {
    const roundedHours = Math.round(hours * 10) / 10;
    return new Intl.NumberFormat("da-DK").format(roundedHours) + " timer";
  }

  const days = Math.ceil(hours / 24);
  return days === 1 ? "1 dag" : days + " dage";
}

function ensureUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : "https://" + url;
}

export default async function EventDetailPage({ params, searchParams }: EventDetailPageProps) {
  const [resolvedParams, { admin_return: adminReturn, booking, message, return_to: returnTo }] = await Promise.all([params, searchParams]);
  const identifier = eventIdentifier(resolvedParams);
  const isLegacyRoute = Boolean(resolvedParams.id);
  const messageVariant = booking === "sent" ? "success" : "notice";
  const supabase = await createClient();
  const viewer = await getCurrentProfile();

  let { data: event } = await supabase
    .from("events")
    .select(
      `
      id,
      slug,
      status,
      title,
      short_description,
      long_description,
      starts_at,
      ends_at,
      published_at,
      address_line,
      postal_code,
      city,
      latitude,
      longitude,
      price_cents,
      event_format,
      online_description,
      online_url_or_note,
      practical_information,
      cover_image_path,
      capacity,
      contact_email,
      contact_phone,
      facebook_url,
      instagram_url,
      facilitator_profiles!inner(
        id,
        profile_id,
        slug,
        status,
        is_paused,
        is_disabled,
        host_reference_id,
        company_name,
        profile_image_path,
        short_description,
        specialties,
        website_url,
        facebook_url,
        instagram_url,
        is_active_host,
        is_experienced_host,
        facilitator_categories(categories(name, slug)),
        profiles!facilitator_profiles_profile_id_fkey(full_name)
      ),
      regions(name),
      event_categories(categories(name, color_hex)),
      event_main_categories(main_categories(name, color_hex, image_path)),
      event_tags(tags(name)),
      event_images(image_path, alt_text, sort_order),
      event_co_organizers(
        status,
        facilitator_profiles!event_co_organizers_co_organizer_profile_id_fkey(
            id,
            slug,
            status,
          is_paused,
          is_disabled,
          host_reference_id,
          company_name,
          profile_image_path,
          specialties,
          facilitator_categories(categories(name, color_hex, slug)),
          profiles!facilitator_profiles_profile_id_fkey(full_name)
        )
      )
    `,
    )
    .eq("slug", identifier)
    .maybeSingle();

  if (!event && isUuid(identifier)) {
    const fallbackResult = await supabase
      .from("events")
      .select(
        `
        id,
        slug,
        status,
        title,
        short_description,
        long_description,
        starts_at,
        ends_at,
        published_at,
        address_line,
        postal_code,
        city,
        latitude,
        longitude,
        price_cents,
        event_format,
        online_description,
        online_url_or_note,
        practical_information,
        cover_image_path,
        capacity,
        contact_email,
        contact_phone,
        facebook_url,
        instagram_url,
        facilitator_profiles!inner(
          id,
          profile_id,
          slug,
          status,
          is_paused,
          is_disabled,
          host_reference_id,
          company_name,
          profile_image_path,
          short_description,
          specialties,
          website_url,
          facebook_url,
          instagram_url,
          is_active_host,
          is_experienced_host,
          facilitator_categories(categories(name, slug)),
          profiles!facilitator_profiles_profile_id_fkey(full_name)
        ),
        regions(name),
        event_categories(categories(name, color_hex)),
        event_main_categories(main_categories(name, color_hex, image_path)),
        event_tags(tags(name)),
        event_images(image_path, alt_text, sort_order),
        event_co_organizers(
          status,
          facilitator_profiles!event_co_organizers_co_organizer_profile_id_fkey(
            id,
            slug,
            status,
            is_paused,
            is_disabled,
            host_reference_id,
            company_name,
            profile_image_path,
            specialties,
            facilitator_categories(categories(name, color_hex, slug)),
            profiles!facilitator_profiles_profile_id_fkey(full_name)
          )
        )
      `,
      )
      .eq("id", identifier)
      .maybeSingle();
    event = fallbackResult.data;
  }

  if (!event) {
    notFound();
  }

  if (isLegacyRoute && event.slug) {
    permanentRedirect(withSearch(publicEventPath(event.slug), { admin_return: adminReturn, booking, message, return_to: returnTo }));
  }

  const availableSeats = await getAvailableEventSeats(createAdminClient(), event.id, event.capacity);
  const facilitatorProfile = Array.isArray(event.facilitator_profiles)
    ? event.facilitator_profiles[0]
    : event.facilitator_profiles;
  const isPublishedEvent = ["active", "sold_out"].includes(event.status);
  const isSoldOut = event.status === "sold_out" || availableSeats <= 0;
  const userFacingStatus = getUserFacingEventStatus(event);
  const isExpiredEvent = userFacingStatus === "held";
  const isPreviouslyPublished = Boolean(event.published_at) || ["active", "sold_out", "completed", "cancelled", "archived"].includes(event.status);
  const isHeldEvent = isPreviouslyPublished && userFacingStatus === "held";
  const isPublicEvent = isPublishedEvent && !isExpiredEvent && facilitatorProfile?.status === "approved" && !facilitatorProfile.is_paused && !facilitatorProfile.is_disabled;
  const canPreviewEvent = viewer?.role === "admin" || viewer?.id === facilitatorProfile?.profile_id;
  if (!isPublicEvent && !canPreviewEvent) {
    notFound();
  }

  const facilitatorUser = Array.isArray(facilitatorProfile?.profiles)
    ? facilitatorProfile?.profiles[0]
    : facilitatorProfile?.profiles;
  const region = Array.isArray(event.regions) ? event.regions[0] : event.regions;
  const categories =
    event.event_categories
      ?.map((row) => (Array.isArray(row.categories) ? row.categories[0] : row.categories))
      .filter((category): category is { name: string; color_hex: string } => Boolean(category)) ?? [];
  const mainCategories =
    event.event_main_categories
      ?.map((row) => (Array.isArray(row.main_categories) ? row.main_categories[0] : row.main_categories))
      .filter((category): category is { name: string | null; color_hex: string | null; image_path: string | null } => Boolean(category)) ?? [];
  const tags =
    event.event_tags
      ?.map((row: any) => (Array.isArray(row.tags) ? row.tags[0] : row.tags))
      .filter((tag: any): tag is { name: string } => Boolean(tag?.name)) ?? [];
  const images = [...(event.event_images ?? [])].sort(
    (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order,
  );
  const facilitatorName = facilitatorProfile?.company_name || facilitatorUser?.full_name || "Arrangør";
  const isBookable = isPublicEvent && !isSoldOut && !isHeldEvent;
  const facilitatorReturn = safeFacilitatorReturnPath(returnTo);
  const facilitatorImageUrl = facilitatorProfile?.profile_image_path
    ? supabase.storage.from("media").getPublicUrl(facilitatorProfile.profile_image_path).data.publicUrl
    : null;
  const eventDuration = formatEventDuration(event.starts_at, event.ends_at);
  const firstEventImagePath = images[0]?.image_path ?? null;
  const categoryCoverPath = mainCategories.find((category) => category.image_path)?.image_path ?? null;
  const eventCoverPath = event.cover_image_path || firstEventImagePath || categoryCoverPath;
  const eventCoverUrl = eventCoverPath
    ? supabase.storage.from("media").getPublicUrl(eventCoverPath).data.publicUrl
      : null;
  const eventCoverLabel = mainCategories[0]?.name || categories[0]?.name || "SoulEvents";
  const eventCoverColor = mainCategories[0]?.color_hex || categories[0]?.color_hex || "#D89A94";
  const canonicalEventUrl = absoluteUrl(publicEventPath(event.slug || event.id));
  const eventDescription = event.long_description?.trim() ?? "";

  const facilitatorLinks = [
    facilitatorProfile?.website_url ? { label: "Hjemmeside", href: ensureUrl(facilitatorProfile.website_url) } : null,
    facilitatorProfile?.facebook_url ? { label: "Facebook", href: ensureUrl(facilitatorProfile.facebook_url) } : null,
    facilitatorProfile?.instagram_url ? { label: "Instagram", href: ensureUrl(facilitatorProfile.instagram_url) } : null,
  ].filter((link): link is { label: string; href: string } => Boolean(link));
  const coOrganizers =
    event.event_co_organizers
      ?.filter((row: any) => row.status === "accepted")
      .map((row: any) => (Array.isArray(row.facilitator_profiles) ? row.facilitator_profiles[0] : row.facilitator_profiles))
      .filter(
        (coOrganizer: any) =>
          coOrganizer &&
          coOrganizer.status === "approved" &&
          !coOrganizer.is_paused &&
          !coOrganizer.is_disabled,
      ) ?? [];
  const eventJsonLd = buildEventJsonLd({
    canonicalUrl: canonicalEventUrl,
    categories: [...mainCategories.map((category) => category.name), ...categories.map((category) => category.name)],
    city: event.city || region?.name,
    coOrganizers: coOrganizers.map((coOrganizer: any) => {
      const coOrganizerUser = first(coOrganizer.profiles);
      return {
        name: coOrganizer.company_name || coOrganizerUser?.full_name || "Medarrangør",
        url: absoluteUrl(publicFacilitatorPath(coOrganizer.slug || coOrganizer.id)),
      };
    }),
    description: event.long_description,
    endDate: event.ends_at,
    eventFormat: event.event_format,
    imageUrl: eventCoverUrl,
    isSoldOut,
    location: {
      addressLine: event.address_line,
      city: event.city,
      name: [event.address_line, event.city].filter(Boolean).join(", ") || event.city || region?.name,
      postalCode: event.postal_code,
      region: region?.name,
    },
    organizerCategories:
      facilitatorProfile?.facilitator_categories
        ?.map((row: any) => first(row.categories))
        .filter((category: any) => category?.name)
        .map((category: any) => category.name) ?? [],
    organizerName: facilitatorName,
    organizerSpecialties: specialtyMetadataValues((facilitatorProfile as any)?.specialties),
    organizerUrl: absoluteUrl(publicFacilitatorPath(facilitatorProfile.slug || facilitatorProfile.id)),
    priceCents: event.price_cents,
    startsAt: event.starts_at,
    status: event.status,
    tags: tags.map((tag) => tag.name),
    title: event.title,
  });

  return (
    <main className="min-h-screen bg-cream">
      {isPublicEvent ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd).replace(/</g, "\\u003c") }}
        />
      ) : null}
      <header className="bg-white shadow-soft">
        <div className="mx-auto max-w-[1400px] px-5 py-5 sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 pt-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-sage-700 sm:text-sm">Event af {facilitatorName}</p>
              <h1 className="mt-2 max-w-4xl break-words text-3xl font-medium leading-tight text-olive sm:text-4xl">{event.title}</h1>
            </div>
            <nav className="flex shrink-0 flex-wrap gap-2 sm:justify-end" aria-label="Tilbage-navigation">
              {viewer?.role === "admin" && adminReturn ? (
                <Link
                  className="inline-flex h-11 items-center gap-2 rounded-button border border-olive/15 bg-white px-4 text-sm font-semibold text-olive transition hover:border-rose hover:text-rose"
                  href={adminReturn}
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Tilbage til admin
                </Link>
              ) : null}
              {facilitatorReturn ? (
                <Link
                  className="inline-flex h-11 items-center gap-2 rounded-button border border-olive/15 bg-white px-4 text-sm font-semibold text-olive transition hover:border-rose hover:text-rose"
                  href={facilitatorReturn}
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Tilbage til mine events
                </Link>
              ) : null}
              {!facilitatorReturn ? (
                <Link
                  className="inline-flex h-11 items-center gap-2 rounded-button border border-olive/15 bg-white px-4 text-sm font-semibold text-olive transition hover:border-rose hover:text-rose"
                  href="/"
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Tilbage til forsiden
                </Link>
              ) : null}
            </nav>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1400px] gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_400px]">
        <div className="grid gap-6">
          {!isPublicEvent && !isHeldEvent && (
            <section className="rounded-card border border-[#E5D4F7] bg-[#F7F2FB] p-5 shadow-soft">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Forhåndsvisning</p>
              <h2 className="mt-1 text-2xl font-semibold text-midnight">Dette event er endnu ikke offentligt</h2>
              <p className="mt-2 text-sm leading-6 text-ink/70">
                Du ser eventet som {viewer?.role === "admin" ? "administrator" : "arrangør"}. Deltagere kan først se og tilmelde sig eventet, når det er godkendt og publiceret.
              </p>
            </section>
          )}
          {isHeldEvent ? (
            <section className="rounded-card border border-[#E8DEC9] bg-[#FBF5E8] p-5 shadow-soft">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#756758]">Afholdt event</p>
              <h2 className="mt-1 text-2xl font-semibold text-midnight">Eventet er afholdt</h2>
              <p className="mt-2 text-sm leading-6 text-ink/70">
                Dette event blev afholdt den{" "}
                {new Intl.DateTimeFormat("da-DK", { dateStyle: "long" }).format(new Date(event.starts_at))}.
              </p>
            </section>
          ) : null}

          <section className="overflow-hidden rounded-card bg-white shadow-soft">
            <div
              className="relative aspect-[16/8] overflow-hidden bg-sage-50 sm:aspect-[16/7]"
              style={
                eventCoverUrl
                  ? undefined
                  : {
                      background:
                        "radial-gradient(circle at 18% 20%, rgba(255,255,255,0.9), transparent 34%), linear-gradient(135deg, " +
                        eventCoverColor +
                        "33, #FAF6EF 56%, #EDE4F7)",
                    }
              }
            >
              {eventCoverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className="h-full w-full object-cover" src={eventCoverUrl} />
              ) : (
                <div className="flex h-full items-center justify-center px-8 text-center">
                  <div>
                    <BrandLogo className="mx-auto h-24 w-24 opacity-80 sm:h-36 sm:w-36" />
                    <p className="mt-4 font-serif text-3xl font-medium text-olive sm:text-5xl">{eventCoverLabel}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="p-8 sm:p-10">
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold text-white"
                    key={category.name}
                    style={{ backgroundColor: category.color_hex }}
                  >
                    {category.name}
                  </span>
                ))}
              </div>
              <h2 className="mt-5 text-5xl font-medium leading-tight text-olive sm:text-6xl">{event.title}</h2>
              {eventDescription ? (
                <div className="mt-6 max-w-3xl whitespace-pre-line text-base leading-8 text-ink/72">{eventDescription}</div>
              ) : null}
            </div>
          </section>

          {images.length > 0 && (
            <section className="rounded-card bg-white p-8 shadow-soft">
              <h2 className="text-4xl font-medium text-olive">Billeder</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {images.map((image: { image_path: string; alt_text: string | null }) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={image.alt_text || "Eventbillede"}
                    className="aspect-[4/3] w-full rounded-[18px] object-cover shadow-soft"
                    key={image.image_path}
                    src={supabase.storage.from("media").getPublicUrl(image.image_path).data.publicUrl}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="rounded-card bg-white p-8 shadow-soft">
            <h2 className="text-4xl font-medium text-olive">Arrangør</h2>
            <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
              {facilitatorImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={`Profilbillede for ${facilitatorName}`}
                  className="aspect-square size-28 shrink-0 rounded-[22px] object-cover shadow-soft"
                  src={facilitatorImageUrl}
                />
              ) : (
                <div className="grid aspect-square size-28 shrink-0 place-items-center rounded-[22px] bg-sage-50 text-sage-700">
                  <CircleUserRound className="size-10" aria-hidden="true" />
                </div>
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link className="font-semibold text-sage-700 transition hover:text-rose" href={publicFacilitatorPath(facilitatorProfile.slug || facilitatorProfile.id)}>{facilitatorName}</Link>
                  <OrganizerBadges badges={[facilitatorProfile?.is_experienced_host ? "experienced" : null, facilitatorProfile?.is_active_host ? "active" : null].filter(Boolean) as never} />
                </div>
                <SoulEventsIdTag className="mt-2" hostReferenceId={facilitatorProfile?.host_reference_id} />
                <p className="mt-2 text-sm leading-6 text-ink/66">
                  {facilitatorProfile?.short_description || "Arrangørens profiltekst kommer snart."}
                </p>
                {facilitatorLinks.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {facilitatorLinks.map((link) => (
                      <a
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-sage-700/20 bg-white px-3 text-sm font-semibold text-sage-700 transition hover:border-sage-700 hover:bg-sage-50"
                        href={link.href}
                        key={link.label}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <ExternalLink className="size-4" aria-hidden="true" />
                        {link.label}
                      </a>
                    ))}
                  </div>
                )}
                <Link
                  className="mt-4 inline-flex h-11 items-center justify-center rounded-button bg-olive px-5 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-sage-700 hover:shadow-lift"
                  href={publicFacilitatorPath(facilitatorProfile.slug || facilitatorProfile.id)}
                >
                  Se arrangørens profil
                </Link>
              </div>
            </div>
          </section>

          {coOrganizers.length > 0 ? (
            <section className="rounded-card bg-white p-8 shadow-soft">
              <h2 className="text-4xl font-medium text-olive">Medarrangører</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {coOrganizers.map((coOrganizer: any) => {
                  const coOrganizerUser = Array.isArray(coOrganizer.profiles) ? coOrganizer.profiles[0] : coOrganizer.profiles;
                  const coOrganizerName = coOrganizer.company_name || coOrganizerUser?.full_name || "Arrangør";
                  const coOrganizerImageUrl = coOrganizer.profile_image_path
                    ? supabase.storage.from("media").getPublicUrl(coOrganizer.profile_image_path).data.publicUrl
                    : null;
                  const coOrganizerCategories =
                    coOrganizer.facilitator_categories
                      ?.map((row: any) => (Array.isArray(row.categories) ? row.categories[0] : row.categories))
                      .filter((category: any) => Boolean(category?.name))
                      .slice(0, 3) ?? [];

                  return (
                    <Link
                      className="flex gap-4 rounded-[20px] border border-[#E5D4F7] bg-[#FAF8FC] p-4 transition hover:border-[#7A5D91]"
                      href={publicFacilitatorPath(coOrganizer.slug || coOrganizer.id)}
                      key={coOrganizer.id}
                    >
                      {coOrganizerImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt="" className="size-16 rounded-[18px] object-cover" src={coOrganizerImageUrl} />
                      ) : (
                        <span className="grid size-16 place-items-center rounded-[18px] bg-[#F4F0F7] text-lg font-semibold text-[#7A5D91]">
                          {coOrganizerName.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block font-semibold text-midnight">{coOrganizerName}</span>
                        <SoulEventsIdTag className="mt-2" hostReferenceId={coOrganizer.host_reference_id} />
                        {coOrganizerCategories.length > 0 ? (
                          <span className="mt-2 flex flex-wrap gap-1.5">
                            {coOrganizerCategories.map((category: any) => (
                              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-ink/64" key={category.name}>
                                {category.name}
                              </span>
                            ))}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="grid content-start gap-5 lg:sticky lg:top-6">
          <section className="rounded-card bg-white p-6 shadow-soft" id="event-betingelser">
            <h2 className="text-4xl font-medium text-olive">Praktisk</h2>
            <div className="mt-4 grid gap-3 text-sm text-ink/72">
              <div className="inline-flex w-fit rounded-full border border-olive/10 bg-white px-2.5 py-1 text-xs font-medium text-ink/55">
                {formatEventFormat(event.event_format)}
              </div>
              <div className="rounded-md border border-sage-700/15 bg-sage-50/70 p-4">
                <div className="flex gap-3">
                  <CalendarDays className="mt-1 size-5 text-sage-700" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-sage-700">Start</p>
                    <p className="mt-1 text-lg font-semibold leading-snug text-midnight">
                      {new Intl.DateTimeFormat("da-DK", { dateStyle: "full", timeStyle: "short" }).format(
                        new Date(event.starts_at),
                      )}
                    </p>
                    {event.ends_at && (
                      <p className="mt-2 text-sm text-ink/70">
                        Slutter:{" "}
                        {new Intl.DateTimeFormat("da-DK", { dateStyle: "full", timeStyle: "short" }).format(
                          new Date(event.ends_at),
                        )}
                      </p>
                    )}
                    {eventDuration && <p className="mt-1 text-sm font-semibold text-sage-700">Varighed: {eventDuration}</p>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <MapPinned className="mt-0.5 size-4 text-sage-700" aria-hidden="true" />
                <span>
                  {[event.address_line, event.postal_code, event.city, region?.name].filter(Boolean).join(", ") ||
                    "Lokation kommer snart"}
                </span>
              </div>
              <div className="flex gap-2">
                <Ticket className="mt-0.5 size-4 text-midnight" aria-hidden="true" />
                <span>{formatPrice(event.price_cents)}</span>
              </div>
              <CapacityBadge availableSeats={availableSeats} capacity={event.capacity} status={event.status} />
              {event.practical_information && (
                <div className="rounded-md bg-sage-50 p-3">
                  <p className="font-semibold text-olive">Praktisk information til deltagere</p>
                  <p className="mt-1">{event.practical_information}</p>
                </div>
              )}
              {event.event_format === "online" && (
                <div className="rounded-md bg-sage-50 p-3">
                  <p className="font-semibold text-olive">Online-info</p>
                  <p className="mt-1">{event.online_description || event.online_url_or_note || "Link sendes efter tilmelding."}</p>
                </div>
              )}
              {event.contact_email && (
                <div className="flex gap-2">
                  <Mail className="mt-0.5 size-4 text-midnight" aria-hidden="true" />
                  <span>{event.contact_email}</span>
                </div>
              )}
              {event.contact_phone && (
                <div className="flex gap-2">
                  <Phone className="mt-0.5 size-4 text-midnight" aria-hidden="true" />
                  <span>{event.contact_phone}</span>
                </div>
              )}
            </div>
          </section>

          <ShareEventButton
            eventId={event.id}
            eventSlug={event.slug}
            eventTitle={event.title}
            facilitatorName={facilitatorName}
            startsAt={event.starts_at}
          />

          {isHeldEvent ? (
            <section className="rounded-card border border-[#E8DEC9] bg-[#FBF5E8] p-6 shadow-soft">
              <h2 className="text-3xl font-medium text-olive">Eventet er afholdt</h2>
              <p className="mt-3 text-sm leading-6 text-ink/70">Tilmelding er lukket, fordi eventet allerede er afholdt.</p>
            </section>
          ) : isSoldOut ? (
            <section className="rounded-card border border-[#E5D4F7] bg-[#F7F2FB] p-6 shadow-soft">
              <h2 className="text-3xl font-medium text-olive">Udsolgt</h2>
            </section>
          ) : isBookable ? (
            <BookingForm
              availableSeats={availableSeats}
              bookingSent={booking === "sent"}
              capacity={event.capacity}
              eventId={event.id}
              eventStartsAt={event.starts_at}
              eventTitle={event.title}
              facilitatorProfileHref={publicFacilitatorPath(facilitatorProfile.slug || facilitatorProfile.id)}
              message={message}
              messageVariant={messageVariant}
            />
          ) : (
            <section className="rounded-card border border-[#E5D4F7] bg-[#F7F2FB] p-6 shadow-soft">
              <h2 className="text-3xl font-medium text-olive">Tilmelding er ikke åben</h2>
              <p className="mt-3 text-sm leading-6 text-ink/70">
                Dette event er en forhåndsvisning. Tilmelding åbner først, når eventet er aktivt og arrangøren er godkendt.
              </p>
            </section>
          )}

          <p className="rounded-card border border-lavender/50 bg-white/70 px-4 py-3 text-xs font-semibold text-ink/45 shadow-soft">
            Event-ID: {event.id}
          </p>
        </aside>
      </section>
    </main>
  );
}
