import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, CircleUserRound, ExternalLink, Mail, MapPinned, Phone, Ticket } from "lucide-react";
import { AuthMessage } from "@/components/auth/auth-message";
import { BrandLogo } from "@/components/brand-logo";
import { BookingForm } from "@/components/events/detail/booking-form";
import { ShareEventButton } from "@/components/events/detail/share-event-button";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type EventDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{ booking?: string; message?: string }>;
};

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
  const [{ id }, { booking, message }] = await Promise.all([params, searchParams]);
  const messageVariant = booking === "sent" ? "success" : "notice";
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select(
      `
      id,
      title,
      short_description,
      long_description,
      starts_at,
      ends_at,
      address_line,
      postal_code,
      city,
      price_cents,
      capacity,
      contact_email,
      contact_phone,
      facebook_url,
      instagram_url,
      facilitator_profiles!inner(
        id,
        status,
        company_name,
        profile_image_path,
        short_description,
        website_url,
        facebook_url,
        instagram_url,
        profiles(full_name)
      ),
      regions(name),
      event_categories(categories(name, color_hex)),
      event_images(image_path, alt_text, sort_order)
    `,
    )
    .eq("id", id)
    .eq("status", "active")
    .eq("facilitator_profiles.status", "approved")
    .single();

  if (!event) {
    notFound();
  }

  const { data: capacity } = await supabase.from("event_capacity_view").select("available_seats").eq("event_id", id).single();
  const availableSeats = capacity?.available_seats ?? event.capacity;
  const facilitatorProfile = Array.isArray(event.facilitator_profiles)
    ? event.facilitator_profiles[0]
    : event.facilitator_profiles;
  const facilitatorUser = Array.isArray(facilitatorProfile?.profiles)
    ? facilitatorProfile?.profiles[0]
    : facilitatorProfile?.profiles;
  const region = Array.isArray(event.regions) ? event.regions[0] : event.regions;
  const categories =
    event.event_categories
      ?.map((row) => (Array.isArray(row.categories) ? row.categories[0] : row.categories))
      .filter((category): category is { name: string; color_hex: string } => Boolean(category)) ?? [];
  const images = [...(event.event_images ?? [])].sort(
    (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order,
  );
  const facilitatorName = facilitatorProfile?.company_name || facilitatorUser?.full_name || "Facilitator";
  const facilitatorImageUrl = facilitatorProfile?.profile_image_path
    ? supabase.storage.from("media").getPublicUrl(facilitatorProfile.profile_image_path).data.publicUrl
    : null;
  const eventDuration = formatEventDuration(event.starts_at, event.ends_at);
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
            <BrandLogo className="h-20 w-20" priority />
            <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Event</p>
            <h1 className="text-3xl font-medium text-olive">{event.title}</h1>
            </div>
          </div>
          <Link
            className="inline-flex h-11 items-center gap-2 rounded-button border border-olive/15 bg-white px-4 text-sm font-semibold text-olive transition hover:border-rose hover:text-rose"
            href="/events"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Events
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1400px] gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_400px]">
        <div className="grid gap-6">
          <section className="overflow-hidden rounded-card bg-white shadow-soft">
            <div className="aspect-[16/7] bg-sage-50 p-10">
              <div className="flex h-full items-center justify-center rounded-card bg-cream/80">
                <BrandLogo className="h-28 w-28 opacity-80" />
              </div>
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
                  <div className="rounded-md bg-sage-50 p-4 text-sm text-ink/70" key={image.image_path}>
                    <p className="font-semibold text-midnight">{image.alt_text || "Eventbillede"}</p>
                    <p className="mt-2 break-all text-xs">{image.image_path}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-card bg-white p-8 shadow-soft">
            <h2 className="text-4xl font-medium text-olive">Facilitator</h2>
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
                <p className="font-semibold text-sage-700">{facilitatorName}</p>
                <p className="mt-2 text-sm leading-6 text-ink/66">
                  {facilitatorProfile?.short_description || "Facilitatorens profiltekst kommer snart."}
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

          <BookingForm availableSeats={availableSeats} eventId={event.id} message={message} messageVariant={messageVariant} />
        </aside>
      </section>
    </main>
  );
}
