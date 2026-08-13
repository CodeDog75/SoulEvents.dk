import {
  ArrowRight,
  Bell,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  Eye,
  Inbox,
  Leaf,
  PauseCircle,
  PencilLine,
  Ticket,
  XCircle,
} from "lucide-react";
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  markFacilitatorAdminMessagesReadAction,
  sendFacilitatorProfileToReviewAction,
} from "@/app/facilitator/actions";
import { updateEventStatusAction, copyEventAsDraftAction, deleteDraftEventAction } from "@/app/facilitator/events/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { MoonPhase } from "@/components/dashboard/moon-phase";
import { DashboardGreeting } from "@/components/facilitator/dashboard-greeting";
import { CancelEventAction } from "@/components/facilitator/events/cancel-event-action";
import { DashboardEventVisibilityAction } from "@/components/facilitator/events/dashboard-event-visibility-action";
import { ProfileIdentityHeader } from "@/components/facilitator/profile-identity-header";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireRole } from "@/lib/auth/roles";
import { getReservedEventSeatsByEventId } from "@/lib/events/capacity";
import { formatDanishEventDateTime } from "@/lib/events/date-format";
import { draftLimitMessage, getFacilitatorEventLimitStatus } from "@/lib/events/event-limits";
import { getDraftPublishReadiness } from "@/lib/events/draft-publish-readiness";
import { getUserFacingEventStatus, getUserFacingEventStatusLabel, isEventPastEnd } from "@/lib/events/user-facing-status";
import { resolveFacilitatorHero } from "@/lib/facilitators/hero-collection";
import { resolveFacilitatorMoodImage, withFacilitatorMoodImageFallback } from "@/lib/facilitators/mood-image-fallback";
import { getFacilitatorOnboardingStateForProfile } from "@/lib/facilitators/onboarding-state";
import { parseProfileChangeRequest, type ProfileChangeRequest } from "@/lib/facilitators/profile-change-request";
import { getFacilitatorProfileReadiness } from "@/lib/facilitators/profile-readiness";
import { facilitatorWorkAreaSlugSet } from "@/lib/facilitators/work-areas";
import { getFacilitatorUnreadAdminMessageCount } from "@/lib/facilitator/dashboard-data";
import { hasStandardPaymentMethod, paymentSettingsToInstructionsRecord } from "@/lib/payment-instructions";
import { publicEventPath, publicFacilitatorPath } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMoonData, type MoonData } from "@/lib/weather/moon-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type FacilitatorPageProps = {
  searchParams: Promise<{
    message?: string;
    tab?: string;
  }>;
};

type CategoryRelation = {
  categories?: { name: string; slug?: string; color_hex?: string } | { name: string; slug?: string; color_hex?: string }[] | null;
};

type MoodImage = {
  image_path: string;
  alt_text: string | null;
  sort_order: number;
};

type DashboardMoodImage = {
  altText?: string | null;
  isFallback?: boolean;
  sortOrder?: number | null;
  url: string;
};

type ProfileReadiness = {
  isComplete: boolean;
  label: string;
  message: string;
  missingItems: string[];
  tone: "building" | "ready" | "paused";
};

type DashboardAction = {
  description: string;
  href: string;
  icon: React.ElementType;
  isDisabled?: boolean;
  label: string;
  title: string;
};

type EventTab = "drafts" | "active" | "held" | "cancelled" | "hidden";

const eventTabs: Array<{ emptyText: string; key: EventTab; label: string; title: string }> = [
  {
    emptyText: "Du har ingen kladder endnu.",
    key: "drafts",
    label: "Kladder",
    title: "Kladder",
  },
  {
    emptyText: "Du har ingen aktive events lige nu.",
    key: "active",
    label: "Aktive",
    title: "Mine kommende events",
  },
  {
    emptyText: "Du har ingen afholdte events endnu.",
    key: "held",
    label: "Afholdte",
    title: "Afholdte events",
  },
  {
    emptyText: "Du har ingen aflyste events.",
    key: "cancelled",
    label: "Aflyste",
    title: "Aflyste events",
  },
  {
    emptyText: "Du har ingen arkiverede events.",
    key: "hidden",
    label: "Arkiverede",
    title: "Arkiverede events",
  },
];

function normalizeEventTab(value?: string | null): EventTab {
  return eventTabs.some((tab) => tab.key === value) ? (value as EventTab) : "active";
}

function eventTabHref(tab: EventTab) {
  return `/facilitator?tab=${tab}#mine-events`;
}

const dashboardEventSelect =
  "id, slug, title, status, starts_at, ends_at, created_at, updated_at, dashboard_hidden_at, address_line, postal_code, city, country, long_description, cover_image_path, event_format, online_url_or_note, price_cents, capacity, registration_mode, event_reference_id, event_categories(categories(name)), event_main_categories(main_category_id), event_tags(tag_id), event_payment_settings(method_source, payment_link_mode)";

const dashboardEventSelectWithoutVisibility =
  "id, slug, title, status, starts_at, ends_at, created_at, updated_at, address_line, postal_code, city, country, long_description, cover_image_path, event_format, online_url_or_note, price_cents, capacity, registration_mode, event_reference_id, event_categories(categories(name)), event_main_categories(main_category_id), event_tags(tag_id), event_payment_settings(method_source, payment_link_mode)";

const statusStyles: Record<string, string> = {
  draft: "bg-[#E9E6E1] text-[#6A6258]",
  pending_review: "bg-[#FFF7E8] text-[#8A6A2E]",
  active: "bg-[#DDE8D7] text-[#4E6A45]",
  rejected: "bg-red-50 text-red-800",
  sold_out: "bg-[#F4F0F7] text-[#6E5A86]",
  cancelled: "bg-red-50 text-red-800",
  completed: "bg-[#F7F1EA] text-[#756758]",
  archived: "bg-stone-500 text-white",
  held: "bg-[#F7F1EA] text-[#756758]",
};

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isMissingDashboardVisibilityColumn(error: { code?: string; message?: string } | null) {
  return error?.code === "42703" || Boolean(error?.message?.includes("dashboard_hidden_at"));
}

function usesExternalRegistration(event: {
  event_payment_settings?:
    | Array<{ method_source?: string | null; payment_link_mode?: string | null }>
    | { method_source?: string | null; payment_link_mode?: string | null }
    | null;
  price_cents?: number | null;
  registration_mode?: string | null;
}) {
  const paymentSettings = first(event.event_payment_settings);
  return (
    (event.price_cents ?? 0) > 0 &&
    event.registration_mode === "direct" &&
    paymentSettings?.method_source === "custom" &&
    paymentSettings.payment_link_mode === "external_registration"
  );
}

async function getDashboardEvents(supabase: ReturnType<typeof createAdminClient>, facilitatorId: string) {
  const withReservedSeats = async (events: any[]) => {
    const reservedSeatsByEventId = await getReservedEventSeatsByEventId(
      supabase,
      events.map((event) => event.id).filter((eventId): eventId is string => Boolean(eventId)),
    );

    return events.map((event) => ({
      ...event,
      reserved_seats: reservedSeatsByEventId.get(event.id) ?? 0,
    }));
  };

  const eventQuery = (select: string) =>
    supabase
      .from("events")
      .select(select)
      .eq("facilitator_id", facilitatorId)
      .order("starts_at", { ascending: false });

  const result = await eventQuery(dashboardEventSelect);

  if (!result.error) {
    return withReservedSeats(result.data ?? []);
  }

  if (!isMissingDashboardVisibilityColumn(result.error)) {
    console.error("[facilitator-dashboard] Events could not be loaded", {
      code: result.error.code,
      details: result.error.details,
      facilitatorId,
      hint: result.error.hint,
      message: result.error.message,
    });
    return [];
  }

  console.warn("[facilitator-dashboard] dashboard_hidden_at is missing; showing legacy dashboard events", {
    facilitatorId,
  });

  const fallback = await eventQuery(dashboardEventSelectWithoutVisibility);

  if (fallback.error) {
    console.error("[facilitator-dashboard] Legacy events could not be loaded", {
      code: fallback.error.code,
      details: fallback.error.details,
      facilitatorId,
      hint: fallback.error.hint,
      message: fallback.error.message,
    });
    return [];
  }

  return withReservedSeats(
    ((fallback.data ?? []) as any[]).map((event) => ({
      ...event,
      dashboard_hidden_at: null,
    })),
  );
}

function formatDate(value: string) {
  return formatDanishEventDateTime(value);
}

function formatDateTime(value: string | null | undefined) {
  return formatDanishEventDateTime(value);
}

function statusClass(status: string) {
  return statusStyles[status] ?? "bg-stone-100 text-stone-700";
}

function isPastEvent(event: { ends_at?: string | null; starts_at: string; status: string }, now: Date) {
  return getUserFacingEventStatus(event, now) === "held" || event.status === "cancelled";
}

function isHeldArchiveEvent(event: { ends_at?: string | null; starts_at: string; status: string }, now: Date) {
  return event.status !== "cancelled" && getUserFacingEventStatus(event, now) === "held";
}

function isCancelledArchiveEvent(event: { status: string }) {
  return event.status === "cancelled";
}

function isCurrentPublicCoOrganizerEvent(
  event:
    | {
        ends_at?: string | null;
        facilitator_profiles?:
          | {
              is_disabled?: boolean | null;
              is_paused?: boolean | null;
              status?: string | null;
            }
          | Array<{
              is_disabled?: boolean | null;
              is_paused?: boolean | null;
              status?: string | null;
            }>
          | null;
        id?: string | null;
        starts_at?: string | null;
        status?: string | null;
      }
    | null
    | undefined,
  now: Date,
) {
  if (!event?.id || !event.status) return false;

  const owner = first(event.facilitator_profiles);
  const ownerCanShowPublicEvents =
    owner?.status === "approved" && !owner.is_paused && !owner.is_disabled;
  const eventStatus = getUserFacingEventStatus(
    {
      ends_at: event.ends_at,
      starts_at: event.starts_at,
      status: event.status,
    },
    now,
  );

  return ownerCanShowPublicEvents && (eventStatus === "active" || eventStatus === "sold_out");
}

function eventEndDate(event: { ends_at?: string | null; starts_at: string }) {
  return new Date(event.ends_at ?? event.starts_at);
}

function isOlderThanMonths(value: Date, now: Date, months: number) {
  const threshold = new Date(value);
  threshold.setMonth(threshold.getMonth() + months);
  return threshold < now;
}

function normalizeSpecialtyText(input: string | null | undefined) {
  return (input ?? "").replace(/\s+/g, " ").trim();
}

function getProfileReadiness({
  categoryCount,
  facilitatorProfile,
  fullName,
}: {
  categoryCount: number;
  facilitatorProfile: any;
  fullName?: string | null;
}): ProfileReadiness {
  const missingItems = [];
  const readiness = getFacilitatorProfileReadiness({
    categoryIds: Array.from({ length: categoryCount }, (_, index) => String(index)),
    companyName: facilitatorProfile?.company_name,
    fullName,
    shortDescription: facilitatorProfile?.long_description || facilitatorProfile?.short_description,
  });

  if (readiness.missing.includes("company_name")) {
    missingItems.push("Profilnavn");
  }

  if (readiness.missing.includes("full_name")) {
    missingItems.push("Navn");
  }

  if (readiness.missing.includes("short_description")) {
    missingItems.push("Kort præsentation");
  }

  if (!facilitatorProfile?.profile_image_path) {
    missingItems.push("Profilbillede");
  }

  if (readiness.missing.includes("categories")) {
    missingItems.push("Mindst én kategori");
  }

  if (facilitatorProfile?.is_paused) {
    return {
      isComplete: missingItems.length === 0,
      label: "Profil på pause",
      message: "Din profil er midlertidigt skjult. Du kan redigere den og kontakte SoulEvents, når du vil være synlig igen.",
      missingItems,
      tone: "paused",
    };
  }

  if (missingItems.length > 0) {
    return {
      isComplete: false,
      label: "Profil under opbygning",
      message: "Der mangler nogle få oplysninger, før du kan oprette og offentliggøre events.",
      missingItems,
      tone: "building",
    };
  }

  return {
    isComplete: true,
    label: facilitatorProfile?.status === "approved" ? "Profil klar og synlig" : "Profil klar",
    message:
      facilitatorProfile?.status === "approved"
        ? "Din profil er synlig på SoulEvents. Du kan nu holde fokus på events, tilmeldinger og deltagere."
        : "Din profil indeholder de nødvendige oplysninger. Mens vi gennemgår den, kan du gøre dit første event klar.",
    missingItems: [],
    tone: "ready",
  };
}

function getDashboardAction({
  draftEvents,
  maxDraftEvents,
  profileReadiness,
}: {
  draftEvents: any[];
  maxDraftEvents: number;
  profileReadiness: ProfileReadiness;
}): DashboardAction {
  if (profileReadiness.tone === "paused") {
    return {
      description: "Din profil er på pause. Rediger profilen eller kontakt SoulEvents, når du ønsker at vende tilbage.",
      href: "/facilitator/profile",
      icon: PauseCircle,
      label: "Ret profil",
      title: "Profilen er på pause",
    };
  }

  if (!profileReadiness.isComplete) {
    return {
      description: "Udfyld resten, når du er klar. Profilen bliver først offentlig, når den er sendt til godkendelse og godkendt.",
      href: "/facilitator/profile",
      icon: PencilLine,
      label: "Færdiggør profil",
      title: "Din profil er ikke færdig endnu",
    };
  }

  if (draftEvents.length >= maxDraftEvents) {
    return {
      description: draftLimitMessage(maxDraftEvents),
      href: "/facilitator/events",
      icon: CalendarPlus,
      isDisabled: true,
      label: "Kladdegrænse nået",
      title: "Grænsen for kladder er nået",
    };
  }

  return {
    description: "Skab et nyt event og invitér mennesker ind i nærvær, fællesskab og udvikling.",
    href: "/facilitator/events",
    icon: CalendarPlus,
    label: "Opret event",
    title: "Invitér til en oplevelse",
  };
}

const dashboardHeroMessages = [
  "Tak fordi du skaber rum for nærvær og personlig udvikling.",
  "Dit arbejde gør det lettere for mennesker at finde ro og fællesskab.",
  "Små rum med nærvær kan betyde meget for dem, der træder ind.",
  "Du bygger oplevelser, hvor mennesker kan lande lidt blødere.",
  "Når du samler mennesker, skaber du mere end et event.",
  "Din energi og dit håndværk gør SoulEvents mere levende.",
  "Tak fordi du deler det, du brænder for, med andre.",
  "Et godt event begynder ofte med et stille, klart fokus.",
  "Du er med til at gøre lokale oplevelser lettere at finde.",
  "Nærvær bliver stærkere, når det får et sted at blive delt.",
  "Dine events kan blive begyndelsen på nye forbindelser.",
  "Her kan du samle trådene og gøre plads til det vigtige.",
  "Et roligt overblik giver mere energi til deltagerne.",
  "Din profil og dine events hjælper flere med at finde vej til dig.",
  "Tak fordi du skaber oplevelser med omtanke og hjerte.",
  "Det, du inviterer til, kan give andre et vigtigt pusterum.",
  "SoulEvents er dit arbejdsrum til at dele nærvær med flere.",
  "Din næste oplevelse kan allerede være på vej til de rette mennesker.",
  "Når rammerne er enkle, bliver der mere plads til indholdet.",
  "Du skaber steder, hvor mennesker kan mødes med mere ro.",
  "Tak fordi du gør dit virke synligt og tilgængeligt.",
  "Overblik i dag giver mere nærvær, når deltagerne ankommer.",
  "Dine erfaringer fortjener en rolig og professionel ramme.",
  "Hver invitation er en mulighed for at samle de rigtige mennesker.",
  "Det personlige møde begynder længe før eventdagen.",
  "Du gør det lettere for deltagere at vælge med tillid.",
  "Dit dashboard er her for at støtte det arbejde, du allerede gør.",
  "Et klart næste skridt kan skabe mere ro i hele eventflowet.",
  "Tak fordi du er med til at forme SoulEvents fra begyndelsen.",
  "Dine events hjælper mennesker med at finde oplevelser, der passer til dem.",
];

const dashboardHeroQuotes = [
  "Små møder kan skabe store forandringer.",
  "Ro er også en måde at bevæge sig fremad på.",
  "Det vigtigste begynder ofte i det enkle.",
  "Nærvær vokser, når der er plads til det.",
  "Et trygt rum kan åbne nye veje.",
  "Gode oplevelser starter med klarhed.",
  "Fællesskab begynder med en invitation.",
  "Det rolige overblik giver mere mod.",
  "Mennesker finder vej, når døren står åben.",
  "Et øjebliks nærvær kan række langt.",
  "Det du deler, kan lande hos den rette.",
  "Omsorg kan mærkes i detaljerne.",
  "Et event er også en fortælling om tillid.",
  "Det levende fællesskab bygges ét møde ad gangen.",
  "Din tydelighed hjælper andre med at vælge.",
  "Der er kraft i det, der føles enkelt.",
  "Et varmt rum begynder med en klar intention.",
  "Når noget er let at finde, kan flere deltage.",
  "Din praksis får mere liv, når den bliver delt.",
  "Det næste skridt må gerne være roligt.",
  "God energi trives i gode rammer.",
  "Nye begyndelser kan være helt stille.",
  "Et nærværende event bliver husket i kroppen.",
  "Når du samler mennesker, skaber du mulighed.",
  "Det professionelle kan godt føles varmt.",
  "Mere overskud giver bedre møder.",
  "Det rette rum kan gøre en stor forskel.",
  "Deltagere mærker, når rammen er tryg.",
  "En klar invitation gør valget lettere.",
  "Der er skønhed i det enkle overblik.",
  "Gode rammer giver plads til dybde.",
  "Det, du skaber, kan blive et vendepunkt.",
  "Mennesker søger steder, hvor de kan lande.",
  "Et fællesskab starter ofte med én tilmelding.",
  "Tydelighed er en gave til deltageren.",
  "Din ro kan smitte hele eventflowet.",
  "Det små kan være det mest virkningsfulde.",
  "Et varmt velkommen kan mærkes længe.",
  "Din synlighed hjælper de rette mennesker.",
  "Overblik er en form for omsorg.",
  "Når arbejdet er samlet, bliver hjertet friere.",
  "Nærvær kræver ikke støj for at blive set.",
  "Et enkelt valg kan åbne en ny dør.",
  "Det, du tilbyder, kan være præcis det nogen søger.",
  "Gode oplevelser fortjener gode rammer.",
  "Din invitation kan blive en andens pause.",
  "Tillid vokser, når rammen er tydelig.",
  "Mere ro i systemet giver mere liv i mødet.",
  "Et event kan være starten på noget større.",
  "SoulEvents vokser med de rum, du skaber.",
];

const dashboardHeroBackground = "/images/facilitator-heroes/soulevents-dashboard-hero.png";

function deterministicIndex(date: Date, length: number, salt = 0) {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86_400_000);
  return Math.abs(dayOfYear + salt) % length;
}

function DashboardGreetingIntro({
  moonData,
  name,
  profileReadiness,
}: {
  moonData: MoonData;
  name: string | null;
  profileReadiness: ProfileReadiness;
}) {
  const today = new Date();
  const heroMessage = dashboardHeroMessages[deterministicIndex(today, dashboardHeroMessages.length)];
  const heroQuote = dashboardHeroQuotes[deterministicIndex(today, dashboardHeroQuotes.length, 17)];

  return (
    <section
      className="relative min-h-[430px] overflow-hidden rounded-[32px] border border-white/20 bg-[#2F2437] px-6 py-8 text-white shadow-[0_24px_70px_rgba(47,36,55,0.16)] sm:min-h-[450px] sm:px-8 sm:py-9 lg:min-h-[460px] lg:px-10 lg:py-10"
      style={{
        backgroundImage:
          "linear-gradient(105deg, rgba(13,12,27,0.78) 0%, rgba(38,30,63,0.74) 28%, rgba(48,39,76,0.48) 54%, rgba(25,25,46,0.6) 100%), radial-gradient(circle at 82% 34%, rgba(93,77,138,0.22), transparent 34%), url('" +
          dashboardHeroBackground +
          "')",
        backgroundPosition: "center bottom",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(47,36,55,0.1))]" />
      <div className="relative z-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
        <div className="max-w-2xl">
          <div>
            <h1 className="max-w-3xl font-serif text-3xl font-medium leading-[1.1] text-white drop-shadow-sm sm:text-[2.65rem]">
              <DashboardGreeting name={name} />
            </h1>
            <p className="mt-5 max-w-xl text-sm font-normal leading-7 text-white/80 sm:text-base">{heroMessage}</p>
            <p className="mt-7 max-w-lg text-sm font-light italic leading-7 text-white/68 sm:text-[0.95rem]">
              {heroQuote}
            </p>
            {!profileReadiness.isComplete && profileReadiness.missingItems.length > 0 ? (
              <p className="mt-7 max-w-2xl rounded-[18px] border border-white/12 bg-white/10 px-4 py-3 text-sm font-semibold leading-6 text-white/86 backdrop-blur-md">
                Mangler: {profileReadiness.missingItems.join(", ")}
              </p>
            ) : null}
          </div>
        </div>

        <aside className="text-center text-white">
          <p className="text-sm font-medium text-white/62">Månen i nat</p>
          <MoonPhase
            className="mt-5 [--moon-size:132px] sm:[--moon-size:150px] lg:[--moon-size:188px]"
            illumination={moonData.illumination}
            phase={moonData.phase}
            size={156}
          />
          <div className="mt-5 grid gap-1 text-center text-sm text-white/68">
            <p className="font-semibold text-white">{moonData.phaseDanish}</p>
            <p className="text-white/78">
              <span className="font-semibold text-white">{moonData.illumination} %</span> oplyst
            </p>
            <p className="text-xs text-white/56">
              Op {moonData.moonrise ?? "ikke synlig"}
              {moonData.moonset ? " · Ned " + moonData.moonset : ""}
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function DashboardHeaderActions({
  fullProfileHref,
  primaryAction,
}: {
  fullProfileHref?: string | null;
  primaryAction: DashboardAction;
}) {
  const Icon = primaryAction.icon;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      {primaryAction.isDisabled ? (
        <p className="rounded-[18px] border border-[#D8CBE4] bg-[#F1EAF5] px-4 py-3 text-sm font-semibold text-[#6E5285]">
          {primaryAction.description}
        </p>
      ) : (
        <Link
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#7A5D91] px-6 text-sm font-semibold text-white shadow-soft transition duration-200 hover:-translate-y-0.5 hover:bg-[#6E5285] hover:shadow-[0_14px_32px_rgba(47,36,55,0.16)]"
          href={primaryAction.href}
        >
          <Icon className="size-4" aria-hidden="true" />
          {primaryAction.label}
        </Link>
      )}
      <Link
        className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[#D8CBE4] bg-white/82 px-5 text-sm font-semibold text-[#6E5285] shadow-soft transition duration-200 hover:-translate-y-0.5 hover:border-[#7A5D91] hover:text-[#5B4778]"
        href="/facilitator/profile"
      >
        <PencilLine className="size-4" aria-hidden="true" />
        Ret profil
      </Link>
      {fullProfileHref ? (
        <Link
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-transparent px-4 text-sm font-semibold text-[#6E6475] transition hover:text-[#7A5D91]"
          href={fullProfileHref}
        >
          <Eye className="size-4" aria-hidden="true" />
          Se som gæst
        </Link>
      ) : null}
    </div>
  );
}

function MoodImageStrip({
  isUsingFallbackMoodImage,
  moodImages,
}: {
  isUsingFallbackMoodImage?: boolean;
  moodImages: DashboardMoodImage[];
}) {
  if (moodImages.length === 0) return null;

  return (
    <section className="rounded-[24px] border border-[#E5DDEA] bg-white/82 p-5 shadow-[0_18px_45px_rgba(47,36,55,0.06)]">
      <p className="text-sm font-semibold text-[#2F2437]">Stemninger</p>
      <div className={"mt-3 grid gap-2 " + (moodImages.length === 1 ? "grid-cols-1" : moodImages.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
        {moodImages.slice(0, 3).map((image, index) => (
          <div className="aspect-[4/3] overflow-hidden rounded-[18px] bg-white shadow-sm" key={image.url}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={image.altText || "Stemningsbillede " + (index + 1)}
              className="h-full w-full object-cover transition duration-500 hover:scale-[1.04]"
              src={image.url}
            />
          </div>
        ))}
      </div>
      {isUsingFallbackMoodImage ? (
        <p className="mt-3 rounded-[18px] border border-[#D8CBE4] bg-[#F1EAF5] px-3 py-2 text-xs font-semibold leading-5 text-[#6E5285]">
          Du bruger i øjeblikket SoulEvents&apos; standardbillede. Upload dine egne stemningsbilleder for at gøre din profil mere personlig.
        </p>
      ) : null}
    </section>
  );
}

function DashboardSupportAside() {
  return (
    <aside className="w-full space-y-4 lg:self-start">
      <section className="rounded-[24px] border border-[#E5DDEA] bg-white p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-[#DDE8D7] text-[#4E6A45]">
            <Leaf className="size-5" aria-hidden="true" />
          </span>
          <h2 className="font-semibold text-[#2F2437]">Roligt tip</h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#6E6475]">
          Hold eventteksten enkel: hvad skal ske, hvem er det for, og hvad kan deltageren forvente?
        </p>
      </section>
    </aside>
  );
}
function BookingAttentionCard({
  hasActiveEvents,
  missingPaymentCount,
  missingPaymentHref,
}: {
  hasActiveEvents: boolean;
  missingPaymentCount: number;
  missingPaymentHref: string;
}) {
  const hasMissingPayments = missingPaymentCount > 0;

  if (!hasMissingPayments && !hasActiveEvents) {
    return null;
  }

  return (
    <section
      className={
        "rounded-[32px] border p-5 shadow-[0_18px_45px_rgba(47,36,55,0.08)] sm:p-6 " +
        (hasMissingPayments ? "border-[#E8D6A8] bg-[#FFF8E8]" : "border-[#E5DDEA] bg-white")
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span
            className={
              "mt-0.5 grid size-10 shrink-0 place-items-center rounded-full " +
              (hasMissingPayments ? "bg-[#FFF1D6] text-[#8A6A2E]" : "bg-[#DDE8D7] text-[#4E6A45]")
            }
          >
            {hasMissingPayments ? <Inbox className="size-5" aria-hidden="true" /> : <CheckCircle2 className="size-5" aria-hidden="true" />}
          </span>
          <div>
            <h2 className="text-xl font-semibold text-[#2F2437]">Tilmeldinger</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#6E6475]">
              Du kan som arrangør løbende opdatere, hvilke deltagere der har betalt, og hvilke der endnu ikke er registreret som betalt.
            </p>
          </div>
        </div>
        <Link
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#7A5D91] px-5 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-[#6E5285]"
          href={missingPaymentHref}
        >
          Klik her for at opdatere indbetalinger
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function MissingPaymentSettingsCard() {
  return (
    <section className="rounded-[32px] border border-[#D8CBE4] bg-white p-5 shadow-[0_18px_45px_rgba(47,36,55,0.07)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-full bg-[#F4F0F7] text-[#7A4EAB]">
            <CreditCard className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-[#2F2437]">Hvordan skal deltagerne betale?</h2>
            <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-[#6E6475]">
              Gem dine standardbetalingsoplysninger én gang, så du nemt kan genbruge dem på dine events.
            </p>
          </div>
        </div>
        <Link
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[#D8CBE4] bg-[#F7F2FB] px-5 text-sm font-semibold text-[#6E5285] shadow-soft transition hover:-translate-y-0.5 hover:border-[#BFA9CF] hover:bg-[#F1EAF5]"
          href="/facilitator/settings/payment"
        >
          Vælg betalingsmetode
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function ProfileChangesRequestedCard({
  canSubmit,
  request,
}: {
  canSubmit: boolean;
  request: ProfileChangeRequest | null;
}) {
  return (
    <section className="rounded-[32px] border border-[#E8D6A8] bg-[#FFF8E8] p-5 shadow-[0_18px_45px_rgba(47,36,55,0.08)] sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#8A6A2E]">Profil kræver ændringer</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#2F2437]">Din profil kræver et par ændringer</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6E6475]">
            Vi har gennemgået din profil. Ret venligst punkterne herunder, og send profilen til ny godkendelse, når du er klar.
          </p>
          {request?.fields.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {request.fields.map((field) => (
                <span className="rounded-full border border-[#E8D6A8] bg-white/72 px-3 py-1 text-sm font-semibold text-[#6F5A35]" key={field}>
                  {field}
                </span>
              ))}
            </div>
          ) : null}
          {request?.comment ? (
            <blockquote className="mt-4 rounded-[20px] border border-[#E8D6A8] bg-white/70 p-4 text-sm leading-6 text-[#4F4537]">
              {request.comment}
            </blockquote>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
          <Link
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#7A5D91] px-5 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-[#6E5285]"
            href="/facilitator/profile"
          >
            <PencilLine className="size-4" aria-hidden="true" />
            Ret profil
          </Link>
          <form action={sendFacilitatorProfileToReviewAction}>
            <button
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#D8CBE4] bg-white px-5 text-sm font-semibold text-[#6E6475] transition hover:border-[#7A5D91] hover:text-[#7A5D91] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canSubmit}
              type="submit"
            >
              Send til ny godkendelse
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

function StatusAction({
  children,
  eventId,
  isDestructive = false,
  status,
}: {
  children: React.ReactNode;
  eventId: string;
  isDestructive?: boolean;
  status: string;
}) {
  return (
    <form action={updateEventStatusAction}>
      <input name="event_id" type="hidden" value={eventId} />
      <input name="status" type="hidden" value={status} />
      <button
        className={
          "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full border bg-white/70 px-3 text-xs font-semibold transition " +
          (isDestructive
            ? "border-red-200 text-red-800 hover:bg-red-50"
            : "border-[#E5DDEA] text-[#6E5A86] hover:border-[#7A5D91] hover:text-[#7A5D91]")
        }
        type="submit"
      >
        {children}
      </button>
    </form>
  );
}

type DashboardEventVariant = "draft" | "active" | "completed" | "cancelled";

function EventCard({
  event,
  facilitatorStatus,
  isHidden = false,
  isExpiringSoon = false,
  variant,
}: {
  event: any;
  facilitatorStatus?: string | null;
  isHidden?: boolean;
  isExpiringSoon?: boolean;
  variant: DashboardEventVariant;
}) {
  const isExternalRegistration = usesExternalRegistration(event);
  const reservedSeats = event.reserved_seats ?? 0;
  const location = event.event_format === "online" ? "Online" : event.city || "Lokation kommer";
  const isDraft = event.status === "draft";
  const isPendingReview = event.status === "pending_review";
  const userFacingStatus = getUserFacingEventStatus(event);
  const draftReadiness = isDraft
    ? getDraftPublishReadiness({
        event,
        facilitatorStatus,
      })
    : null;
  const isActive = userFacingStatus === "active" || userFacingStatus === "sold_out";
  const isHeld = userFacingStatus === "held";
  const isCancelled = userFacingStatus === "cancelled";
  const isCopyableAsDraft = isDraft || isActive || isHeld || isCancelled || isEventPastEnd(event);

  const variantStyles: Record<DashboardEventVariant, { accent: string; card: string; note: string }> = {
    active: {
      accent: "bg-[#DDE8D7]",
      card: "border-[#D7E4D1] bg-white",
      note: "border-[#CFE3C8] bg-[#F3F7F0] text-[#4F6F48]",
    },
    cancelled: {
      accent: "bg-[#F1D6DE]",
      card: "border-[#E9CED6] bg-[#FFF8FA]",
      note: "border-[#E9CED6] bg-[#FFF1F5] text-[#8B5B68]",
    },
    completed: {
      accent: "bg-[#D8D2CA]",
      card: "border-[#E5DDEA] bg-[#FAF8F4]",
      note: "border-[#E8DEC9] bg-[#FBF5E8] text-[#756758]",
    },
    draft: {
      accent: "bg-[#EBDCC3]",
      card: "border-[#E8DEC9] bg-[#FFF9EC]",
      note: "border-[#E8DEC9] bg-[#FBF5E8] text-[#6F5A35]",
    },
  };

  const currentStyle = variantStyles[variant];
  const statusMessage = draftReadiness
    ? draftReadiness.canPublish
      ? "Klar til offentliggørelse"
      : `${draftReadiness.checklist.filter((item) => !item.valid).length} ting mangler før offentliggørelse`
    : variant === "active"
      ? "Klar til tilmeldinger"
      : variant === "completed"
        ? "Afsluttet event"
        : variant === "cancelled"
          ? "Eventet er aflyst"
          : null;

  return (
    <article className={"relative overflow-hidden rounded-[28px] border p-5 shadow-[0_16px_38px_rgba(47,36,55,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(47,36,55,0.12)] " + currentStyle.card}>
      <div className={"absolute inset-x-0 top-0 h-1.5 " + currentStyle.accent} />
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap gap-2">
          {isHidden ? (
            <span className={"rounded-full px-3 py-1 text-xs font-semibold " + statusClass("archived")}>
              Arkiveret
            </span>
          ) : null}
          <span className={"rounded-full px-3 py-1 text-xs font-semibold " + statusClass(userFacingStatus)}>
            {getUserFacingEventStatusLabel(userFacingStatus)}
          </span>
        </div>
        {event.event_reference_id ? <span className="text-xs font-semibold text-[#8B7F93]">Ref. {event.event_reference_id}</span> : null}
      </div>
      <h3 className="mt-4 text-xl font-semibold leading-tight text-[#2F2437]">{event.title || "Event uden titel"}</h3>
      <div className="mt-4 grid gap-2 text-sm leading-5 text-[#6E6475]">
        <p className="inline-flex items-center gap-2">
          <CalendarDays className="size-4 text-[#7A5D91]" aria-hidden="true" />
          {formatDate(event.starts_at)}
        </p>
        <p className="inline-flex items-center gap-2">
          <Leaf className="size-4 text-[#7A5D91]" aria-hidden="true" />
          {location}
        </p>
        <p className="inline-flex items-center gap-2">
          <Ticket className="size-4 text-[#7A5D91]" aria-hidden="true" />
          {isExternalRegistration ? "Ekstern tilmelding" : `${reservedSeats} ${reservedSeats === 1 ? "tilmelding" : "tilmeldinger"}`}
        </p>
      </div>
      {statusMessage ? (
        <div className={"mt-5 rounded-[18px] border px-4 py-3 text-sm font-semibold leading-6 " + (draftReadiness?.canPublish ? variantStyles.active.note : currentStyle.note)}>
          {draftReadiness?.canPublish ? "✓ " : ""}
          {statusMessage}
          {isExpiringSoon ? <p className="mt-1 text-xs font-medium">Dette event kan flyttes til arkivet, når du ikke længere ønsker det i oversigten.</p> : null}
        </div>
      ) : null}
      <div className="mt-5 grid gap-3">
        {isHeld || isCancelled ? (
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#7A5D91] px-4 text-sm font-semibold text-white transition hover:bg-[#6E4F86]"
              href={publicEventPath(event.slug || event.id) + "?return_to=/facilitator"}
            >
              Se detaljer
            </Link>
            {isHidden ? (
              <Link
                className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[#E5DDEA] bg-white px-4 text-sm font-semibold text-[#2F2437] transition hover:border-[#7A5D91] hover:text-[#7A5D91]"
                href={"/facilitator/events?draft=" + event.id}
              >
                <PencilLine className="size-4" aria-hidden="true" />
                Rediger
              </Link>
            ) : null}
            {isCopyableAsDraft ? (
              <form action={copyEventAsDraftAction}>
                <input name="event_id" type="hidden" value={event.id} />
                <button className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[#E5DDEA] bg-white px-4 text-sm font-semibold text-[#2F2437] transition hover:border-[#7A5D91] hover:text-[#7A5D91]" type="submit">
                  <Copy className="size-4" aria-hidden="true" />
                  Kopiér som nyt event
                </button>
              </form>
            ) : null}
            <DashboardEventVisibilityAction
              eventId={event.id}
              eventTitle={event.title || "Event uden titel"}
              mode={isHidden ? "restore" : "hide"}
            />
          </div>
        ) : isDraft || isPendingReview ? (
          <>
            <Link
              className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#7A5D91] px-4 text-sm font-semibold text-white transition hover:bg-[#6E4F86]"
              href={"/facilitator/events?draft=" + event.id}
            >
              <PencilLine className="size-4" aria-hidden="true" />
              Fortsæt redigering
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <form action={copyEventAsDraftAction}>
                <input name="event_id" type="hidden" value={event.id} />
                <button className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[#E5DDEA] bg-white/70 px-3 text-xs font-semibold text-[#6E5A86] transition hover:border-[#7A5D91] hover:text-[#7A5D91]" type="submit">
                  <Copy className="size-3.5" aria-hidden="true" />
                  Kopiér som nyt event
                </button>
              </form>
              {isDraft ? (
                <form action={deleteDraftEventAction}>
                  <input name="event_id" type="hidden" value={event.id} />
                  <button className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-red-200 bg-white/70 px-3 text-xs font-semibold text-red-800 transition hover:bg-red-50" type="submit">
                    <XCircle className="size-3.5" aria-hidden="true" />
                    Slet kladde
                  </button>
                </form>
              ) : null}
              {isPendingReview ? (
                <StatusAction eventId={event.id} status="draft">
                  <XCircle className="size-3.5" aria-hidden="true" />
                  Fortryd indsendelse
                </StatusAction>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <Link
              className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#7A5D91] px-4 text-sm font-semibold text-white transition hover:bg-[#6E4F86]"
              href={"/facilitator/bookings?event=" + event.id}
            >
              <Inbox className="size-4" aria-hidden="true" />
              Se tilmeldinger
            </Link>
            <div className="grid min-w-0 gap-2">
              <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.45fr)]">
                <Link
                  className="inline-flex h-9 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-[#E5DDEA] bg-white/70 px-2.5 text-xs font-semibold text-[#6E5A86] transition hover:border-[#7A5D91] hover:text-[#7A5D91] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A5D91]"
                  href={publicEventPath(event.slug || event.id) + "?return_to=/facilitator/events"}
                >
                  <Eye className="size-3.5" aria-hidden="true" />
                  <span>Se event</span>
                </Link>
                <Link
                  className="inline-flex h-9 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-[#E5DDEA] bg-white/70 px-2.5 text-xs font-semibold text-[#6E5A86] transition hover:border-[#7A5D91] hover:text-[#7A5D91] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A5D91]"
                  href={"/facilitator/events?draft=" + event.id}
                >
                  <PencilLine className="size-3.5" aria-hidden="true" />
                  <span>Rediger</span>
                </Link>
                {isCopyableAsDraft ? (
                  <form action={copyEventAsDraftAction} className="col-span-2 min-w-0 sm:col-span-1">
                    <input name="event_id" type="hidden" value={event.id} />
                    <button className="inline-flex h-9 w-full min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-[#E5DDEA] bg-white/70 px-2.5 text-xs font-semibold text-[#6E5A86] transition hover:border-[#7A5D91] hover:text-[#7A5D91] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A5D91]" type="submit">
                      <Copy className="size-3.5" aria-hidden="true" />
                      Kopiér som nyt event
                    </button>
                  </form>
                ) : null}
              </div>
              <CancelEventAction className="w-full" eventId={event.id} eventTitle={event.title || "Event uden titel"} />
            </div>
          </>
        )}
        {isHidden && !isHeld && !isCancelled ? (
          <DashboardEventVisibilityAction
            eventId={event.id}
            eventTitle={event.title || "Event uden titel"}
            mode="restore"
          />
        ) : null}
      </div>
    </article>
  );
}

function EventCountPill({
  href,
  isActive,
  label,
  tone = "default",
  value,
}: {
  href: string;
  isActive: boolean;
  label: string;
  tone?: "archive" | "default";
  value: number;
}) {
  const isArchive = tone === "archive";

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A5D91] " +
        (isArchive
          ? isActive
            ? "border-stone-600 bg-stone-500 text-white"
            : "border-stone-400 bg-stone-500 text-white hover:bg-stone-600"
          : isActive
          ? "border-[#7A5D91] bg-[#F4F0F7] text-[#2F2437]"
          : "border-[#E5DDEA] bg-[#FAF8F4] text-[#6E6475] hover:border-[#7A5D91] hover:text-[#7A5D91]")
      }
      href={href}
    >
      {label}
      <span className={"rounded-full px-2 py-0.5 " + (isArchive ? "bg-white/18 text-white" : "bg-white text-[#7A5D91]")}>{value}</span>
    </Link>
  );
}

function EventGrid({
  events,
  facilitatorStatus,
  id,
  isHidden = false,
  title,
  variant,
}: {
  events: any[];
  facilitatorStatus?: string | null;
  id?: string;
  isHidden?: boolean;
  title: string;
  variant: DashboardEventVariant;
}) {
  if (events.length === 0) return null;

  return (
    <section id={id}>
      {title ? <h3 className="text-lg font-semibold text-[#2F2437]">{title}</h3> : null}
      <div className={title ? "mt-4 grid gap-4 lg:grid-cols-2" : "grid gap-4 lg:grid-cols-2"}>
        {events.map((event) => {
          const eventVariant = event.status === "cancelled" ? "cancelled" : variant;
          return (
            <EventCard
              event={event}
              facilitatorStatus={facilitatorStatus}
              isHidden={isHidden}
              isExpiringSoon={variant === "completed" && isOlderThanMonths(eventEndDate(event), new Date(), 11)}
              key={event.id}
              variant={eventVariant}
            />
          );
        })}
      </div>
    </section>
  );
}

function EmptyEventTabState({ text }: { text: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-[#D8CBE4] bg-[#FAF8F4] px-5 py-8 text-sm font-semibold text-[#6E6475]">
      {text}
    </div>
  );
}

function AdminMessageCta({ unreadCount }: { unreadCount: number }) {
  if (unreadCount === 0) {
    return null;
  }

  return (
    <form action={markFacilitatorAdminMessagesReadAction}>
      <button
        className="flex w-full items-center justify-between gap-4 rounded-[28px] border border-[#D8CBE4] bg-[#F4F0F7] p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg"
        type="submit"
      >
        <span className="flex min-w-0 items-center gap-4">
          <span className="relative grid size-12 shrink-0 place-items-center rounded-full bg-white text-[#7A5D91]">
            <Bell className="size-5" aria-hidden="true" />
            <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-[#B56F8A] text-[11px] font-bold text-white">
              {unreadCount}
            </span>
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-[#2F2437]">
              {unreadCount === 1 ? "Ny besked fra SoulEvents" : "Nye beskeder fra SoulEvents"}
            </span>
            <span className="mt-1 block text-sm leading-5 text-[#6E6475]">
              {unreadCount === 1 ? "Du har en ulæst besked, som venter på dig." : `Du har ${unreadCount} ulæste beskeder.`}
            </span>
            <span className="mt-3 inline-flex text-sm font-semibold text-[#7A5D91]">
              {unreadCount === 1 ? "Læs beskeden" : "Læs beskeder"}
            </span>
          </span>
        </span>
        <ArrowRight className="size-5 shrink-0 text-[#A08BB4]" aria-hidden="true" />
      </button>
    </form>
  );
}

export default async function FacilitatorPage({ searchParams }: FacilitatorPageProps) {
  const [{ message, tab }, profile] = await Promise.all([searchParams, requireRole("facilitator")]);
  const activeEventTab = normalizeEventTab(tab);
  const supabase = createAdminClient();
  const { data: facilitatorProfile } = await supabase
    .from("facilitator_profiles")
    .select(
      "id, slug, status, is_paused, is_disabled, host_reference_id, company_name, facilitator_hero_key, profile_image_path, address_line, city, postal_code, short_description, specialties, offers_services, service_description, is_active_host, is_experienced_host, max_ticket_price_per_person, facilitator_categories(category_id, categories(name, slug, color_hex)), facilitator_images(image_path, alt_text, sort_order)",
    )
    .eq("profile_id", profile.id)
    .single();

  if (!facilitatorProfile) {
    redirect("/auth/oauth-profile");
  }

  const status = facilitatorProfile?.status ?? "draft";
  const profileImageUrl = facilitatorProfile?.profile_image_path
    ? supabase.storage.from("media").getPublicUrl(facilitatorProfile.profile_image_path).data.publicUrl
    : null;
  const profileName = facilitatorProfile?.company_name || profile.full_name || "Personlig profil";
  const fullProfileHref = facilitatorProfile?.id ? publicFacilitatorPath(facilitatorProfile.slug || facilitatorProfile.id) + "?facilitator_return=/facilitator" : null;
  const categoryNames =
    facilitatorProfile?.facilitator_categories
      ?.map((row: CategoryRelation) => (Array.isArray(row.categories) ? row.categories[0] : row.categories))
      .filter((category): category is { name: string; slug: string; color_hex?: string } => Boolean(category?.slug && facilitatorWorkAreaSlugSet.has(category.slug))) ?? [];
  const moodImages =
    facilitatorProfile?.facilitator_images
      ?.slice()
      .sort((a: MoodImage, b: MoodImage) => a.sort_order - b.sort_order)
      .map((image: MoodImage) => ({
        altText: image.alt_text,
        sortOrder: image.sort_order,
        url: supabase.storage.from("media").getPublicUrl(image.image_path).data.publicUrl,
      })) ?? [];
  const moodImageFallback = withFacilitatorMoodImageFallback(moodImages, {
    fallbackAltText: "Roligt SoulEvents naturbillede",
  });
  const visibleMoodImages = moodImageFallback.images.map((image) => ({
    altText: image.altText,
    isFallback: moodImageFallback.isUsingFallback,
    sortOrder: "sortOrder" in image ? image.sortOrder : null,
    url: image.url ?? resolveFacilitatorMoodImage([], { fallbackAltText: "Roligt SoulEvents naturbillede" }).url,
  }));
  const heroImage = resolveFacilitatorHero({
    fallbackAltText: "Roligt SoulEvents naturbillede",
    heroKey: facilitatorProfile?.facilitator_hero_key,
    moodImages,
    preferCustomWhenUnset: true,
  });
  const profileSpecialty = normalizeSpecialtyText(facilitatorProfile?.specialties);
  const profilePlace = facilitatorProfile?.city || null;
  const now = new Date();
  const moonDataPromise = getMoonData(now);
  const [
    events,
    unreadAdminMessageCount,
    { data: missingPaymentBookingRows },
    { data: coOrganizerInvitations },
    { data: externalCoOrganizerInvitations },
    { data: latestChangeRequest },
    { data: facilitatorPaymentSettings },
  ] =
    facilitatorProfile
      ? await Promise.all([
          getDashboardEvents(supabase, facilitatorProfile.id),
          getFacilitatorUnreadAdminMessageCount(facilitatorProfile.id),
          supabase
            .from("bookings")
            .select("id, event_id, booking_value_cents, manually_marked_paid_at, events!inner(id, facilitator_id, starts_at, ends_at, status)")
            .eq("events.facilitator_id", facilitatorProfile.id)
            .eq("status", "confirmed")
            .gt("booking_value_cents", 0)
            .is("manually_marked_paid_at", null)
            .in("events.status", ["active", "sold_out"]),
          supabase
            .from("event_co_organizers")
            .select("id, status, response_token, events!inner(id, slug, title, starts_at, ends_at, status, facilitator_profiles!events_facilitator_id_fkey(company_name, status, is_paused, is_disabled, profiles!facilitator_profiles_profile_id_fkey(full_name)))")
            .eq("co_organizer_profile_id", facilitatorProfile.id)
            .in("status", ["pending", "accepted"])
            .in("events.status", ["active", "sold_out"])
            .order("created_at", { ascending: false }),
          (supabase as any)
            .from("event_cohost_invitations")
            .select("id, status, token_hash, email, events!inner(id, slug, title, starts_at, ends_at, status, facilitator_profiles!events_facilitator_id_fkey(company_name, status, is_paused, is_disabled, profiles!facilitator_profiles_profile_id_fkey(full_name)))")
            .eq("email", profile.email.toLowerCase())
            .eq("status", "pending")
            .in("events.status", ["active", "sold_out"])
            .order("created_at", { ascending: false }),
          supabase
            .from("admin_audit_log")
            .select("reason")
            .eq("facilitator_id", facilitatorProfile.id)
            .eq("action", "facilitator_changes_requested")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("facilitator_payment_settings")
            .select("mobilepay_number, bank_registration_number, bank_account_number, bank_account_name, external_url, instructions, deadline_days")
            .eq("facilitator_id", facilitatorProfile.id)
            .maybeSingle(),
        ])
      : [[], 0, { data: [] }, { data: [] }, { data: [] }, { data: null }, { data: null }];
  const moonData = await moonDataPromise;
  const hasReusablePaymentSettings = hasStandardPaymentMethod(paymentSettingsToInstructionsRecord(facilitatorPaymentSettings));

  const eventRows = events as any[];
  const currentMissingPaymentBookingRows = ((missingPaymentBookingRows ?? []) as Array<{
    event_id?: string | null;
    events?: { ends_at?: string | null; starts_at?: string | null } | Array<{ ends_at?: string | null; starts_at?: string | null }> | null;
  }>).filter((booking) => {
    const event = Array.isArray(booking.events) ? booking.events[0] : booking.events;
    const eventEndsAt = event?.ends_at ?? event?.starts_at;
    return eventEndsAt ? new Date(eventEndsAt) >= now : false;
  });
  const missingPaymentBookingCount = currentMissingPaymentBookingRows.length;
  const missingPaymentBookingsHref = currentMissingPaymentBookingRows[0]?.event_id
    ? "/facilitator/bookings?event=" + currentMissingPaymentBookingRows[0].event_id
    : "/facilitator/bookings";
  const limitStatus = facilitatorProfile
    ? await getFacilitatorEventLimitStatus(supabase, facilitatorProfile.id)
    : { activeCount: 0, draftCount: 0, maxActiveEvents: 10, maxDraftEvents: 5 };
  const coOrganizerRows = (coOrganizerInvitations ?? []) as any[];
  const currentCoOrganizerRows = coOrganizerRows.filter((row) => isCurrentPublicCoOrganizerEvent(first(row.events), now));
  const pendingCoOrganizerInvitations = currentCoOrganizerRows.filter((row) => row.status === "pending");
  const acceptedCoOrganizerInvitations = currentCoOrganizerRows.filter((row) => row.status === "accepted");
  const currentExternalCoOrganizerInvitations = ((externalCoOrganizerInvitations ?? []) as any[]).filter((row) =>
    isCurrentPublicCoOrganizerEvent(first(row.events), now),
  );
  const unreadMessageCount = unreadAdminMessageCount;
  const hiddenEvents = eventRows.filter((event) => event.dashboard_hidden_at);
  const visibleEventRows = eventRows.filter((event) => !event.dashboard_hidden_at);
  const activeEvents = visibleEventRows.filter((event) => {
    const userStatus = getUserFacingEventStatus(event, now);
    return userStatus === "active" || userStatus === "sold_out";
  });
  const heldEvents = visibleEventRows.filter((event) => isHeldArchiveEvent(event, now));
  const cancelledEvents = visibleEventRows.filter((event) => isCancelledArchiveEvent(event));
  const visibleHeldEvents = heldEvents.filter((event) => !isOlderThanMonths(eventEndDate(event), now, 12));
  const visibleCancelledEvents = cancelledEvents.filter((event) => !isOlderThanMonths(eventEndDate(event), now, 12));
  const visibleArchivedEventCount = visibleHeldEvents.length + visibleCancelledEvents.length;
  const draftEvents = visibleEventRows.filter((event) => event.status === "draft" || event.status === "pending_review");
  const eventTabEvents: Record<EventTab, any[]> = {
    active: activeEvents,
    cancelled: visibleCancelledEvents,
    drafts: draftEvents,
    held: visibleHeldEvents,
    hidden: hiddenEvents,
  };
  const eventTabCounts: Record<EventTab, number> = {
    active: activeEvents.length,
    cancelled: visibleCancelledEvents.length,
    drafts: draftEvents.length,
    held: visibleHeldEvents.length,
    hidden: hiddenEvents.length,
  };
  const selectedEventTab = eventTabs.find((eventTab) => eventTab.key === activeEventTab) ?? eventTabs[1];
  const selectedEventTabEvents = eventTabEvents[activeEventTab];
  const selectedEventTabVariant: DashboardEventVariant =
    activeEventTab === "drafts"
      ? "draft"
      : activeEventTab === "cancelled"
        ? "cancelled"
        : activeEventTab === "active"
          ? "active"
          : "completed";
  const profileReadiness = getProfileReadiness({
    categoryCount: categoryNames.length,
    facilitatorProfile,
    fullName: profile.full_name,
  });
  const onboardingState = await getFacilitatorOnboardingStateForProfile(supabase, {
    fullName: profile.full_name,
    profileId: profile.id,
  });

  const profileChangeRequest = parseProfileChangeRequest(latestChangeRequest?.reason);

  const defaultPrimaryAction = getDashboardAction({
    draftEvents,
    maxDraftEvents: limitStatus.maxDraftEvents,
    profileReadiness,
  });
  const primaryAction =
    onboardingState === "changes_requested"
      ? {
          description: "Ret de punkter, SoulEvents har markeret, og send profilen til ny godkendelse.",
          href: "/facilitator/profile",
          icon: PencilLine,
          label: "Ret profil",
          title: "Profil kræver ændringer",
        }
      : defaultPrimaryAction;
  return (
    <main className="min-h-screen bg-[#FAF8F4] text-[#2F2437]">
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <AuthMessage message={message} />

          <DashboardGreetingIntro
            moonData={moonData}
            name={profile.full_name}
            profileReadiness={profileReadiness}
          />

          <AdminMessageCta unreadCount={unreadMessageCount} />

          {onboardingState === "changes_requested" ? (
            <ProfileChangesRequestedCard canSubmit={profileReadiness.isComplete} request={profileChangeRequest} />
          ) : null}

          {onboardingState === "onboarding" ? (
            <section className="rounded-[24px] border border-[#E7D59D] bg-[#FFF8DF] p-5 shadow-soft sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7A5A15]">Profilkladde</p>
                  <h2 className="mt-2 text-xl font-semibold text-midnight">Din profil er ikke færdig endnu</h2>
                  <p className="mt-2 text-sm leading-6 text-ink/70">
                    Du kan bruge dashboardet og fortsætte senere. Profilen bliver først sendt til SoulEvents, når du selv vælger at sende den til godkendelse.
                  </p>
                </div>
                <Link
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-button bg-midnight px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-700"
                  href="/facilitator/profile"
                >
                  Færdiggør profil
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </section>
          ) : null}

          {!hasReusablePaymentSettings ? <MissingPaymentSettingsCard /> : null}

          {pendingCoOrganizerInvitations.length > 0 ? (
            <section className="rounded-[24px] border border-[#E5DDEA] bg-white p-5 shadow-soft sm:p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Invitationer til events</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#2F2437]">Du er inviteret som medarrangør</h2>
              <p className="mt-2 text-sm leading-6 text-ink/64">
                Bekræft kun, hvis du ønsker at stå som medarrangør på eventet. Den primære arrangør står fortsat for tilmeldinger og administration.
              </p>
              <div className="mt-4 grid gap-3">
                {pendingCoOrganizerInvitations.map((invitation) => {
                  const event = first(invitation.events);
                  const owner = first(event?.facilitator_profiles);
                  const ownerUser = first(owner?.profiles);
                  return (
                    <Link
                      className="flex flex-col gap-2 rounded-[18px] border border-[#E5DDEA] bg-[#FAF8FC] p-4 transition hover:border-[#7A5D91] sm:flex-row sm:items-center sm:justify-between"
                      href={"/facilitator/co-organizer-invitations/" + invitation.response_token}
                      key={invitation.id}
                    >
                      <span>
                        <span className="block font-semibold text-midnight">{event?.title ?? "Event"}</span>
                        <span className="mt-1 block text-sm text-ink/62">
                          {event?.starts_at ? formatDateTime(event.starts_at) + " · " : ""}
                          Primær arrangør: {owner?.company_name || ownerUser?.full_name || "Arrangør"}
                        </span>
                      </span>
                      <span className="text-sm font-semibold text-[#7A5D91]">Bekræft invitation</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          {currentExternalCoOrganizerInvitations.length > 0 ? (
            <section className="rounded-[24px] border border-[#E5DDEA] bg-white p-5 shadow-soft sm:p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Invitationer til events</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#2F2437]">Du er inviteret som medarrangør</h2>
              <p className="mt-2 text-sm leading-6 text-ink/64">
                Åbn linket fra invitationsmailen for at acceptere. Invitationen er bundet til din e-mailadresse.
              </p>
              <div className="mt-4 grid gap-3">
                {currentExternalCoOrganizerInvitations.map((invitation) => {
                  const event = first(invitation.events);
                  const owner = first(event?.facilitator_profiles);
                  const ownerUser = first(owner?.profiles);
                  return (
                    <div
                      className="flex flex-col gap-2 rounded-[18px] border border-[#E5DDEA] bg-[#FAF8FC] p-4 sm:flex-row sm:items-center sm:justify-between"
                      key={invitation.id}
                    >
                      <span>
                        <span className="block font-semibold text-midnight">{event?.title ?? "Event"}</span>
                        <span className="mt-1 block text-sm text-ink/62">
                          {event?.starts_at ? formatDateTime(event.starts_at) + " · " : ""}
                          Primær arrangør: {owner?.company_name || ownerUser?.full_name || "Arrangør"}
                        </span>
                      </span>
                      <span className="text-sm font-semibold text-[#7A5D91]">Se invitationsmail</span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {acceptedCoOrganizerInvitations.length > 0 ? (
            <section className="rounded-[24px] border border-[#E5DDEA] bg-white p-5 shadow-soft sm:p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Events, jeg medvirker på</p>
              <div className="mt-4 grid gap-3">
                {acceptedCoOrganizerInvitations.map((invitation) => {
                  const event = first(invitation.events);
                  const owner = first(event?.facilitator_profiles);
                  const ownerUser = first(owner?.profiles);
                  return (
                    <Link
                      className="flex flex-col gap-2 rounded-[18px] border border-[#E5DDEA] bg-[#FAF8FC] p-4 transition hover:border-[#7A5D91] sm:flex-row sm:items-center sm:justify-between"
                      href={event?.id ? publicEventPath(event.slug || event.id) : "/facilitator"}
                      key={invitation.id}
                    >
                      <span>
                        <span className="block font-semibold text-midnight">{event?.title ?? "Event"}</span>
                        <span className="mt-1 block text-sm text-ink/62">
                          {event?.starts_at ? formatDateTime(event.starts_at) + " · " : ""}
                          Primær arrangør: {owner?.company_name || ownerUser?.full_name || "Arrangør"}
                        </span>
                      </span>
                      <span className="text-sm font-semibold text-[#7A5D91]">Se event</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          {profileReadiness.isComplete ? (
            <section id="mine-events" className="rounded-[32px] border border-[#E5DDEA] bg-white p-5 shadow-[0_18px_45px_rgba(47,36,55,0.08)] sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 lg:flex-1">
                  <h2 className="text-2xl font-semibold text-[#2F2437]">Mine events</h2>
                  <p className="mt-1 text-sm leading-6 text-[#6E6475]">
                    {draftEvents.length + activeEvents.length + visibleArchivedEventCount + hiddenEvents.length > 0
                      ? "Her finder du dine kladder, aktive og tidligere events. Events, du ikke længere ønsker i oversigten, kan flyttes til arkivet."
                      : "Hvert event begynder med en idé. Når du opretter dit første event, bliver det synligt for mennesker over hele Danmark, som søger netop den oplevelse, du skaber."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {eventTabs.map((eventTab) => (
                      <EventCountPill
                        href={eventTabHref(eventTab.key)}
                        isActive={activeEventTab === eventTab.key}
                        key={eventTab.key}
                        label={eventTab.label}
                        tone={eventTab.key === "hidden" ? "archive" : "default"}
                        value={eventTabCounts[eventTab.key]}
                      />
                    ))}
                  </div>
                </div>
                {draftEvents.length + activeEvents.length + visibleArchivedEventCount + hiddenEvents.length === 0 ? (
                  <Link
                    className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#7A5D91] px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-[#6E5285] sm:w-auto lg:min-w-[210px] lg:shrink-0"
                    href="/facilitator/events"
                  >
                    <CalendarPlus className="size-4" aria-hidden="true" />
                    Opret første event
                  </Link>
                ) : null}
              </div>
              <div className="mt-6 grid gap-8 border-t border-[#EFE8F2] pt-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                  <h3 className="text-lg font-semibold text-[#2F2437]">
                    {selectedEventTab.title} ({selectedEventTabEvents.length})
                  </h3>
                  {activeEventTab === "active" && visibleArchivedEventCount > 0 ? (
                    <Link className="text-sm font-semibold text-[#7A5D91] transition hover:text-[#6E5285]" href={eventTabHref("held")}>
                      Se eventarkiv
                    </Link>
                  ) : null}
                </div>
                {selectedEventTabEvents.length > 0 ? (
                  <EventGrid
                    events={selectedEventTabEvents}
                    facilitatorStatus={facilitatorProfile?.status}
                    id={`${activeEventTab}-events`}
                    isHidden={activeEventTab === "hidden"}
                    title=""
                    variant={selectedEventTabVariant}
                  />
                ) : (
                  <EmptyEventTabState text={selectedEventTab.emptyText} />
                )}
              </div>
            </section>
          ) : null}

          {profileReadiness.isComplete ? (
            <BookingAttentionCard
              hasActiveEvents={activeEvents.length > 0}
              missingPaymentCount={missingPaymentBookingCount}
              missingPaymentHref={missingPaymentBookingsHref}
            />
          ) : null}

        </div>
      </section>
    </main>
  );
}
