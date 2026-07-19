import {
  ArrowRight,
  Bell,
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  Inbox,
  Leaf,
  Mail,
  MoreHorizontal,
  PauseCircle,
  PencilLine,
  RotateCcw,
  Settings,
  Ticket,
  XCircle,
} from "lucide-react";
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  activateFacilitatorProfileAction,
  markFacilitatorAdminMessagesReadAction,
  requestFacilitatorProfileClosureAction,
  sendFacilitatorAdminMessageAction,
  sendFacilitatorProfileToReviewAction,
} from "@/app/facilitator/actions";
import { updateEventStatusAction, copyEventAsDraftAction, deleteDraftEventAction, publishDraftEventAction } from "@/app/facilitator/events/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { DashboardGreeting } from "@/components/facilitator/dashboard-greeting";
import { LoginSecuritySection } from "@/components/facilitator/login-security-section";
import { ProfileIdentityHeader } from "@/components/facilitator/profile-identity-header";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireRole } from "@/lib/auth/roles";
import { draftLimitMessage, getFacilitatorEventLimitStatus } from "@/lib/events/event-limits";
import { getDraftPublishReadiness } from "@/lib/events/draft-publish-readiness";
import { resolveFacilitatorHero } from "@/lib/facilitators/hero-collection";
import { resolveFacilitatorMoodImage, withFacilitatorMoodImageFallback } from "@/lib/facilitators/mood-image-fallback";
import { getFacilitatorOnboardingStateForProfile } from "@/lib/facilitators/onboarding-state";
import { parseProfileChangeRequest, type ProfileChangeRequest } from "@/lib/facilitators/profile-change-request";
import { getFacilitatorProfileReadiness } from "@/lib/facilitators/profile-readiness";
import { facilitatorWorkAreaSlugSet } from "@/lib/facilitators/work-areas";
import { publicEventPath, publicFacilitatorPath } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type FacilitatorPageProps = {
  searchParams: Promise<{
    message?: string;
    messages?: string;
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

const statusLabels: Record<string, string> = {
  draft: "Kladde",
  pending_review: "Afventer godkendelse",
  active: "Aktiv",
  rejected: "Afvist",
  sold_out: "Udsolgt",
  cancelled: "Aflyst",
  completed: "Afholdt",
  archived: "Arkiveret",
};

const statusStyles: Record<string, string> = {
  draft: "bg-[#E9E6E1] text-[#6A6258]",
  pending_review: "bg-[#FFF7E8] text-[#8A6A2E]",
  active: "bg-[#DDE8D7] text-[#4E6A45]",
  rejected: "bg-red-50 text-red-800",
  sold_out: "bg-[#F4F0F7] text-[#6E5A86]",
  cancelled: "bg-red-50 text-red-800",
  completed: "bg-[#F7F1EA] text-[#756758]",
  archived: "bg-stone-100 text-stone-600",
};

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Tidspunkt mangler";
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusLabel(status: string) {
  return statusLabels[status] ?? status;
}

function statusClass(status: string) {
  return statusStyles[status] ?? "bg-stone-100 text-stone-700";
}

function isPastEvent(event: { ends_at?: string | null; starts_at: string; status: string }, now: Date) {
  return event.status === "completed" || event.status === "cancelled" || new Date(event.ends_at ?? event.starts_at) < now;
}

function eventEndDate(event: { ends_at?: string | null; starts_at: string }) {
  return new Date(event.ends_at ?? event.starts_at);
}

function isOlderThanMonths(value: Date, now: Date, months: number) {
  const threshold = new Date(value);
  threshold.setMonth(threshold.getMonth() + months);
  return threshold < now;
}

function splitSpecialties(input: string | null | undefined) {
  return (input ?? "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

type AuthProviderIdentity = {
  created_at?: string | null;
  last_sign_in_at?: string | null;
  provider?: string | null;
  updated_at?: string | null;
};

const knownOauthProviders = new Set(["facebook", "google"]);

function isKnownOauthProvider(provider: string | null | undefined) {
  return Boolean(provider && knownOauthProviders.has(provider));
}

function timeDistance(first: string | null | undefined, second: string | null | undefined) {
  if (!first || !second) return Number.POSITIVE_INFINITY;
  const firstTime = new Date(first).getTime();
  const secondTime = new Date(second).getTime();
  if (!Number.isFinite(firstTime) || !Number.isFinite(secondTime)) return Number.POSITIVE_INFINITY;
  return Math.abs(firstTime - secondTime);
}

function resolveCurrentOauthProvider(input: {
  appProvider?: string | null;
  appProviders?: string[] | null;
  identities?: AuthProviderIdentity[] | null;
  lastSignInAt?: string | null;
}) {
  const oauthIdentities = (input.identities ?? []).filter((identity) => isKnownOauthProvider(identity.provider));
  const uniqueOauthProviders = Array.from(new Set(oauthIdentities.map((identity) => identity.provider).filter(Boolean)));

  if (uniqueOauthProviders.length === 1) {
    return uniqueOauthProviders[0] ?? null;
  }

  if (uniqueOauthProviders.length > 1) {
    const rankedIdentities = oauthIdentities
      .map((identity) => ({
        provider: identity.provider,
        distance: Math.min(
          timeDistance(identity.updated_at, input.lastSignInAt),
          timeDistance(identity.last_sign_in_at, input.lastSignInAt),
          timeDistance(identity.created_at, input.lastSignInAt),
        ),
      }))
      .filter((identity): identity is { distance: number; provider: string } => Boolean(identity.provider) && Number.isFinite(identity.distance))
      .sort((firstIdentity, secondIdentity) => firstIdentity.distance - secondIdentity.distance);
    const [bestMatch, nextMatch] = rankedIdentities;

    if (bestMatch && bestMatch.distance <= 5 * 60 * 1000 && bestMatch.distance !== nextMatch?.distance) {
      return bestMatch.provider;
    }

    return null;
  }

  if (isKnownOauthProvider(input.appProvider)) {
    return input.appProvider ?? null;
  }

  const appOauthProviders = (input.appProviders ?? []).filter(isKnownOauthProvider);
  if (appOauthProviders.length === 1) {
    return appOauthProviders[0] ?? null;
  }

  return null;
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
      description: "Start med de oplysninger, der mangler, så dashboardet kan åbne næste skridt for dig.",
      href: "/facilitator/profile",
      icon: PencilLine,
      label: "Færdiggør profil",
      title: "Næste skridt er din profil",
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

function DashboardGreetingIntro({ name, profileReadiness }: { name: string | null; profileReadiness: ProfileReadiness }) {
  return (
    <section className="rounded-[28px] border border-[#E5DDEA] bg-white/72 px-5 py-4 shadow-[0_14px_36px_rgba(47,36,55,0.06)] sm:px-6">
      <h1 className="font-serif text-3xl font-semibold leading-tight text-[#2F2437] sm:text-4xl">
        <DashboardGreeting name={name} />
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6E6475] sm:text-base">
        {profileReadiness.isComplete
          ? "Det er en smuk dag til at samle mennesker."
          : "Velkommen til dit lille hjørne af SoulEvents. Næste skridt er at gøre profilen klar."}
      </p>
      {profileReadiness.missingItems.length > 0 ? (
        <p className="mt-3 max-w-3xl rounded-[18px] border border-[#D8CBE4] bg-[#F1EAF5] px-4 py-3 text-sm font-semibold leading-6 text-[#6E5285]">
          Mangler: {profileReadiness.missingItems.join(", ")}
        </p>
      ) : null}
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
function BookingAttentionCard({ pendingCount, pendingHref }: { pendingCount: number; pendingHref: string }) {
  const hasPending = pendingCount > 0;

  return (
    <section
      className={
        "rounded-[32px] border p-5 shadow-[0_18px_45px_rgba(47,36,55,0.08)] sm:p-6 " +
        (hasPending ? "border-[#E8D6A8] bg-[#FFF8E8]" : "border-[#E5DDEA] bg-white")
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span
            className={
              "mt-0.5 grid size-10 shrink-0 place-items-center rounded-full " +
              (hasPending ? "bg-[#FFF1D6] text-[#8A6A2E]" : "bg-[#DDE8D7] text-[#4E6A45]")
            }
          >
            {hasPending ? <Inbox className="size-5" aria-hidden="true" /> : <CheckCircle2 className="size-5" aria-hidden="true" />}
          </span>
          <div>
            <h2 className="text-xl font-semibold text-[#2F2437]">Tilmeldinger</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#6E6475]">
              {hasPending
                ? `${pendingCount} ${pendingCount === 1 ? "deltager afventer dit svar" : "deltagere afventer dit svar"}`
                : "Ingen tilmeldinger kræver handling"}
            </p>
          </div>
        </div>
        <Link
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#7A5D91] px-5 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-[#6E5285]"
          href={pendingHref}
        >
          {hasPending ? "Behandl tilmeldinger" : "Se tilmeldinger"}
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

function StatusAction({ eventId, status, children }: { eventId: string; status: string; children: React.ReactNode }) {
  return (
    <form action={updateEventStatusAction}>
      <input name="event_id" type="hidden" value={eventId} />
      <input name="status" type="hidden" value={status} />
      <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#E5DDEA] bg-white px-4 text-sm font-semibold text-[#2F2437] transition hover:border-[#7A5D91] hover:text-[#7A5D91]" type="submit">
        {children}
      </button>
    </form>
  );
}

type DashboardEventVariant = "draft" | "active" | "completed" | "cancelled";

function EventCard({
  event,
  facilitatorStatus,
  isExpiringSoon = false,
  variant,
}: {
  event: any;
  facilitatorStatus?: string | null;
  isExpiringSoon?: boolean;
  variant: DashboardEventVariant;
}) {
  const bookingCount = event.bookings?.length ?? 0;
  const location = event.event_format === "online" ? "Online" : event.city || "Lokation kommer";
  const isDraft = event.status === "draft";
  const draftReadiness = isDraft
    ? getDraftPublishReadiness({
        event,
        facilitatorStatus,
      })
    : null;
  const isActive = event.status === "active" || event.status === "sold_out";
  const isCopyableAsDraft =
    event.status === "active" ||
    event.status === "sold_out" ||
    event.status === "completed" ||
    event.status === "cancelled" ||
    new Date(event.starts_at) < new Date();

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
        <span className={"rounded-full px-3 py-1 text-xs font-semibold " + statusClass(event.status)}>{statusLabel(event.status)}</span>
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
          {bookingCount} tilmeldinger
        </p>
      </div>
      {statusMessage ? (
        <div className={"mt-5 rounded-[18px] border px-4 py-3 text-sm font-semibold leading-6 " + (draftReadiness?.canPublish ? variantStyles.active.note : currentStyle.note)}>
          {draftReadiness?.canPublish ? "✓ " : ""}
          {statusMessage}
          {isExpiringSoon ? <p className="mt-1 text-xs font-medium">Dette event fjernes fra dashboardet om cirka en måned.</p> : null}
        </div>
      ) : null}
      <div className="mt-5 grid gap-3">
        {variant === "completed" ? (
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#7A5D91] px-4 text-sm font-semibold text-white transition hover:bg-[#6E4F86]"
              href={publicEventPath(event.slug || event.id)}
            >
              Se detaljer
            </Link>
            {isCopyableAsDraft ? (
              <form action={copyEventAsDraftAction}>
                <input name="event_id" type="hidden" value={event.id} />
                <button className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[#E5DDEA] bg-white px-4 text-sm font-semibold text-[#2F2437] transition hover:border-[#7A5D91] hover:text-[#7A5D91]" type="submit">
                  <Copy className="size-4" aria-hidden="true" />
                  Kopiér som nyt event
                </button>
              </form>
            ) : null}
          </div>
        ) : draftReadiness?.canPublish ? (
          <>
            <form action={publishDraftEventAction}>
              <input name="event_id" type="hidden" value={event.id} />
              <button className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#7A5D91] px-4 text-sm font-semibold text-white transition hover:bg-[#6E4F86]" type="submit">
                <ArrowRight className="size-4" aria-hidden="true" />
                Offentliggør event
              </button>
            </form>
            <p className="max-w-md text-xs leading-5 text-ink/58">
              Ved offentliggørelse bekræfter du SoulEvents&apos;{" "}
              <Link className="font-semibold text-[#7A4EAB] underline underline-offset-4" href="/legal/arrangoervilkaar" target="_blank">
                arrangørvilkår
              </Link>{" "}
              og{" "}
              <Link className="font-semibold text-[#7A4EAB] underline underline-offset-4" href="/legal/platformens-retningslinjer" target="_blank">
                retningslinjer
              </Link>
              .
            </p>
          </>
        ) : (
          <Link
            className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#7A5D91] px-4 text-sm font-semibold text-white transition hover:bg-[#6E4F86]"
            href={isActive ? "/facilitator/bookings?event=" + event.id : "/facilitator/events?draft=" + event.id}
          >
            {isActive ? <Inbox className="size-4" aria-hidden="true" /> : <PencilLine className="size-4" aria-hidden="true" />}
            {isActive ? "Se tilmeldinger" : "Fortsæt redigering"}
          </Link>
        )}
        {variant !== "completed" ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold text-[#6E5A86]">
            <Link className="whitespace-nowrap transition hover:text-[#7A5D91]" href={"/facilitator/events?draft=" + event.id}>
              {isDraft ? "Fortsæt redigering" : "Rediger"}
            </Link>
            <Link className="whitespace-nowrap transition hover:text-[#7A5D91]" href={"/facilitator/bookings?event=" + event.id}>
              Tilmeldinger
            </Link>
            {isActive ? (
              <Link className="whitespace-nowrap transition hover:text-[#7A5D91]" href={publicEventPath(event.slug || event.id)}>
                Se event
              </Link>
            ) : null}
            <details className="relative">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 whitespace-nowrap transition hover:text-[#7A5D91]">
                Flere
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </summary>
              <div className="mt-3 grid gap-2 rounded-[18px] border border-[#E5DDEA] bg-white p-3 shadow-soft">
                {isCopyableAsDraft ? (
                  <form action={copyEventAsDraftAction}>
                    <input name="event_id" type="hidden" value={event.id} />
                    <button className="inline-flex h-9 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#F4F0F7] px-3 text-xs font-semibold text-[#6E5A86]" type="submit">
                      <Copy className="size-3.5" aria-hidden="true" />
                      Kopiér som nyt event
                    </button>
                  </form>
                ) : null}
                {event.status === "draft" ? (
                  <form action={deleteDraftEventAction}>
                    <input name="event_id" type="hidden" value={event.id} />
                    <button className="inline-flex h-9 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-800" type="submit">
                      <XCircle className="size-3.5" aria-hidden="true" />
                      Slet kladde
                    </button>
                  </form>
                ) : null}
                {event.status === "pending_review" ? (
                  <StatusAction eventId={event.id} status="draft">
                    <RotateCcw className="size-3.5" aria-hidden="true" />
                    Fortryd indsendelse
                  </StatusAction>
                ) : null}
                {event.status !== "cancelled" && event.status !== "draft" && event.status !== "pending_review" ? (
                  <StatusAction eventId={event.id} status="cancelled">
                    <PauseCircle className="size-3.5" aria-hidden="true" />
                    Aflys
                  </StatusAction>
                ) : null}
              </div>
            </details>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function EventCountPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#E5DDEA] bg-[#FAF8F4] px-3 py-1.5 text-xs font-semibold text-[#6E6475]">
      {label}
      <span className="rounded-full bg-white px-2 py-0.5 text-[#7A5D91]">{value}</span>
    </span>
  );
}

function EventGrid({
  events,
  facilitatorStatus,
  id,
  title,
  variant,
}: {
  events: any[];
  facilitatorStatus?: string | null;
  id?: string;
  title: string;
  variant: DashboardEventVariant;
}) {
  if (events.length === 0) return null;

  return (
    <section id={id}>
      <h3 className="text-lg font-semibold text-[#2F2437]">{title}</h3>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {events.map((event) => {
          const eventVariant = event.status === "cancelled" ? "cancelled" : variant;
          return (
            <EventCard
              event={event}
              facilitatorStatus={facilitatorStatus}
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

function MessageStatusLabel({ status, type }: { status: string; type?: string }) {
  if (type === "admin_reply" && status === "unread") {
    return "Ny besked";
  }

  const labels: Record<string, string> = {
    handled: "Behandlet",
    read: "Set af administrationen",
    unread: "Afventer svar",
  };

  return labels[status] ?? status;
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

function SettingsPanel({
  adminMessages,
  currentEmail,
  isOpen,
  isPaused,
  oauthProvider,
  passwordLoginAvailable,
  pendingEmailChange,
  unreadMessageCount,
}: {
  adminMessages: any[];
  currentEmail: string;
  isOpen: boolean;
  isPaused: boolean;
  oauthProvider?: string | null;
  passwordLoginAvailable: boolean;
  pendingEmailChange?: { expires_at: string; new_email: string } | null;
  unreadMessageCount: number;
}) {

  return (
    <details className="rounded-[32px] border border-[#E5DDEA] bg-white shadow-[0_18px_45px_rgba(47,36,55,0.08)]" id="beskeder-admin" open={isOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-[#2F2437] transition hover:text-[#7A5D91] sm:px-6">
        <span className="inline-flex items-center gap-2">
          <Settings className="size-4 text-[#7A5D91]" aria-hidden="true" />
          Hjælp og profilindstillinger
        </span>
        <ChevronDown className="size-4 text-[#A08BB4]" aria-hidden="true" />
      </summary>
      <div className="grid gap-4 border-t border-[#E5DDEA] p-5 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <LoginSecuritySection
            currentEmail={currentEmail}
            oauthProvider={oauthProvider}
            passwordLoginAvailable={passwordLoginAvailable}
            pendingEmailChange={pendingEmailChange}
          />
        </div>

        <form action={sendFacilitatorAdminMessageAction} className="rounded-[20px] border border-[#E5DDEA] bg-[#FAF7F2] p-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Kontakt</p>
          <h2 className="mt-1 text-lg font-semibold text-[#2F2437]">Skriv til SoulEvents administration</h2>
          <p className="mt-2 text-sm leading-6 text-[#6E6475]">Send en kort besked direkte til SoulEvents.dk. Maks. 500 tegn.</p>
          <p className="mt-2 text-sm leading-6 text-[#6E6475]">
            Dine beskeder gemmes i op til 3 måneder og slettes derefter automatisk.
          </p>
          <label className="mt-4 grid gap-2 text-sm font-semibold text-[#2F2437]">
            Emne
            <input className="h-11 rounded-md border border-[#E5DDEA] px-3 outline-none focus:border-[#7A5D91]" maxLength={80} name="subject" placeholder="Fx spørgsmål til min profil" />
          </label>
          <label className="mt-4 grid gap-2 text-sm font-semibold text-[#2F2437]">
            Besked
            <textarea className="min-h-28 rounded-md border border-[#E5DDEA] p-3 outline-none focus:border-[#7A5D91]" maxLength={500} name="message" placeholder="Skriv højst 500 tegn..." required />
          </label>
          <button className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#7A5D91] px-5 text-sm font-semibold text-white" type="submit">
            <Mail className="size-4" aria-hidden="true" />
            Send besked
          </button>
        </form>

        {isPaused ? (
          <form action={activateFacilitatorProfileAction} className="rounded-[20px] border border-[#D7E4D1] bg-[#F3F7F0] p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#5F7A55]">Aktivér</p>
            <h2 className="mt-1 text-lg font-semibold text-[#2F2437]">Aktivér profil igen</h2>
            <p className="mt-2 text-sm leading-6 text-[#6E6475]">
              Når du aktiverer profilen igen, kan din offentlige profil og dine aktive events vises på SoulEvents efter de eksisterende regler.
            </p>
            <button className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-[#5F7A55] px-5 text-sm font-semibold text-white" type="submit">
              Aktivér profil igen
            </button>
          </form>
        ) : (
          <form action={requestFacilitatorProfileClosureAction} className="rounded-[20px] border border-[#E9CED6] bg-[#FFF8FA] p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Pause</p>
            <h2 className="mt-1 text-lg font-semibold text-[#2F2437]">Sæt profil på pause</h2>
            <p className="mt-2 text-sm leading-6 text-[#6E6475]">
              Har du brug for en pause, kan du midlertidigt skjule din profil på SoulEvents.
            </p>
            <p className="mt-2 text-sm leading-6 text-[#6E6475]">
              Din offentlige profil og dine kommende events bliver skjult. Du kan selv aktivere profilen igen, når du ønsker at vende tilbage.
            </p>
            <p className="mt-2 text-sm leading-6 text-[#6E6475]">
              Ønsker du i stedet at få slettet din profil og dine data, kan du skrive det i kommentarfeltet nedenfor.
            </p>
            <label className="mt-4 grid gap-2 text-sm font-semibold text-[#2F2437]">
              Kommentar (valgfri)
              <textarea className="min-h-24 rounded-md border border-[#E5DDEA] bg-white p-3 outline-none focus:border-[#7A5D91]" maxLength={500} name="reason" placeholder="Skriv gerne hvorfor du ønsker pause. Hvis du ønsker datasletning, så skriv det her." />
            </label>
            <label className="mt-4 flex items-start gap-3 text-sm font-semibold text-[#2F2437]">
              <input className="mt-1 size-4 accent-[#7A5D91]" name="confirm_closure" type="checkbox" />
              Jeg er sikker på, at jeg ønsker at sætte min arrangørprofil på pause.
            </label>
            <button className="mt-4 inline-flex h-11 items-center justify-center rounded-full border border-[#7A5D91] bg-white px-5 text-sm font-semibold text-[#7A5D91]" type="submit">
              Sæt profil på pause
            </button>
          </form>
        )}
      </div>

      {adminMessages.length > 0 ? (
        <section className="mt-5 rounded-[20px] bg-[#F4F0F7] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[#2F2437]">Dine seneste beskeder med SoulEvents administration</h2>
              <p className="mt-1 text-sm leading-6 text-[#6E6475]">
                Dine seneste beskeder og svar fra SoulEvents administration. Dine beskeder gemmes i op til 3 måneder og slettes derefter automatisk.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {adminMessages.map((item) => (
              <article className="rounded-[16px] bg-white p-4 text-sm" key={item.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    {item.type === "admin_reply" ? (
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7A5D91]">SoulEvents Team</p>
                    ) : null}
                    <p className="mt-1 font-semibold text-[#2F2437]">{item.subject}</p>
                  </div>
                  <span className="rounded-full bg-[#FAF7F2] px-3 py-1 text-xs font-semibold text-[#6E6475]">
                    <MessageStatusLabel status={item.status} type={item.type} />
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold text-[#8B7F93]">
                  Sendt {formatDateTime(item.created_at)}
                </p>
                <p className="mt-2 leading-6 text-[#6E6475]">{item.message}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </details>
  );
}

export default async function FacilitatorPage({ searchParams }: FacilitatorPageProps) {
  const [{ message, messages }, profile] = await Promise.all([searchParams, requireRole("facilitator")]);
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

  const status = facilitatorProfile?.status ?? "pending";
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
  const profileSpecialties = splitSpecialties(facilitatorProfile?.specialties);
  const profilePlace = facilitatorProfile?.city || null;
  const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(profile.id);
  const authProviders = authUserData.user?.identities?.map((identity) => identity.provider).filter(Boolean) ?? [];
  const passwordLoginAvailable = !authUserError && (authProviders.length === 0 || authProviders.includes("email"));
  const primaryOauthProvider = resolveCurrentOauthProvider({
    appProvider: authUserData.user?.app_metadata?.provider,
    appProviders: authUserData.user?.app_metadata?.providers,
    identities: authUserData.user?.identities,
    lastSignInAt: authUserData.user?.last_sign_in_at,
  });
  const now = new Date();
  const [
    { data: events },
    { data: adminMessages },
    { count: unreadAdminMessageCount },
    { data: pendingBookingRows },
    { data: coOrganizerInvitations },
    { data: latestChangeRequest },
    { data: pendingEmailChange },
  ] =
    facilitatorProfile
      ? await Promise.all([
          supabase
            .from("events")
            .select("id, slug, title, status, starts_at, ends_at, created_at, updated_at, address_line, postal_code, city, country, long_description, cover_image_path, event_format, online_url_or_note, price_cents, capacity, event_reference_id, event_categories(categories(name)), event_main_categories(main_category_id), event_tags(tag_id), bookings(id)")
            .eq("facilitator_id", facilitatorProfile.id)
            .order("starts_at", { ascending: false }),
          supabase
            .from("facilitator_admin_messages")
            .select("id, subject, message, type, status, created_at, facilitator_read_at")
            .eq("facilitator_id", facilitatorProfile.id)
            .order("created_at", { ascending: false })
            .limit(3),
          supabase
            .from("facilitator_admin_messages")
            .select("id", { count: "exact", head: true })
            .eq("facilitator_id", facilitatorProfile.id)
            .eq("type", "admin_reply")
            .eq("status", "unread"),
          supabase
            .from("bookings")
            .select("id, event_id, events!inner(id, facilitator_id, starts_at, ends_at, status)")
            .eq("events.facilitator_id", facilitatorProfile.id)
            .eq("status", "pending")
            .in("events.status", ["active", "sold_out"]),
          supabase
            .from("event_co_organizers")
            .select("id, status, response_token, events(id, slug, title, starts_at, status, facilitator_profiles!events_facilitator_id_fkey(company_name, profiles!facilitator_profiles_profile_id_fkey(full_name)))")
            .eq("co_organizer_profile_id", facilitatorProfile.id)
            .in("status", ["pending", "accepted"])
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
            .from("email_change_requests")
            .select("new_email, expires_at")
            .eq("profile_id", profile.id)
            .eq("status", "pending")
            .order("requested_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])
      : [{ data: [] }, { data: [] }, { count: 0 }, { data: [] }, { data: [] }, { data: null }, { data: null }];

  const eventRows = (events ?? []) as any[];
  const currentPendingBookingRows = ((pendingBookingRows ?? []) as Array<{
    event_id?: string | null;
    events?: { ends_at?: string | null; starts_at?: string | null } | Array<{ ends_at?: string | null; starts_at?: string | null }> | null;
  }>).filter((booking) => {
    const event = Array.isArray(booking.events) ? booking.events[0] : booking.events;
    const eventEndsAt = event?.ends_at ?? event?.starts_at;
    return eventEndsAt ? new Date(eventEndsAt) >= now : false;
  });
  const pendingBookingCount = currentPendingBookingRows.length;
  const pendingBookingsHref = currentPendingBookingRows[0]?.event_id
    ? "/facilitator/bookings?event=" + currentPendingBookingRows[0].event_id
    : "/facilitator/bookings";
  const limitStatus = facilitatorProfile
    ? await getFacilitatorEventLimitStatus(supabase, facilitatorProfile.id)
    : { activeCount: 0, draftCount: 0, maxActiveEvents: 10, maxDraftEvents: 5 };
  const messageRows = (adminMessages ?? []) as any[];
  const coOrganizerRows = (coOrganizerInvitations ?? []) as any[];
  const pendingCoOrganizerInvitations = coOrganizerRows.filter((row) => row.status === "pending");
  const acceptedCoOrganizerInvitations = coOrganizerRows.filter((row) => row.status === "accepted");
  const unreadMessageCount = unreadAdminMessageCount ?? 0;
  const activeEvents = eventRows.filter((event) => ["active", "sold_out", "pending_review"].includes(event.status) && !isPastEvent(event, now));
  const completedEvents = eventRows.filter((event) => isPastEvent(event, now));
  const visibleCompletedEvents = completedEvents.filter((event) => !isOlderThanMonths(eventEndDate(event), now, 12));
  const draftEvents = eventRows.filter((event) => event.status === "draft");
  const profileReadiness = getProfileReadiness({
    categoryCount: categoryNames.length,
    facilitatorProfile,
    fullName: profile.full_name,
  });
  const onboardingState = await getFacilitatorOnboardingStateForProfile(supabase, {
    fullName: profile.full_name,
    profileId: profile.id,
  });

  if (onboardingState === "onboarding") {
    redirect("/facilitator/profile");
  }

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
      <header className="border-b border-[#E5DDEA] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#6E6475] transition hover:text-[#7A5D91]" href="/">
            SoulEvents.dk
          </Link>
          <div className="flex items-center gap-3">
            {unreadMessageCount > 0 ? (
              <form action={markFacilitatorAdminMessagesReadAction}>
                <button className="inline-flex h-10 items-center gap-2 rounded-full border border-[#D8CBE4] bg-white px-3 text-sm font-semibold text-[#2F2437] transition hover:border-[#7A5D91]" type="submit">
                  <Mail className="size-4 text-[#7A5D91]" aria-hidden="true" />
                  Beskeder
                  <span className="grid size-5 place-items-center rounded-full bg-[#B56F8A] text-[11px] font-bold text-white">{unreadMessageCount}</span>
                </button>
              </form>
            ) : null}
            <SignOutButton />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <AuthMessage message={message} />

          <DashboardGreetingIntro name={profile.full_name} profileReadiness={profileReadiness} />

          <ProfileIdentityHeader
            actions={<DashboardHeaderActions fullProfileHref={fullProfileHref} primaryAction={primaryAction} />}
            categories={categoryNames.map((category) => ({
              colorHex: category.color_hex,
              name: category.name,
            }))}
            coverImage={heroImage}
            name={profileName}
            place={profilePlace}
            profileImageUrl={profileImageUrl}
            specialties={profileSpecialties}
          />

          <AdminMessageCta unreadCount={unreadMessageCount} />

          <MoodImageStrip isUsingFallbackMoodImage={moodImageFallback.isUsingFallback} moodImages={visibleMoodImages} />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-6">

          {onboardingState === "changes_requested" ? (
            <ProfileChangesRequestedCard canSubmit={profileReadiness.isComplete} request={profileChangeRequest} />
          ) : null}

          {profileReadiness.isComplete ? <BookingAttentionCard pendingCount={pendingBookingCount ?? 0} pendingHref={pendingBookingsHref} /> : null}

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
                    {draftEvents.length + activeEvents.length + visibleCompletedEvents.length > 0
                      ? "Her finder du dine kladder, kommende events og tidligere events."
                      : "Hvert event begynder med en idé. Når du opretter dit første event, bliver det synligt for mennesker over hele Danmark, som søger netop den oplevelse, du skaber."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <EventCountPill label="Kladder" value={draftEvents.length} />
                    <EventCountPill label="Aktive" value={activeEvents.length} />
                    <EventCountPill label="Afsluttede" value={visibleCompletedEvents.length} />
                  </div>
                </div>
                {draftEvents.length + activeEvents.length + visibleCompletedEvents.length === 0 ? (
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
                <EventGrid
                  events={draftEvents}
                  facilitatorStatus={facilitatorProfile?.status}
                  id="kladder"
                  title="Kladder"
                  variant="draft"
                />
                <EventGrid
                  events={activeEvents}
                  facilitatorStatus={facilitatorProfile?.status}
                  id="aktive-events"
                  title="Aktive events"
                  variant="active"
                />
                {visibleCompletedEvents.length > 0 ? (
                  <details className="rounded-[24px] border border-[#E5DDEA] bg-[#FAF8F4] p-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-[#2F2437]">
                      Se tidligere events ({visibleCompletedEvents.length})
                      <ChevronDown className="size-4 text-[#A08BB4]" aria-hidden="true" />
                    </summary>
                    <div className="mt-5 border-t border-[#E5DDEA] pt-5">
                      <EventGrid
                        events={visibleCompletedEvents.slice(0, 12)}
                        facilitatorStatus={facilitatorProfile?.status}
                        id="tidligere-events"
                        title="Tidligere events"
                        variant="completed"
                      />
                    </div>
                  </details>
                ) : null}
              </div>
            </section>
          ) : null}

            </div>

            <DashboardSupportAside />
          </div>

          <SettingsPanel
            adminMessages={messageRows}
            currentEmail={profile.email}
            isOpen={unreadMessageCount > 0 || messages === "open"}
            isPaused={Boolean(facilitatorProfile?.is_paused)}
            oauthProvider={primaryOauthProvider}
            passwordLoginAvailable={passwordLoginAvailable}
            pendingEmailChange={pendingEmailChange}
            unreadMessageCount={unreadMessageCount}
          />
        </div>
      </section>
    </main>
  );
}
