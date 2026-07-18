import type { Metadata } from "next";
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, ExternalLink, Mail, MapPinned, Phone, Sparkles, Ticket, UserRound } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ActiveHostInfo, ExperiencedHostInfo, OrganizerImageBadge } from "@/components/badges/organizer-badges";
import { CapacityBadge } from "@/components/events/capacity-badge";
import { ShareFacilitatorButton } from "@/components/facilitator/share-facilitator-button";
import { subscribeToFacilitatorReminderAction } from "./actions";
import { getCurrentProfile } from "@/lib/auth/roles";
import { getAvailableEventSeatsByEventId } from "@/lib/events/capacity";
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

function formatEventPrice(priceCents: number | null | undefined) {
  if (!priceCents) return "Gratis";
  return new Intl.NumberFormat("da-DK").format(priceCents / 100) + " kr.";
}

function locationOfEvent(event: any) {
  const region = first(event.regions);

  if (event.event_format === "online") {
    return "Online event";
  }

  return [event.city, region?.name].filter(Boolean).join(", ") || "Lokation kommer snart";
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

function FacilitatorEventList({ events }: { events: any[] }) {
  return (
    <div className="grid gap-3">
      {events.map((event) => {
        return (
          <article
            className="rounded-card border border-sage-700/18 bg-[#F8FBF4] p-4 shadow-soft sm:p-5"
            key={event.id}
          >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-sage-700/12 px-3 py-1 text-xs font-semibold text-sage-900">
                  Kommende
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink/60">
                  {event.event_format === "online" ? "Online" : "Fysisk"}
                </span>
              </div>
              <h3 className="text-2xl font-medium leading-tight text-olive">{event.title}</h3>
              <div className="mt-3 grid gap-2 text-sm text-ink/68 sm:grid-cols-2 xl:grid-cols-4">
                <span className="flex items-center gap-2">
                  <CalendarDays className="size-4 shrink-0 text-sage-700" aria-hidden="true" />
                  {new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.starts_at))}
                </span>
                <span className="flex items-center gap-2">
                  <MapPinned className="size-4 shrink-0 text-sage-700" aria-hidden="true" />
                  <span className="truncate">{locationOfEvent(event)}</span>
                </span>
                <span className="flex items-center gap-2 font-semibold text-olive">
                  <Ticket className="size-4 shrink-0 text-sage-700" aria-hidden="true" />
                  {formatEventPrice(event.price_cents)}
                </span>
                <CapacityBadge availableSeats={event.available_seats} capacity={event.capacity} status={event.status} />
              </div>
            </div>
            <Link
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-button border border-sage-700/30 bg-white px-5 text-sm font-semibold text-olive transition hover:border-sage-700 hover:bg-sage-50"
              href={"/events/" + event.id}
            >
              Se event
            </Link>
          </div>
          </article>
        );
      })}
    </div>
  );
}

export async function generateMetadata({ params }: FacilitatorPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: facilitator } = await supabase
    .from("facilitator_profiles")
    .select("company_name, profile_image_path, short_description, long_description, profiles!facilitator_profiles_profile_id_fkey(full_name), facilitator_images(image_path, sort_order)")
    .eq("id", id)
    .eq("status", "approved")
    .eq("is_paused", false)
    .eq("is_disabled", false)
    .single();

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
  const imagePath = facilitator.profile_image_path || galleryImages.find((image) => image.image_path)?.image_path || null;
  const imageUrl = imagePath ? publicMediaUrl(supabase, imagePath) : null;
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

  const facilitatorSelect =
    "id, profile_id, company_name, profile_image_path, short_description, specialties, long_description, website_url, public_email, public_phone, facebook_url, instagram_url, youtube_url, tiktok_url, address_line, postal_code, city, country, is_online_facilitator, is_active_host, is_experienced_host, offers_services, service_description, profiles!facilitator_profiles_profile_id_fkey(full_name, email, phone), regions(name), facilitator_categories(categories(name, slug, color_hex)), facilitator_images(image_path, alt_text, sort_order)";
  const { data: publicFacilitator, error: publicFacilitatorError } = await supabase
    .from("facilitator_profiles")
    .select(facilitatorSelect)
    .eq("id", id)
    .eq("status", "approved")
    .eq("is_paused", false)
    .eq("is_disabled", false)
    .single();
  if (publicFacilitatorError && publicFacilitatorError.code !== "PGRST116") {
    console.error("[facilitator-profile] public lookup failed", {
      code: publicFacilitatorError.code,
      id,
      message: publicFacilitatorError.message,
    });
  }

  const { data: previewFacilitator, error: previewFacilitatorError } =
    !publicFacilitator && ((adminReturnLink && viewer?.role === "admin") || (facilitatorReturnLink && viewer?.role === "facilitator"))
      ? await createAdminClient().from("facilitator_profiles").select(facilitatorSelect).eq("id", id).single()
      : { data: null, error: null };
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
      "id, status, title, short_description, starts_at, ends_at, city, price_cents, capacity, event_format, facilitator_profiles!inner(status, company_name, profiles!facilitator_profiles_profile_id_fkey(full_name)), regions(name), event_categories(categories(name, color_hex))",
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
      .slice(0, 10)
      .map((image: any) => ({
        ...image,
        url: supabase.storage.from("media").getPublicUrl(image.image_path).data.publicUrl,
      })) ?? [];
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

  return (
    <main className="min-h-screen bg-cream text-ink">
      <header className="bg-white shadow-soft">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-5 sm:px-8">
          <Link aria-label="SoulEvents.dk forside" href="/">
            <BrandLogo className="h-28 w-28" priority />
          </Link>
          <Link
            className="inline-flex h-11 items-center gap-2 rounded-button border border-olive/15 bg-white px-4 text-sm font-semibold text-olive transition hover:border-rose hover:text-rose"
            href={backLink.href}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {backLink.label}
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1400px] gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_380px]">
        <div className="grid gap-6">
          <section className="overflow-hidden rounded-card bg-white shadow-soft">
            <div className="grid gap-8 p-8 sm:p-10 md:grid-cols-[260px_1fr] md:items-center">
              <div className="relative aspect-square overflow-hidden rounded-card bg-sage-50">
                {facilitatorData.is_experienced_host ? (
                  <OrganizerImageBadge type="experienced" />
                ) : facilitatorData.is_active_host ? (
                  <OrganizerImageBadge type="active" />
                ) : null}
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={name} className="h-full w-full object-cover" src={imageUrl} />
                ) : (
                  <div className="grid h-full place-items-center text-sage-700">
                    <UserRound className="size-20" aria-hidden="true" />
                  </div>
                )}
              </div>

              <div>
                <div className="flex flex-wrap gap-2">
                  {facilitatorData.is_online_facilitator && (
                    <span className="rounded-full border border-olive/10 bg-white px-2.5 py-1 text-xs font-medium text-ink/55">💻 Online arrangør</span>
                  )}
                  {categories.map((category: any) => (
                    <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" key={category.name} style={{ backgroundColor: category.color_hex }}>
                      {category.name}
                    </span>
                  ))}
                  {specialties.map((specialty) => (
                    <span className="rounded-full border border-midnight/15 bg-white px-3 py-1 text-xs font-semibold text-midnight" key={specialty}>
                      {specialty}
                    </span>
                  ))}
                </div>
                <h1 className="mt-4 text-5xl font-medium leading-tight text-olive">{name}</h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-ink/72">
                  {facilitatorData.short_description || "Arrangørens korte præsentation kommer snart."}
                </p>
                {(facilitatorData.is_experienced_host || facilitatorData.is_active_host) && (
                  <div className="mt-5 grid max-w-3xl gap-3">
                    {facilitatorData.is_experienced_host && <ExperiencedHostInfo />}
                    {facilitatorData.is_active_host && <ActiveHostInfo />}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-card bg-white p-8 shadow-soft">
            <h2 className="text-4xl font-medium text-olive">Om arrangøren</h2>
            <div className="mt-4 whitespace-pre-line text-sm leading-7 text-ink/72">
              {facilitatorData.long_description || facilitatorData.short_description || "Der kommer mere information om arrangøren snart."}
            </div>
          </section>

          {facilitatorData.offers_services && facilitatorData.service_description ? (
            <section className="rounded-card bg-white p-8 shadow-soft">
              <h2 className="text-4xl font-medium text-olive">Individuelle ydelser</h2>
              <p className="mt-4 whitespace-pre-line text-sm leading-7 text-ink/72">{facilitatorData.service_description}</p>
            </section>
          ) : null}

          {gallery.length > 0 && (
            <section className="rounded-card bg-white p-8 shadow-soft">
              <h2 className="text-4xl font-medium text-olive">Galleri</h2>
              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
                {gallery.map((image: any) => (
                  <div className="aspect-square overflow-hidden rounded-card bg-sage-50" key={image.image_path}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt={image.alt_text || name} className="h-full w-full object-cover" src={image.url} />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-card bg-white p-8 shadow-soft">
            <h2 className="text-4xl font-medium text-olive">Kommende events</h2>
            <div className="mt-5">
              {events && events.length > 0 ? (
                <FacilitatorEventList events={eventsWithCapacity} />
              ) : (
                <div className="rounded-card bg-cream p-8 text-center">
                  <Sparkles className="mx-auto size-8 text-rose" aria-hidden="true" />
                  <p className="mt-4 text-lg font-semibold text-olive">Der er ingen planlagte events for denne arrangør.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="grid content-start gap-5 lg:sticky lg:top-6">
          <section className="rounded-card bg-white p-6 shadow-soft">
            <h2 className="text-3xl font-medium text-olive">Kontakt og lokation</h2>
            <div className="mt-4 grid gap-3 text-sm text-ink/72">
              <div className="flex gap-2">
                <MapPinned className="mt-0.5 size-4 text-sage-700" aria-hidden="true" />
                <span>
                  {facilitatorData.is_online_facilitator
                    ? "Online arrangør"
                    : [facilitatorData.city, region?.name, facilitatorData.country].filter(Boolean).join(", ") || "Lokation kommer snart"}
                </span>
              </div>
              {publicEmail && (
                <a className="inline-flex items-center gap-2 font-semibold text-olive transition hover:text-rose" href={"mailto:" + publicEmail}>
                  <Mail className="size-4" aria-hidden="true" />
                  {publicEmail}
                </a>
              )}
              {publicPhone && (
                <a className="inline-flex items-center gap-2 font-semibold text-olive transition hover:text-rose" href={"tel:" + publicPhone}>
                  <Phone className="size-4" aria-hidden="true" />
                  {publicPhone}
                </a>
              )}
              {links.map((link) => (
                <a className="inline-flex items-center gap-2 font-semibold text-olive transition hover:text-rose" href={link.href} key={link.label} rel="noreferrer" target="_blank">
                  <ExternalLink className="size-4" aria-hidden="true" />
                  {link.label}
                </a>
              ))}
            </div>
          </section>

          <ShareFacilitatorButton facilitatorId={facilitatorData.id} facilitatorName={name} />

          <section className="scroll-mt-8 rounded-card border border-[#E5D4F7] bg-[#F6EFFF] p-6 shadow-soft" id="reminder-signup">
            <h2 className="text-3xl font-medium text-olive">Tilmeld påmindelse</h2>
            <p className="mt-3 text-sm leading-6 text-ink/72">
              Få besked på e-mail, når denne arrangør opretter et nyt event.
            </p>
            {reminderMessage && (
              <p className="mt-4 rounded-card border border-lavender/70 bg-white/75 px-4 py-3 text-sm font-semibold text-ink/70">
                {reminderMessage}
              </p>
            )}
            <form action={subscribeToFacilitatorReminderAction.bind(null, facilitatorData.id)} className="mt-4 grid gap-3">
              <label className="sr-only" htmlFor="reminder-email">
                E-mail til påmindelse
              </label>
              <input
                className="h-12 rounded-input border border-[#D8C7EE] bg-white px-4 text-base outline-none transition focus:border-[#7A4EAB] focus:ring-4 focus:ring-[#EDE4F7]"
                id="reminder-email"
                name="email"
                placeholder="din@email.dk"
                required
                type="email"
              />
              <button className="inline-flex h-12 items-center justify-center rounded-button bg-[#7A4EAB] px-6 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-[#684093] hover:shadow-lift" type="submit">
                Tilmeld påmindelse
              </button>
            </form>
          </section>
        </aside>
      </section>
    </main>
  );
}
