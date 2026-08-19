import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ExternalLink, Mail, MapPinned, Phone, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { OrganizerBadges, type OrganizerBadgeType } from "@/components/badges/organizer-badges";
import { EventCardVisual } from "@/components/events/event-carousel-section";
import type { PublicEvent } from "@/components/events/public-event-list";
import { FacilitatorReminderMessage } from "@/components/facilitator/facilitator-reminder-message";
import { PastEventsSection } from "@/components/facilitator/past-events-section";
import { ProfileIdentityHeader } from "@/components/facilitator/profile-identity-header";
import { PublicFacilitatorGallery } from "@/components/facilitator/public-facilitator-gallery";
import { ShareFacilitatorButton } from "@/components/facilitator/share-facilitator-button";
import { PublicReturnLink } from "@/components/public/public-return-link";

type Category = {
  colorHex?: string | null;
  name: string;
};

type ContactLink = {
  href: string;
  label: string;
};

type GalleryImage = {
  altText?: string | null;
  imagePath?: string | null;
  url: string;
};

type PublicFacilitatorProfileProps = {
  backLink: {
    href: string;
    label: string;
  };
  badges: OrganizerBadgeType[];
  categories: Category[];
  contact: {
    city?: string | null;
    country?: string | null;
    email?: string | null;
    isOnline?: boolean | null;
    links: ContactLink[];
    phone?: string | null;
    region?: string | null;
  };
  coverImage: {
    altText: string;
    isFallback: boolean;
    objectPositionDesktop?: string;
    objectPositionMobile?: string;
    url: string;
  };
  events: PublicEvent[];
  eventReturnTo?: string | null;
  facilitatorId: string;
  facilitatorSlug?: string | null;
  galleryImages: GalleryImage[];
  hostReferenceId?: string | null;
  name: string;
  pastEvents?: PublicEvent[];
  presentationText?: string | null;
  profileImageUrl?: string | null;
  reminderFormAction: (formData: FormData) => Promise<void>;
  serviceDescription?: string | null;
  specialty?: string | null;
  showFallbackNotice?: boolean;
};

function locationText(contact: PublicFacilitatorProfileProps["contact"]) {
  if (contact.isOnline) return "Online arrangør";
  return [contact.city, contact.region, contact.country].filter(Boolean).join(", ") || null;
}

function SectionTitle({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <div>
      {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#7A5D91]">{eyebrow}</p> : null}
      <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight text-[#2F2437] sm:text-4xl">{title}</h2>
    </div>
  );
}

function FacilitatorEvents({ events, returnTo }: { events: PublicEvent[]; returnTo?: string | null }) {
  if (events.length === 0) {
    return (
      <section className="rounded-[32px] border border-[#E8DEC9] bg-[#FFF9EC] p-6 shadow-[0_18px_45px_rgba(47,36,55,0.06)] sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <SectionTitle eyebrow="Events" title="Kommende events" />
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6E6475]">
              Der er ingen planlagte events lige nu. Tilmeld dig en påmindelse, hvis du vil høre, når der kommer nye datoer.
            </p>
          </div>
          <Sparkles className="size-9 text-[#B56F8A]" aria-hidden="true" />
        </div>
      </section>
    );
  }

  const visibleEvents = events.slice(0, 3);

  return (
    <section className="min-w-0 rounded-[32px] border border-[#E5DDEA] bg-white/82 p-6 shadow-[0_18px_45px_rgba(47,36,55,0.07)] sm:p-8">
      <div className="grid min-w-0 gap-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <SectionTitle eyebrow="Events" title="Kommende events" />
          {events.length > 3 ? (
            <Link className="w-fit text-sm font-semibold text-[#7A4EAB] transition hover:text-olive" href="/#events">
              Se alle events ({events.length})
            </Link>
          ) : null}
        </div>
        <p className="max-w-2xl text-sm leading-6 text-[#6E6475]">Find den næste begivenhed og mærk, om den kalder på dig.</p>
      </div>
      <div className="mt-6 grid min-w-0 items-stretch gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {visibleEvents.map((event) => (
          <EventCardVisual event={event} key={event.id} layout="grid" returnTo={returnTo} />
        ))}
      </div>
    </section>
  );
}

export function PublicFacilitatorProfile({
  backLink,
  badges,
  categories,
  contact,
  coverImage,
  events,
  eventReturnTo,
  facilitatorId,
  facilitatorSlug,
  galleryImages,
  hostReferenceId,
  name,
  pastEvents = [],
  presentationText,
  profileImageUrl,
  reminderFormAction,
  serviceDescription,
  showFallbackNotice = false,
  specialty,
}: PublicFacilitatorProfileProps) {
  const place = locationText(contact);
  const hasContact = Boolean(place || contact.email || contact.phone || contact.links.length > 0);

  return (
    <main className="min-h-screen bg-[#FAF8F4] text-[#2F2437]">
      <header className="bg-[#FAF8F4]/92 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8">
          <Link aria-label="SoulEvents.dk forside" href="/">
            <BrandLogo className="h-24 w-24" priority />
          </Link>
          <Suspense
            fallback={
              <Link
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#D8CBE4] bg-white/80 px-4 py-2 text-sm font-semibold text-[#6E5285] transition hover:border-[#7A5D91] hover:text-[#5B4778]"
                href={backLink.href}
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                {backLink.label}
              </Link>
            }
          >
            <PublicReturnLink
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#D8CBE4] bg-white/80 px-4 py-2 text-sm font-semibold text-[#6E5285] transition hover:border-[#7A5D91] hover:text-[#5B4778]"
              currentPath={eventReturnTo || backLink.href}
              fallbackHref={backLink.href}
              fallbackLabel={backLink.label}
            />
          </Suspense>
        </div>
      </header>

      <section className="mx-auto max-w-[1440px] px-5 pb-10 sm:px-8 lg:pb-14">
        <ProfileIdentityHeader
          badges={badges}
          categories={categories}
          coverImage={coverImage}
          hostReferenceId={hostReferenceId}
          name={name}
          place={place}
          profileImageUrl={profileImageUrl}
          specialty={specialty}
        />
      </section>

      <section className="mx-auto grid max-w-[1440px] min-w-0 gap-8 px-5 pb-16 sm:px-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 gap-8">
          <FacilitatorEvents events={events} returnTo={eventReturnTo} />

          <PastEventsSection events={pastEvents} returnTo={eventReturnTo} />

          {presentationText ? (
            <section className="rounded-[32px] border border-[#E8DEC9] bg-[#FFFDF8] p-7 shadow-[0_18px_45px_rgba(47,36,55,0.06)] sm:p-10">
              <SectionTitle eyebrow="Mød arrangøren" title="Mit univers" />
              <div className="mt-6 max-w-3xl whitespace-pre-line text-base leading-8 text-[#5E5662]">
                {presentationText}
              </div>
              {badges.length > 0 ? (
                <div className="mt-7">
                  <OrganizerBadges badges={badges} />
                </div>
              ) : null}
            </section>
          ) : null}

          {serviceDescription ? (
            <section className="rounded-[32px] border border-[#D8CBE4] bg-[#F4F0F7] p-7 sm:p-8">
              <SectionTitle eyebrow="Individuelle ydelser" title="Mine ydelser" />
              <p className="mt-5 max-w-3xl whitespace-pre-line text-base leading-8 text-[#5E5662]">{serviceDescription}</p>
            </section>
          ) : null}

          <PublicFacilitatorGallery images={galleryImages} />
        </div>

        <aside className="grid min-w-0 content-start gap-5 xl:sticky xl:top-6">
          {hasContact ? (
            <section className="rounded-[30px] border border-[#E5DDEA] bg-white/86 p-6 shadow-[0_18px_45px_rgba(47,36,55,0.06)]">
              <h2 className="font-serif text-3xl font-semibold text-[#2F2437]">Kontakt</h2>
              <div className="mt-5 grid gap-3 text-sm text-[#6E6475]">
                {place ? (
                  <div className="flex gap-2">
                    <MapPinned className="mt-0.5 size-4 shrink-0 text-[#7A5D91]" aria-hidden="true" />
                    <span>{place}</span>
                  </div>
                ) : null}
                {contact.email ? (
                  <a className="inline-flex items-center gap-2 font-semibold text-[#6E5285] transition hover:text-[#B56F8A]" href={"mailto:" + contact.email}>
                    <Mail className="size-4" aria-hidden="true" />
                    {contact.email}
                  </a>
                ) : null}
                {contact.phone ? (
                  <a className="inline-flex items-center gap-2 font-semibold text-[#6E5285] transition hover:text-[#B56F8A]" href={"tel:" + contact.phone}>
                    <Phone className="size-4" aria-hidden="true" />
                    {contact.phone}
                  </a>
                ) : null}
                {contact.links.map((link) => (
                  <a className="inline-flex items-center gap-2 font-semibold text-[#6E5285] transition hover:text-[#B56F8A]" href={link.href} key={link.label} rel="noreferrer" target="_blank">
                    <ExternalLink className="size-4" aria-hidden="true" />
                    {link.label}
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          <ShareFacilitatorButton facilitatorId={facilitatorId} facilitatorName={name} facilitatorSlug={facilitatorSlug} />

          <section className="scroll-mt-8 rounded-[30px] border border-[#D8CBE4] bg-[#F4F0F7] p-6 shadow-[0_18px_45px_rgba(47,36,55,0.06)]" id="reminder-signup">
            <h2 className="font-serif text-3xl font-semibold text-[#2F2437]">Følg nye events</h2>
            <p className="mt-3 text-sm leading-6 text-[#6E6475]">
              Få en rolig påmindelse på e-mail, når denne arrangør opretter et nyt event.
            </p>
            <Suspense fallback={null}>
              <FacilitatorReminderMessage />
            </Suspense>
            <form action={reminderFormAction} className="mt-4 grid gap-3">
              <label className="sr-only" htmlFor="reminder-email">
                E-mail til påmindelse
              </label>
              <input
                className="h-12 rounded-full border border-[#D8CBE4] bg-white px-4 text-base outline-none transition focus:border-[#7A4EAB] focus:ring-4 focus:ring-[#EDE4F7]"
                id="reminder-email"
                name="email"
                placeholder="din@email.dk"
                required
                type="email"
              />
              <button className="inline-flex h-12 items-center justify-center rounded-full bg-[#7A5D91] px-6 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-[#6E5285]" type="submit">
                Tilmeld påmindelse
              </button>
            </form>
          </section>

          {showFallbackNotice && coverImage.isFallback ? (
            <p className="rounded-[20px] border border-[#D8CBE4] bg-[#F1EAF5] px-4 py-3 text-sm leading-6 text-[#6E5285]">
              Du bruger i øjeblikket SoulEvents&apos; standardbillede. Upload dine egne stemningsbilleder for at gøre din profil mere personlig.
            </p>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
