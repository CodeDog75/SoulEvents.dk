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
import { HomeEventSearchForm } from "@/components/events/home-event-search-form";
import { PublicEventList } from "@/components/events/public-event-list";
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
    facilitator_profiles?:
      | { company_name?: string | null; profiles?: { full_name?: string | null } | Array<{ full_name?: string | null }> | null }
      | Array<{ company_name?: string | null; profiles?: { full_name?: string | null } | Array<{ full_name?: string | null }> | null }>
      | null;
    event_categories?: Array<{ categories?: { name?: string } | Array<{ name?: string }> | null }>;
  },
  query: string,
) {
  if (!query) {
    return true;
  }

  const facilitator = Array.isArray(event.facilitator_profiles) ? event.facilitator_profiles[0] : event.facilitator_profiles;
  const facilitatorUser = Array.isArray(facilitator?.profiles) ? facilitator?.profiles[0] : facilitator?.profiles;
  const region = Array.isArray(event.regions) ? event.regions[0] : event.regions;
  const categoryNames =
    event.event_categories
      ?.map((row) => (Array.isArray(row.categories) ? row.categories[0] : row.categories)?.name)
      .filter(Boolean)
      .join(" ") ?? "";

  return [
    event.title,
    event.short_description,
    event.city,
    region?.name,
    facilitator?.company_name,
    facilitatorUser?.full_name,
    categoryNames,
  ]
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

async function getSearchEvents(selected: {
  q: string;
  area: string;
  categoryLabel: string;
  date: string;
  distance: string;
  latitude: string;
  longitude: string;
}) {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return [];
  }

  const supabase = await createClient();
  const { data: regions } = await supabase.from("regions").select("id, name, slug").order("sort_order");

  let query = supabase
    .from("events")
    .select(
      `
      id,
      title,
      short_description,
      starts_at,
      latitude,
      longitude,
      city,
      price_cents,
      capacity,
      facilitator_profiles!inner(
        status,
        company_name,
        profiles(full_name)
      ),
      regions(name),
      event_categories(categories(id, name, color_hex))
    `,
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

  const { data: events } = await query;
  const categoryFilteredEvents = (events ?? []).filter((event) => textMatches(event, selected.q) && categoryMatches(event, selected.categoryLabel));

  const userLatitude = parseCoordinate(selected.latitude);
  const userLongitude = parseCoordinate(selected.longitude);
  const selectedDistance = Number(selected.distance);
  const userLocation =
    userLatitude !== null && userLongitude !== null ? { latitude: userLatitude, longitude: userLongitude } : null;

  return userLocation && [25, 50, 100].includes(selectedDistance)
    ? categoryFilteredEvents
        .map((event) => {
          if (typeof event.latitude !== "number" || typeof event.longitude !== "number") {
            return { event, distance: Number.POSITIVE_INFINITY };
          }

          return {
            event,
            distance: distanceInKm(userLocation, {
              latitude: event.latitude,
              longitude: event.longitude,
            }),
          };
        })
        .filter(({ distance }) => distance <= selectedDistance)
        .sort((a, b) => a.distance - b.distance)
        .map(({ event }) => event)
    : categoryFilteredEvents;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = searchParams ? await searchParams : {};
  const contactStatus = params.contact ?? "";
  const selected = {
    q: params.q?.trim() ?? "",
    area: params.area ?? "",
    categoryLabel: params.category_label === "Alle kategorier" ? "" : params.category_label ?? "",
    date: params.date ?? "",
    distance: params.distance ?? "",
    latitude: params.latitude ?? "",
    longitude: params.longitude ?? "",
  };
  const hasSearch = Boolean(
    selected.q ||
      selected.area ||
      selected.categoryLabel ||
      selected.date ||
      selected.distance ||
      selected.latitude ||
      selected.longitude,
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
  });
  const searchEvents = hasSearch ? await getSearchEvents(selected) : [];
  const activeFilterParams = {
    q: selected.q,
    area: selected.area,
    category_label: selected.categoryLabel,
    distance: selected.distance,
    latitude: selected.latitude,
    longitude: selected.longitude,
  };
  const activeFilters = [
    selected.categoryLabel
      ? { key: "category_label", label: selected.categoryLabel, href: removeSearchParam(activeFilterParams, "category_label") }
      : null,
    selected.area
      ? { key: "area", label: getAreaOption(selected.area)?.label ?? selected.area, href: removeSearchParam(activeFilterParams, "area") }
      : null,
    selected.q ? { key: "q", label: "Søgning: " + selected.q, href: removeSearchParam(activeFilterParams, "q") } : null,
    selected.latitude && selected.longitude
      ? { key: "nearby", label: "I nærheden", href: removeSearchParam(removeSearchParam(removeSearchParam(activeFilterParams, "latitude"), "longitude"), "distance") }
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
              <Link className="transition hover:text-rose" href="/events">
                Events
              </Link>
              <Link className="transition hover:text-rose" href="/events#map">
                Kort
              </Link>
              <a className="transition hover:text-rose" href="#facilitators">
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
              <Link
                className="rounded-button bg-rose px-5 py-3 text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
                href="/events"
              >
                Find Events
              </Link>
            </nav>
          </div>
        </header>

        <div className="relative z-10 mx-auto grid max-w-[1200px] gap-6 px-4 pb-10 pt-6 sm:gap-10 sm:px-8 sm:pb-16 sm:pt-14 lg:pt-24">
          <div className="max-w-4xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-olive shadow-soft">
              <Sparkles className="size-4 text-rose" aria-hidden="true" />
              Danmarks samlingssted for spirituelle events
            </p>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-tight text-olive sm:mt-8 sm:text-7xl sm:leading-[0.95] lg:text-8xl">
Find oplevelser tæt på dig
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-ink/76 sm:mt-6 sm:text-xl sm:leading-8">
Gå på opdagelse i spirituelle events, facilitatorer og oplevelser i hele Danmark. Start tæt på dig, eller vælg et område og mærk efter hvad der kalder.
            </p>
          </div>
          <HomeEventSearchForm categories={categories.map(({ name, value }) => ({ name, value }))} selected={selected} />
        </div>
      </section>

      <section className="bg-white py-[120px]" id="events">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-rose">
                {hasSearch ? "Søgeresultater" : "Kommende events"}
              </p>
              <h2 className="mt-3 text-5xl font-medium leading-tight text-olive">
                {hasSearch ? "Events der matcher din søgning" : "Førstkommende oplevelser"}
              </h2>
            </div>
            <Link
              className="inline-flex h-12 items-center justify-center rounded-button bg-olive px-6 text-sm font-semibold text-white transition hover:bg-sage-500"
              href="/events"
            >
              Se alle events
            </Link>
          </div>

          {activeFilters.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
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

          <div className="mt-10">
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
                  </section>
                </div>
              )
            ) : upcomingEvents.length > 0 ? (
              <PublicEventList events={upcomingEvents.slice(0, 6) as never} />
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

      <section className="mx-auto grid max-w-[1200px] gap-8 px-5 py-[120px] sm:px-8 md:grid-cols-3" id="facilitators">
        {[
          {
            icon: ShieldCheck,
            title: "Godkendte facilitatorer",
            text: "Profiler gennemgås, så brugere møder et trygt og autentisk univers.",
          },
          {
            icon: MapPinned,
            title: "Events nær dig",
            text: "Søg på område, adresse og kategori, og find oplevelser i hele Danmark.",
          },
          {
            icon: Heart,
            title: "Bygget til nærvær",
            text: "Tilmelding, kontakt og eventflow er enkelt for både besøgende og facilitatorer.",
          },
        ].map((item) => (
          <article className="rounded-card bg-white p-8 shadow-soft" key={item.title}>
            <item.icon className="size-7 text-rose" aria-hidden="true" />
            <h2 className="mt-6 text-3xl font-medium text-olive">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-ink/68">{item.text}</p>
          </article>
        ))}
      </section>

      <section className="bg-white py-[120px]" id="contact">
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

      <div className="mx-auto max-w-[1200px] px-5 pb-8 sm:px-8 md:hidden">
        <Link
          className="flex h-14 items-center justify-center rounded-button bg-rose text-sm font-semibold text-white shadow-soft"
          href="/events"
        >
          Find Events
        </Link>
      </div>

      <SiteFooterLogin />
    </main>
  );
}

