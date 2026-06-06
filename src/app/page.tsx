import {
  CalendarDays,
  Heart,
  MapPinned,
  Moon,
  Music2,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Trees,
  Waves,
  Wind,
} from "lucide-react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { HomeEventSearchForm } from "@/components/events/home-event-search-form";
import { sendContactMessageAction } from "@/app/contact/actions";
import { SiteFooterLogin } from "@/components/site-footer-login";

const categories = [
  { name: "Yoga", icon: SunMedium, href: "/events?category_label=Yoga" },
  { name: "Meditation", icon: Moon, href: "/events?category_label=Meditation" },
  { name: "Lydbad", icon: Waves, href: "/events?category_label=Lydbad" },
  { name: "Saunagus", icon: Sparkles, href: "/events?category_label=Saunagus" },
  { name: "Retreat", icon: Trees, href: "/events?category_label=Retreat" },
  { name: "Healing", icon: Heart, href: "/events?category_label=Healing" },
  { name: "Ceremoni", icon: ShieldCheck, href: "/events?category_label=Ceremoni" },
  { name: "Breathwork", icon: Wind, href: "/events?category_label=Breathwork" },
  { name: "Kirtan", icon: Music2, href: "/events?category_label=Kirtan" },
];

type HomeProps = {
  searchParams?: Promise<{ contact?: string }>;
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

export default async function Home({ searchParams }: HomeProps) {
  const params = searchParams ? await searchParams : {};
  const contactStatus = params.contact ?? "";

  return (
    <main className="min-h-screen bg-cream text-ink">
      <section className="relative min-h-[780px] overflow-hidden bg-cream">
        <div
          className="absolute inset-0 bg-[url('/brand/soulevents-logo.png')] bg-[length:680px_680px] bg-center bg-no-repeat opacity-20"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-white/45" aria-hidden="true" />

        <header className="relative z-10">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-5 sm:px-8">
            <Link aria-label="SoulEvents.dk forside" href="/">
              <BrandLogo className="h-24 w-24" priority />
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

        <div className="relative z-10 mx-auto grid max-w-[1200px] gap-10 px-5 pb-16 pt-14 sm:px-8 lg:pt-24">
          <div className="max-w-4xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-olive shadow-soft">
              <Sparkles className="size-4 text-rose" aria-hidden="true" />
              Danmarks samlingssted for spirituelle events
            </p>
            <h1 className="mt-8 max-w-4xl text-6xl font-semibold leading-[0.95] text-olive sm:text-7xl lg:text-8xl">
              Find spirituelle events nær dig
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/76 sm:text-xl">
              Oplev events for krop, sind og sjæl. Yoga, meditation, lydbade, saunagus, retreats, ceremonier og
              healing samlet ét trygt sted.
            </p>
          </div>
          <HomeEventSearchForm categories={categories.map(({ name }) => ({ name }))} />
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-5 py-[120px] sm:px-8" id="categories">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-rose">Kategorier</p>
            <h2 className="mt-3 text-5xl font-medium leading-tight text-olive">Find det, der kalder på dig</h2>
          </div>
          <Link className="text-sm font-semibold text-olive transition hover:text-rose" href="/events">
            Se alle events
          </Link>
        </div>

        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Link
              className="group rounded-card bg-white p-7 shadow-soft transition hover:-translate-y-1 hover:shadow-lift"
              href={category.href}
              key={category.name}
            >
              <div className="grid size-14 place-items-center rounded-2xl bg-sage-50 text-olive transition group-hover:bg-rose group-hover:text-white">
                <category.icon className="size-6" aria-hidden="true" />
              </div>
              <h3 className="mt-8 text-3xl font-medium text-olive">{category.name}</h3>
              <p className="mt-3 text-sm leading-6 text-ink/68">
                Udforsk kommende {category.name.toLowerCase()} events og facilitatorer i Danmark.
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-white py-[120px]" id="events">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-rose">Udvalgte events</p>
              <h2 className="mt-3 text-5xl font-medium leading-tight text-olive">Ro, nærvær og fællesskab</h2>
            </div>
            <Link
              className="inline-flex h-12 items-center justify-center rounded-button bg-olive px-6 text-sm font-semibold text-white transition hover:bg-sage-500"
              href="/events"
            >
              Find Events
            </Link>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-3">
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











