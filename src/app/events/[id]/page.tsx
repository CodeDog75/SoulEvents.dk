import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock3, Leaf, Mail, MapPinned, Phone, Ticket } from "lucide-react";
import { TrackEventView } from "@/components/analytics/track-event-view";
import { BrandLogo } from "@/components/brand-logo";
import { CapacityBadge } from "@/components/events/capacity-badge";
import { BookingForm } from "@/components/events/detail/booking-form";
import { ShareEventButton } from "@/components/events/detail/share-event-button";
import { getCurrentProfile } from "@/lib/auth/roles";
import { getAvailableEventSeats } from "@/lib/events/capacity";
import { getUserFacingEventStatus, isEventPastEnd } from "@/lib/events/user-facing-status";
import { absoluteUrl, createPageMetadata, publicMediaUrl } from "@/lib/open-graph";
import { buildPaymentMethods, paymentSettingsToInstructionsRecord, resolvePaymentRecord } from "@/lib/payment-instructions";
import { buildEventJsonLd, buildEventMetadata } from "@/lib/seo/public-page-metadata";
import { publicReturnLabel, safePublicReturnPath, withReturnTo } from "@/lib/return-to";
import { publicEventPath, publicFacilitatorPath } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type EventDetailPageProps = {
  params: Promise<{
    id?: string;
    slug?: string;
  }>;
  searchParams: Promise<{
    admin_return?: string;
    booking?: string;
    message?: string;
    return_to?: string;
    [key: string]: string | string[] | undefined;
  }>;
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

function withSearch(path: string, searchParams: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item) params.append(key, item);
      }
    } else if (value) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? path + "?" + query : path;
}

function safeFacilitatorReturnPath(path: string | undefined) {
  if (!path) return null;
  if (path === "/facilitator" || path.startsWith("/facilitator?") || path.startsWith("/facilitator#")) return path;
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
      facilitator_id,
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

  let fallbackEventId = isUuid(identifier) ? identifier : null;

  if (!event && !fallbackEventId) {
    const { data: historicalSlug } = await supabase
      .from("event_slug_history")
      .select("event_id")
      .eq("slug", identifier)
      .maybeSingle();

    fallbackEventId = historicalSlug?.event_id ?? null;
  }

  if (!event && fallbackEventId) {
    const fallbackResult = await supabase
      .from("events")
      .select(
        `
        id,
        slug,
        status,
        facilitator_id,
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
      .eq("id", fallbackEventId)
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

function formatDanishDate(value: string) {
  const parts = new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Copenhagen",
    weekday: "long",
    year: "numeric",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";

  return `${part("weekday")} ${part("day")}. ${part("month")} ${part("year")}`.trim();
}

function formatDanishTime(value: string) {
  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Copenhagen",
  })
    .format(new Date(value))
    .replace(":", ".");
}

function isSameDanishDate(start: string, end: string) {
  return formatDanishDate(start) === formatDanishDate(end);
}

function formatEventDuration(startsAt: string, endsAt: string | null) {
  if (!endsAt) return null;

  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  const durationMs = end - start;

  if (!Number.isFinite(durationMs) || durationMs <= 0) return null;

  const minutes = Math.round(durationMs / (1000 * 60));

  if (minutes < 60) {
    return minutes === 1 ? "1 minut" : `${minutes} minutter`;
  }

  const hours = minutes / 60;

  if (minutes < 24 * 60) {
    const roundedHours = Math.round(hours * 10) / 10;
    return roundedHours === 1
      ? "1 time"
      : new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 }).format(roundedHours) + " timer";
  }

  const days = Math.round(hours / 24);

  if (minutes % (24 * 60) === 0 && days <= 2) {
    return days === 1 ? "1 døgn" : `${days} døgn`;
  }

  const roundedDays = Math.ceil(hours / 24);
  return roundedDays === 1 ? "1 dag" : `${roundedDays} dage`;
}

function formatContactPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 8) {
    return digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  }

  return phone;
}

type EventOrganizerCardProps = {
  href: string;
  imageUrl?: string | null;
  name: string;
  role: "primary" | "coOrganizer";
};

function EventOrganizerCard({ href, imageUrl, name, role }: EventOrganizerCardProps) {
  return (
    <Link
      className="group flex h-full min-w-0 flex-col overflow-hidden rounded-[24px] border border-[#E5D4F7] bg-white shadow-soft transition hover:-translate-y-0.5 hover:border-[#7A5D91] hover:shadow-lift"
      href={href}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={`Profilbillede for ${name}`} className="aspect-[4/3] w-full object-cover" src={imageUrl} />
      ) : (
        <span className="grid aspect-[4/3] w-full place-items-center bg-[#F4F0F7] text-5xl font-semibold text-[#7A5D91]">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col p-5">
        <span className="w-fit rounded-full bg-[#F4F0F7] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#7A5D91]">
          {role === "primary" ? "Arrangør" : "Medarrangør"}
        </span>
        <span className="mt-3 min-w-0 break-words font-serif text-3xl font-semibold leading-tight text-midnight transition group-hover:text-[#7A4EAB]">{name}</span>
        <span className="mt-auto pt-6">
          <span className="inline-flex h-11 w-full items-center justify-center rounded-button bg-olive px-5 text-sm font-semibold text-white shadow-soft transition group-hover:bg-sage-700">
            Se profil
          </span>
        </span>
      </span>
    </Link>
  );
}

export default async function EventDetailPage({ params, searchParams }: EventDetailPageProps) {
  const [resolvedParams, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const { admin_return: adminReturn, booking, message, return_to: returnTo } = resolvedSearchParams;
  const identifier = eventIdentifier(resolvedParams);
  const isLegacyRoute = Boolean(resolvedParams.id);
  const messageVariant = booking === "sent" ? "success" : "notice";
  const supabase = await createClient();
  const viewer = await getCurrentProfile();
  let resolvedFromHistoricalSlug = false;

  let { data: event } = await supabase
    .from("events")
    .select(
      `
      id,
      slug,
      status,
      facilitator_id,
      title,
      short_description,
      long_description,
      starts_at,
      ends_at,
      published_at,
      updated_at,
      address_line,
      postal_code,
      city,
      latitude,
      longitude,
      price_cents,
      registration_mode,
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
        city,
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
          city,
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

  let fallbackEventId = isUuid(identifier) ? identifier : null;

  if (!event && !fallbackEventId) {
    const { data: historicalSlug } = await supabase
      .from("event_slug_history")
      .select("event_id")
      .eq("slug", identifier)
      .maybeSingle();

    fallbackEventId = historicalSlug?.event_id ?? null;
    resolvedFromHistoricalSlug = Boolean(fallbackEventId);
  }

  if (!event && fallbackEventId) {
    const fallbackResult = await supabase
      .from("events")
      .select(
        `
        id,
        slug,
        status,
        facilitator_id,
        title,
        short_description,
        long_description,
        starts_at,
        ends_at,
        published_at,
        updated_at,
        address_line,
        postal_code,
        city,
        latitude,
        longitude,
        price_cents,
        registration_mode,
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
          city,
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
            city,
            profile_image_path,
            specialties,
            facilitator_categories(categories(name, color_hex, slug)),
            profiles!facilitator_profiles_profile_id_fkey(full_name)
          )
        )
      `,
      )
      .eq("id", fallbackEventId)
      .maybeSingle();
    event = fallbackResult.data;
  }

  if (!event) {
    if (viewer?.role === "facilitator") {
      redirect("/facilitator?message=" + encodeURIComponent("Eventet findes ikke længere eller er blevet fjernet."));
    }

    notFound();
  }

  if ((isLegacyRoute || resolvedFromHistoricalSlug) && event.slug && event.slug !== identifier) {
    permanentRedirect(withSearch(publicEventPath(event.slug), resolvedSearchParams));
  }

  const adminSupabase = createAdminClient();
  const availableSeats = await getAvailableEventSeats(adminSupabase, event.id, event.capacity);
  const facilitatorProfile = Array.isArray(event.facilitator_profiles)
    ? event.facilitator_profiles[0]
    : event.facilitator_profiles;
  const registrationMode = event.price_cents > 0 && event.registration_mode === "direct" ? "direct" : "approval_required";
  let externalRegistrationUrl: string | null = null;
  let paymentPreview = null;

  if (registrationMode === "direct" && event.price_cents > 0) {
    const [{ data: eventPaymentSettings }, { data: facilitatorPaymentSettings }] = await Promise.all([
      adminSupabase
        .from("event_payment_settings")
        .select("*")
        .eq("event_id", event.id)
        .eq("facilitator_id", event.facilitator_id)
        .maybeSingle(),
      adminSupabase
        .from("facilitator_payment_settings")
        .select("*")
        .eq("facilitator_id", event.facilitator_id)
        .maybeSingle(),
    ]);
    const paymentLinkMode =
      eventPaymentSettings?.method_source === "custom" && eventPaymentSettings?.payment_link_mode === "external_registration"
        ? "external_registration"
        : "payment_only";
    const { record, source } = resolvePaymentRecord({
      event: {
        ...paymentSettingsToInstructionsRecord(eventPaymentSettings),
        payment_method_source: eventPaymentSettings?.method_source ?? "facilitator",
      },
      facilitator: paymentSettingsToInstructionsRecord(facilitatorPaymentSettings),
    });
    const methods = source === "none" ? [] : buildPaymentMethods(record);
    externalRegistrationUrl =
      source === "custom" && paymentLinkMode === "external_registration"
        ? methods.find((method) => method.type === "external_link")?.url ?? null
        : null;

    paymentPreview =
      !externalRegistrationUrl && (methods.length > 0 || record.payment_instructions)
        ? {
            deadlineDays: record.payment_deadline_days ?? null,
            methods,
            note: record.payment_instructions ?? null,
          }
        : null;
  }
  const { data: facilitatorUpcomingEvents } = await supabase
    .from("events")
    .select(
      `
      id,
      slug,
      title,
      starts_at,
      city,
      event_format,
      cover_image_path,
      event_main_categories(main_categories(name, color_hex, image_path))
    `,
    )
    .eq("facilitator_id", event.facilitator_id)
    .in("status", ["active", "sold_out"])
    .gt("starts_at", new Date().toISOString())
    .neq("id", event.id)
    .order("starts_at", { ascending: true })
    .limit(4);
  const isPublishedEvent = ["active", "sold_out"].includes(event.status);
  const isSoldOut = event.status === "sold_out" || availableSeats <= 0;
  const userFacingStatus = getUserFacingEventStatus(event);
  const isCancelledEvent = event.status === "cancelled";
  const isExpiredEvent = userFacingStatus === "held";
  const isPreviouslyPublished = Boolean(event.published_at) || ["active", "sold_out", "completed", "cancelled", "archived"].includes(event.status);
  const isHeldEvent = isPreviouslyPublished && userFacingStatus === "held";
  const isPublicEvent = isPublishedEvent && !isExpiredEvent && facilitatorProfile?.status === "approved" && !facilitatorProfile.is_paused && !facilitatorProfile.is_disabled;
  const canPreviewEvent = viewer?.role === "admin" || viewer?.id === facilitatorProfile?.profile_id;
  if (!isPublicEvent && !canPreviewEvent) {
    if (viewer?.role === "facilitator") {
      redirect("/facilitator?message=" + encodeURIComponent("Eventet findes ikke længere eller er blevet fjernet."));
    }

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
  const facilitatorReturn = safeFacilitatorReturnPath(returnTo) ?? (viewer?.id === facilitatorProfile?.profile_id ? "/facilitator" : null);
  const eventReturnPath = withSearch(publicEventPath(event.slug || event.id), resolvedSearchParams);
  const publicReturnLink = safePublicReturnPath(returnTo, eventReturnPath);
  const publicBackLink = publicReturnLink
    ? { href: publicReturnLink, label: publicReturnLabel(publicReturnLink) }
    : { href: "/", label: "Tilbage til forsiden" };
  const facilitatorProfileHref = withReturnTo(publicFacilitatorPath(facilitatorProfile.slug || facilitatorProfile.id), eventReturnPath);
  const facilitatorImageUrl = facilitatorProfile?.profile_image_path
    ? supabase.storage.from("media").getPublicUrl(facilitatorProfile.profile_image_path).data.publicUrl
    : null;
  const eventDuration = formatEventDuration(event.starts_at, event.ends_at);
  const eventHasEndTime = Boolean(event.ends_at);
  const eventIsSameDay = event.ends_at ? isSameDanishDate(event.starts_at, event.ends_at) : true;
  const eventDateLines =
    event.ends_at && !eventIsSameDay
      ? [
          `${formatDanishDate(event.starts_at)} · ${formatDanishTime(event.starts_at)}`,
          `${formatDanishDate(event.ends_at)} · ${formatDanishTime(event.ends_at)}`,
        ]
      : [formatDanishDate(event.starts_at), eventHasEndTime ? `${formatDanishTime(event.starts_at)} – ${formatDanishTime(event.ends_at!)}` : formatDanishTime(event.starts_at)];
  const isOnlineEvent = event.event_format === "online";
  const locationTitle = isOnlineEvent ? "Online" : event.address_line || event.city || region?.name || "Lokation kommer snart";
  const locationDetail = isOnlineEvent
    ? event.online_description || event.online_url_or_note || "Link sendes efter tilmelding"
    : [event.postal_code, event.city].filter(Boolean).join(" ") || region?.name || null;
  const contactEmail = event.contact_email?.trim() || null;
  const contactPhone = event.contact_phone?.trim() || null;
  const contactPhoneDigits = contactPhone?.replace(/\D/g, "") ?? "";
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
  const cancelledDateLabel = formatDanishDate(event.updated_at || event.starts_at);

  const otherUpcomingEvents = (facilitatorUpcomingEvents ?? []).slice(0, 3);
  const hasMoreFacilitatorEvents = (facilitatorUpcomingEvents ?? []).length > 3;
  const seenCoOrganizerIds = new Set<string>();
  const coOrganizers =
    event.event_co_organizers
      ?.filter((row: any) => row.status === "accepted")
      .map((row: any) => (Array.isArray(row.facilitator_profiles) ? row.facilitator_profiles[0] : row.facilitator_profiles))
      .filter((coOrganizer: any) => {
        if (
          !coOrganizer ||
          coOrganizer.status !== "approved" ||
          coOrganizer.is_paused ||
          coOrganizer.is_disabled ||
          coOrganizer.id === facilitatorProfile?.id ||
          seenCoOrganizerIds.has(coOrganizer.id)
        ) {
          return false;
        }

        seenCoOrganizerIds.add(coOrganizer.id);
        return true;
      }) ?? [];
  const eventOrganizers = [
    {
      href: facilitatorProfileHref,
      id: facilitatorProfile?.id ?? "primary-organizer",
      imageUrl: facilitatorImageUrl,
      name: facilitatorName,
      role: "primary" as const,
    },
    ...coOrganizers.map((coOrganizer: any) => {
      const coOrganizerUser = Array.isArray(coOrganizer.profiles) ? coOrganizer.profiles[0] : coOrganizer.profiles;
      const coOrganizerName = coOrganizer.company_name || coOrganizerUser?.full_name || "Arrangør";
      const coOrganizerImageUrl = coOrganizer.profile_image_path
        ? supabase.storage.from("media").getPublicUrl(coOrganizer.profile_image_path).data.publicUrl
        : null;

      return {
        href: withReturnTo(publicFacilitatorPath(coOrganizer.slug || coOrganizer.id), eventReturnPath),
        id: coOrganizer.id,
        imageUrl: coOrganizerImageUrl,
        name: coOrganizerName,
        role: "coOrganizer" as const,
      };
    }),
  ];
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
  const isFreeEvent = event.price_cents === 0;
  const shouldTrackEventView = isPublicEvent && !adminReturn && !facilitatorReturn && !returnTo?.startsWith("/admin") && !returnTo?.startsWith("/facilitator");

  return (
    <main className="min-h-screen bg-cream">
      {shouldTrackEventView ? <TrackEventView eventId={event.id} /> : null}
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
              {!facilitatorReturn && !adminReturn ? (
                <Link
                  className="inline-flex h-11 items-center gap-2 rounded-button border border-olive/15 bg-white px-4 text-sm font-semibold text-olive transition hover:border-rose hover:text-rose"
                  href={publicBackLink.href}
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  {publicBackLink.label}
                </Link>
              ) : null}
            </nav>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1400px] gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_370px]">
        <div className="grid gap-6">
          {isCancelledEvent ? (
            <section className="rounded-card border border-red-200 bg-red-50 p-5 shadow-soft">
              <p className="text-sm font-semibold uppercase tracking-wide text-red-700">Aflyst</p>
              <h2 className="mt-1 text-2xl font-semibold text-red-800">Eventet blev aflyst: {cancelledDateLabel}</h2>
              <p className="mt-2 text-sm leading-6 text-red-900/80">
                Du ser eventet som {viewer?.role === "admin" ? "administrator" : "arrangør"}. Eventet er ikke synligt for deltagere på SoulEvents.
              </p>
            </section>
          ) : null}
          {!isPublicEvent && !isHeldEvent && !isCancelledEvent && (
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
            <h2 className="text-4xl font-medium text-olive">Arrangører</h2>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {eventOrganizers.map((organizer) => (
                <EventOrganizerCard
                  href={organizer.href}
                  imageUrl={organizer.imageUrl}
                  key={organizer.id}
                  name={organizer.name}
                  role={organizer.role}
                />
              ))}
            </div>
          </section>

          {otherUpcomingEvents.length > 0 ? (
            <section className="rounded-card bg-white p-8 shadow-soft">
              <h2 className="text-4xl font-medium text-olive">Andre kommende events fra {facilitatorName}</h2>
              <div className="mt-5 grid gap-3">
                {otherUpcomingEvents.map((upcomingEvent: any) => {
                  const upcomingMainCategory = upcomingEvent.event_main_categories
                    ?.map((row: any) => (Array.isArray(row.main_categories) ? row.main_categories[0] : row.main_categories))
                    .find((category: any) => Boolean(category));
                  const upcomingCoverPath = upcomingEvent.cover_image_path || upcomingMainCategory?.image_path || null;
                  const upcomingCoverUrl = upcomingCoverPath ? supabase.storage.from("media").getPublicUrl(upcomingCoverPath).data.publicUrl : null;
                  const upcomingLocation = upcomingEvent.event_format === "online" ? "Online" : upcomingEvent.city;

                  return (
                    <Link
                      className="grid gap-4 rounded-[20px] border border-[#E8E0D2] bg-[#FAF8FC] p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-[#D8C9E8] hover:shadow-soft sm:grid-cols-[7.5rem_1fr]"
                      href={withReturnTo(publicEventPath(upcomingEvent.slug || upcomingEvent.id), eventReturnPath)}
                      key={upcomingEvent.id}
                    >
                      {upcomingCoverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt=""
                          className="aspect-[4/3] w-full rounded-[16px] object-cover sm:h-24"
                          src={upcomingCoverUrl}
                        />
                      ) : (
                        <span
                          className="grid aspect-[4/3] w-full place-items-center rounded-[16px] text-sm font-semibold text-white sm:h-24"
                          style={{ backgroundColor: upcomingMainCategory?.color_hex || "#7A5D91" }}
                        >
                          SoulEvents
                        </span>
                      )}
                      <span className="min-w-0 py-1">
                        <span className="line-clamp-2 text-lg font-semibold leading-snug text-midnight">{upcomingEvent.title}</span>
                        <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold text-ink/64">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="size-4 text-[#7A5D91]" aria-hidden="true" />
                            {formatDanishDate(upcomingEvent.starts_at)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 className="size-4 text-[#7A5D91]" aria-hidden="true" />
                            {formatDanishTime(upcomingEvent.starts_at)}
                          </span>
                        </span>
                        {upcomingLocation ? (
                          <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-sage-700">
                            <MapPinned className="size-4" aria-hidden="true" />
                            {upcomingLocation}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  );
                })}
              </div>
              {hasMoreFacilitatorEvents ? (
                <Link
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#7A4EAB] transition hover:text-[#6E5285]"
                  href={facilitatorProfileHref}
                >
                  Se alle events fra {facilitatorName} →
                </Link>
              ) : null}
            </section>
          ) : null}
        </div>

        <aside className="grid content-start gap-5 lg:sticky lg:top-6">
          <section className="rounded-card bg-white p-4 shadow-soft sm:p-5" id="event-betingelser">
            <h2 className="font-serif text-3xl font-semibold leading-none text-olive sm:text-4xl">Praktisk</h2>
            <div className="mt-3 inline-flex w-fit items-center rounded-full border border-olive/10 bg-white px-2.5 py-1 text-[0.7rem] font-semibold text-ink/60 shadow-[0_1px_6px_rgba(47,36,55,0.06)]">
              {formatEventFormat(event.event_format)}
            </div>

            <div className="mt-5 grid gap-0 text-ink/72">
              <div className="grid grid-cols-[2.75rem_1fr] gap-2.5 border-b border-[#E8E0D8] pb-4 sm:grid-cols-[3.25rem_1fr] sm:gap-3">
                <span className="grid size-11 place-items-center rounded-[13px] bg-sage-50 text-olive sm:size-13">
                  <CalendarDays className="size-5 sm:size-6" aria-hidden="true" />
                </span>
                <div className="self-center">
                  <p className="text-[0.64rem] font-bold uppercase tracking-[0.12em] text-sage-700 sm:text-[0.68rem]">Dato &amp; tid</p>
                  {eventDateLines.map((line, index) => (
                    <p
                      className={index === 0 ? "mt-1 text-base font-bold leading-snug text-midnight sm:text-lg" : "mt-0.5 text-sm leading-snug text-ink/78 sm:text-base"}
                      key={line}
                    >
                      {line}
                    </p>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-[2.75rem_1fr] gap-2.5 border-b border-[#E8E0D8] py-4 sm:grid-cols-[3.25rem_1fr] sm:gap-3">
                <span className="grid size-11 place-items-center rounded-[13px] bg-sage-50 text-olive sm:size-13">
                  <MapPinned className="size-5 sm:size-6" aria-hidden="true" />
                </span>
                <div className="self-center">
                  <p className="text-[0.64rem] font-bold uppercase tracking-[0.12em] text-sage-700 sm:text-[0.68rem]">Sted</p>
                  <p className="mt-1 text-base font-bold leading-snug text-midnight sm:text-lg">{locationTitle}</p>
                  {locationDetail ? <p className="mt-0.5 text-sm leading-snug text-ink/62 sm:text-base">{locationDetail}</p> : null}
                </div>
              </div>

              <div className={`grid grid-cols-[2.75rem_1fr] gap-2.5 border-b border-[#E8E0D8] py-4 sm:grid-cols-[3.25rem_1fr] sm:gap-3 ${isFreeEvent ? "rounded-[16px] bg-[#EEF7F0]/70 px-2" : ""}`}>
                <span className={`grid size-11 place-items-center rounded-[13px] sm:size-13 ${isFreeEvent ? "bg-[#EEF7F0] text-[#4F654A]" : "bg-sage-50 text-olive"}`}>
                  <Ticket className="size-5 sm:size-6" aria-hidden="true" />
                </span>
                <div className="self-center">
                  <p className="text-[0.64rem] font-bold uppercase tracking-[0.12em] text-sage-700 sm:text-[0.68rem]">Pris</p>
                  <p className={`mt-1 text-base font-bold leading-snug sm:text-lg ${isFreeEvent ? "text-[#4F654A]" : "text-midnight"}`}>{formatPrice(event.price_cents)}</p>
                </div>
              </div>

              {eventDuration ? (
                <div className="grid grid-cols-[2.75rem_1fr] gap-2.5 py-4 sm:grid-cols-[3.25rem_1fr] sm:gap-3">
                  <span className="grid size-11 place-items-center rounded-[13px] bg-sage-50 text-olive sm:size-13">
                    <Clock3 className="size-5 sm:size-6" aria-hidden="true" />
                  </span>
                  <div className="self-center">
                    <p className="text-[0.64rem] font-bold uppercase tracking-[0.12em] text-sage-700 sm:text-[0.68rem]">Varighed</p>
                    <p className="mt-1 text-base font-bold leading-snug text-midnight sm:text-lg">{eventDuration}</p>
                  </div>
                </div>
              ) : null}

              {event.practical_information ? (
                <div className="mb-4 grid grid-cols-[2.75rem_1fr] gap-2.5 rounded-[14px] border border-[#E8E0D8] bg-white/80 p-3 shadow-soft sm:grid-cols-[3rem_1fr] sm:gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-sage-100 text-olive sm:size-10">
                    <Leaf className="size-4.5 sm:size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 self-center">
                    <p className="text-sm font-bold leading-snug text-olive">Praktisk information til deltagere</p>
                    <p className="mt-1 break-words text-sm leading-6 text-ink/72">{event.practical_information}</p>
                  </div>
                </div>
              ) : null}

              {(contactEmail || contactPhone) ? (
                <div className="border-t border-[#E8E0D8] pt-3.5">
                  <h3 className="text-base font-bold text-olive">Kontakt arrangøren</h3>
                  <div className="mt-2.5 grid gap-2 text-sm text-ink/72">
                    {contactEmail ? (
                      <a className="inline-flex min-w-0 items-center gap-2.5 break-all transition hover:text-olive" href={`mailto:${contactEmail}`}>
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sage-100 text-olive">
                          <Mail className="size-3.5" aria-hidden="true" />
                        </span>
                        {contactEmail}
                      </a>
                    ) : null}
                    {contactPhone ? (
                      <a className="inline-flex items-center gap-2.5 transition hover:text-olive" href={`tel:${contactPhoneDigits || contactPhone}`}>
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sage-100 text-olive">
                          <Phone className="size-3.5" aria-hidden="true" />
                        </span>
                        {formatContactPhone(contactPhone)}
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}
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
              facilitatorProfileHref={facilitatorProfileHref}
              message={message}
              messageVariant={messageVariant}
              externalRegistrationUrl={externalRegistrationUrl}
              paymentPreview={paymentPreview}
              registrationMode={registrationMode}
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
