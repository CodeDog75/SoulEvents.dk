import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, CircleUserRound, ExternalLink, Mail, MapPinned, Phone, Ticket } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { OrganizerBadges } from "@/components/badges/organizer-badges";
import { BookingForm } from "@/components/events/detail/booking-form";
import { ShareEventButton } from "@/components/events/detail/share-event-button";
import { getCurrentProfile } from "@/lib/auth/roles";
import { getAvailableEventSeats } from "@/lib/events/capacity";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type EventDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{ admin_return?: string; booking?: string; message?: string }>;
};

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
  const [{ id }, { admin_return: adminReturn, booking, message }] = await Promise.all([params, searchParams]);
  const messageVariant = booking === "sent" ? "success" : "notice";
  const supabase = await createClient();
  const viewer = await getCurrentProfile();

  const { data: event } = await supabase
    .from("events")
    .select(
      `
      id,
      status,
      title,
      short_description,
      long_description,
      starts_at,
      ends_at,
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
        status,
        company_name,
        profile_image_path,
        short_description,
        website_url,
        facebook_url,
        instagram_url,
        is_active_host,
        is_experienced_host,
        profiles(full_name)
      ),
      regions(name),
      event_categories(categories(name, color_hex)),
      event_main_categories(main_categories(name, color_hex, image_path)),
      event_images(image_path, alt_text, sort_order)
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (!event) {
    notFound();
  }

  const availableSeats = await getAvailableEventSeats(createAdminClient(), id, event.capacity);
  const facilitatorProfile = Array.isArray(event.facilitator_profiles)
    ? event.facilitator_profiles[0]
    : event.facilitator_profiles;
  const isPublicEvent = event.status === "active" && facilitatorProfile?.status === "approved";
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
  const images = [...(event.event_images ?? [])].sort(
    (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order,
  );
  const facilitatorName = facilitatorProfile?.company_name || facilitatorUser?.full_name || "Arrangør";
  const isBookable = isPublicEvent;
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

  const facilitatorLinks = [
    facilitatorProfile?.website_url ? { label: "Hjemmeside", href: ensureUrl(facilitatorProfile.website_url) } : null,
    facilitatorProfile?.facebook_url ? { label: "Facebook", href: ensureUrl(facilitatorProfile.facebook_url) } : null,
    facilitatorProfile?.instagram_url ? { label: "Instagram", href: ensureUrl(facilitatorProfile.instagram_url) } : null,
  ].filter((link): link is { label: string; href: string } => Boolean(link));

  return (
    <main className="min-h-screen bg-cream">
      <header className="bg-white shadow-soft">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-5 sm:px-8">
          <div className="flex items-center gap-4">
            <BrandLogo className="h-28 w-28" priority />
            <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Event</p>
            <h1 className="text-3xl font-medium text-olive">{event.title}</h1>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {viewer?.role === "admin" && adminReturn ? (
              <Link
                className="inline-flex h-11 items-center gap-2 rounded-button border border-olive/15 bg-white px-4 text-sm font-semibold text-olive transition hover:border-rose hover:text-rose"
                href={adminReturn}
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Tilbage til admin
              </Link>
            ) : null}
            <Link
              className="inline-flex h-11 items-center gap-2 rounded-button border border-olive/15 bg-white px-4 text-sm font-semibold text-olive transition hover:border-rose hover:text-rose"
              href="/"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Tilbage til forsiden
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1400px] gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_400px]">
        <div className="grid gap-6">
          {!isPublicEvent && (
            <section className="rounded-card border border-[#E5D4F7] bg-[#F7F2FB] p-5 shadow-soft">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Forhåndsvisning</p>
              <h2 className="mt-1 text-2xl font-semibold text-midnight">Dette event er endnu ikke offentligt</h2>
              <p className="mt-2 text-sm leading-6 text-ink/70">
                Du ser eventet som {viewer?.role === "admin" ? "administrator" : "arrangør"}. Deltagere kan først se og tilmelde sig eventet, når det er godkendt og publiceret.
              </p>
            </section>
          )}

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
            <p className="mt-4 max-w-3xl text-base leading-7 text-ink/72">{event.short_description}</p>
            </div>
          </section>

          <section className="rounded-card bg-white p-8 shadow-soft">
            <h2 className="text-4xl font-medium text-olive">Om eventet</h2>
            <div className="mt-4 whitespace-pre-line text-sm leading-7 text-ink/72">{event.long_description}</div>
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
                  className="size-28 rounded-full object-cover shadow-soft"
                  src={facilitatorImageUrl}
                />
              ) : (
                <div className="grid size-28 place-items-center rounded-full bg-sage-50 text-sage-700">
                  <CircleUserRound className="size-10" aria-hidden="true" />
                </div>
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link className="font-semibold text-sage-700 transition hover:text-rose" href={"/facilitators/" + facilitatorProfile.id}>{facilitatorName}</Link>
                  <OrganizerBadges badges={[facilitatorProfile?.is_experienced_host ? "experienced" : null, facilitatorProfile?.is_active_host ? "active" : null].filter(Boolean) as never} />
                </div>
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
              </div>
            </div>
          </section>
        </div>

        <aside className="grid content-start gap-5 lg:sticky lg:top-6">
          <section className="rounded-card bg-white p-6 shadow-soft">
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
            eventTitle={event.title}
            facilitatorName={facilitatorName}
            startsAt={event.starts_at}
          />

          {isBookable ? (
            <BookingForm availableSeats={availableSeats} eventId={event.id} message={message} messageVariant={messageVariant} />
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
