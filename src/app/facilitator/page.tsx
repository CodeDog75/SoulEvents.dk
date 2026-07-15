import {
  ArrowRight,
  Bell,
  CalendarCheck2,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  Inbox,
  Leaf,
  Mail,
  PauseCircle,
  PencilLine,
  RotateCcw,
  Settings,
  Ticket,
  XCircle,
} from "lucide-react";
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { activateFacilitatorProfileAction, requestFacilitatorProfileClosureAction, sendFacilitatorAdminMessageAction } from "@/app/facilitator/actions";
import { updateEventStatusAction, copyEventAsDraftAction, deleteDraftEventAction, publishDraftEventAction } from "@/app/facilitator/events/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { FacilitatorProfilePreview } from "@/components/facilitator/facilitator-profile-preview";
import { requireRole } from "@/lib/auth/roles";
import { draftLimitMessage, getFacilitatorEventLimitStatus } from "@/lib/events/event-limits";
import { getDraftPublishReadiness } from "@/lib/events/draft-publish-readiness";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type FacilitatorPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

type CategoryRelation = {
  categories?: { name: string; color_hex?: string } | { name: string; color_hex?: string }[] | null;
};

type MoodImage = {
  image_path: string;
  alt_text: string | null;
  sort_order: number;
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

function splitOtherTreatmentForms(input: string | null | undefined) {
  return (input ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2);
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

function getProfileReadiness({
  categoryCount,
  facilitatorProfile,
}: {
  categoryCount: number;
  facilitatorProfile: any;
}): ProfileReadiness {
  const missingItems = [];
  const shortDescription = facilitatorProfile?.short_description?.trim() ?? "";

  if (!facilitatorProfile?.company_name?.trim()) {
    missingItems.push("Profilnavn");
  }

  if (shortDescription.length < 20) {
    missingItems.push("Kort præsentation");
  }

  if (!facilitatorProfile?.profile_image_path) {
    missingItems.push("Profilbillede");
  }

  if (!facilitatorProfile?.postal_code?.trim() || !facilitatorProfile?.city?.trim()) {
    missingItems.push("Postnummer og by");
  }

  if (categoryCount === 0) {
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

function DashboardActionCard({ action, fullProfileHref }: { action: DashboardAction; fullProfileHref?: string | null }) {
  const Icon = action.icon;

  return (
    <div className="w-full rounded-[24px] border border-[#D8CBE4] bg-[#F4F0F7] p-5 shadow-[0_10px_30px_rgba(122,93,145,0.10)] md:max-w-[320px] md:p-6">
      <div className="hidden md:block">
        <h2 className="text-2xl font-semibold leading-tight text-[#2F2437]">🌿 {action.title}</h2>
        <p className="mt-3 text-sm leading-6 text-[#6E6475]">{action.description}</p>
      </div>
      <p className="mb-3 text-center text-xs font-medium leading-5 text-[#6E6475] md:hidden">{action.description}</p>
      {action.isDisabled ? (
        <div className="mt-4 rounded-[18px] border border-[#D8CBE4] bg-white/80 p-4 text-sm leading-6 text-[#6E6475]">
          <p className="font-semibold text-[#2F2437]">{action.title}</p>
          <p className="mt-1">{action.description}</p>
        </div>
      ) : (
        <div className="grid gap-2 md:mt-6">
          <Link
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#7A5D91] px-5 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-[#6E5285] hover:shadow-[0_8px_18px_rgba(122,93,145,0.18)]"
            href={action.href}
          >
            <Icon className="size-4" aria-hidden="true" />
            {action.label}
          </Link>
          {fullProfileHref ? (
            <Link
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[#D8CBE4] bg-white px-5 text-sm font-semibold text-[#6E5A86] shadow-soft transition hover:-translate-y-0.5 hover:border-[#7A5D91] hover:text-[#7A5D91]"
              href={fullProfileHref}
            >
              <Eye className="size-4" aria-hidden="true" />
              Vis profil
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}

function DashboardHeader({
  name,
  hostReferenceId,
  profileReadiness,
  primaryAction,
  fullProfileHref,
}: {
  fullProfileHref?: string | null;
  name: string | null;
  hostReferenceId?: string | null;
  profileReadiness: ProfileReadiness;
  primaryAction: DashboardAction;
}) {
  const statusClassName =
    profileReadiness.tone === "ready"
      ? "bg-[#DDE8D7] text-[#4E6A45]"
      : profileReadiness.tone === "paused"
        ? "bg-[#F4E7C8] text-[#7A6235]"
        : "bg-[#FFF7E8] text-[#8A6A2E]";

  return (
    <section className="overflow-hidden rounded-[28px] border border-[#E5DDEA] bg-white p-6 shadow-soft sm:p-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Arrangør</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight text-[#2F2437] sm:text-4xl">
            Hej {name || "og velkommen"} 🌿
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[#6E6475]">
            {profileReadiness.isComplete
              ? "Du er godt i gang. Dashboardet viser det næste naturlige skridt for dig."
              : "Velkommen til SoulEvents. Lad os gøre din profil klar, så deltagere trygt kan møde dig."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
            <span className={"inline-flex items-center gap-2 rounded-full px-4 py-2 " + statusClassName}>
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {profileReadiness.label}
            </span>
            {hostReferenceId ? (
              <span className="inline-flex items-center rounded-full bg-[#F4F0F7] px-4 py-2 text-[#6E5A86]">
                Medlemsnummer {hostReferenceId}
              </span>
            ) : null}
          </div>
          <div className="mt-5 rounded-[20px] bg-[#FAF7F2] p-4 text-sm leading-6 text-[#6E6475]">
            <p className="font-semibold text-[#2F2437]">{profileReadiness.message}</p>
            {profileReadiness.missingItems.length > 0 ? (
              <div className="mt-3">
                <p className="font-semibold text-[#2F2437]">Du mangler kun:</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profileReadiness.missingItems.map((item) => (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#8A6A2E] shadow-sm" key={item}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <DashboardActionCard action={primaryAction} fullProfileHref={fullProfileHref} />
      </div>
    </section>
  );
}

function ProfileStatusPanel({ profileReadiness }: { profileReadiness: ProfileReadiness }) {
  const toneClass =
    profileReadiness.tone === "ready"
      ? "border-[#C7DDBC] bg-[#F4FAF1] text-[#4E6A45]"
      : profileReadiness.tone === "paused"
        ? "border-[#E6D4A8] bg-[#FFF8E8] text-[#7A6235]"
        : "border-[#E8D6A8] bg-[#FFF9EC] text-[#8A6A2E]";

  return (
    <section className={"rounded-[24px] border p-4 shadow-soft " + toneClass}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Profilstatus</p>
      <div className="mt-2 flex items-center gap-2">
        <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
        <p className="font-semibold">{profileReadiness.label}</p>
      </div>
      <p className="mt-2 text-sm leading-6 opacity-90">{profileReadiness.message}</p>
    </section>
  );
}

function StatsCard({
  description,
  icon: Icon,
  label,
  value,
  tone,
  href,
}: {
  description: string;
  icon: React.ElementType;
  label: string;
  value: number;
  tone: "lavender" | "sage" | "cream" | "rose";
  href: string;
}) {
  const tones = {
    lavender: "bg-[#F4F0F7] text-[#6E5A86]",
    sage: "bg-[#DDE8D7] text-[#4E6A45]",
    cream: "bg-[#FAF7F2] text-[#756758]",
    rose: "bg-[#F7E9EC] text-[#8B5B68]",
  };

  return (
    <Link
      className="group flex min-h-[88px] items-center gap-4 rounded-[18px] border border-[#E5DDEA] bg-white px-4 py-3 shadow-soft transition hover:-translate-y-0.5 hover:border-[#D8CBE4] hover:shadow-lg sm:rounded-[22px] sm:px-5 sm:py-4"
      href={href}
    >
      <span className={"grid size-10 shrink-0 place-items-center rounded-full sm:size-11 " + tones[tone]}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold leading-tight text-[#2F2437] sm:text-xl">
          {value} {label}
        </span>
        <span className="mt-1 block text-sm leading-5 text-[#6E6475]">{description}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-[#A08BB4] transition group-hover:translate-x-0.5 group-hover:text-[#7A5D91]" aria-hidden="true" />
    </Link>
  );
}

function BookingAttentionCard({ pendingCount }: { pendingCount: number }) {
  const hasPending = pendingCount > 0;

  return (
    <section
      className={
        "rounded-[24px] border p-5 shadow-soft sm:p-6 " +
        (hasPending ? "border-[#E8D6A8] bg-[#FFF9EC]" : "border-[#C9DAC1] bg-[#F3F8F0]")
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <span
            className={
              "mt-0.5 grid size-10 shrink-0 place-items-center rounded-full " +
              (hasPending ? "bg-[#FFF1D6] text-[#8A6A2E]" : "bg-[#DDE8D7] text-[#4E6A45]")
            }
          >
            {hasPending ? <Inbox className="size-5" aria-hidden="true" /> : <CheckCircle2 className="size-5" aria-hidden="true" />}
          </span>
          <div>
            <h2 className="text-lg font-semibold text-[#2F2437]">Tilmeldinger</h2>
            <p className="mt-1 text-sm leading-6 text-[#6E6475]">
              {hasPending
                ? `Du har ${pendingCount} ${pendingCount === 1 ? "tilmelding" : "tilmeldinger"}, der afventer din bekræftelse.`
                : "Alle aktuelle tilmeldinger er behandlet."}
            </p>
          </div>
        </div>
        {hasPending ? (
          <Link
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-[#7A5D91] px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-[#6E5285]"
            href="/facilitator/bookings"
          >
            Se tilmeldinger
          </Link>
        ) : null}
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

function EventCard({
  event,
  facilitatorStatus,
  maxTicketPricePerPerson,
  tone = "default",
}: {
  event: any;
  facilitatorStatus?: string | null;
  maxTicketPricePerPerson?: number | null;
  tone?: "default" | "muted";
}) {
  const categories =
    event.event_categories?.map((row: any) => first(row.categories)?.name).filter((name: string | undefined): name is string => Boolean(name)) ?? [];
  const bookingCount = event.bookings?.length ?? 0;
  const location = event.event_format === "online" ? "Online" : event.city || "Lokation kommer";
  const isDraft = event.status === "draft";
  const draftReadiness = isDraft
    ? getDraftPublishReadiness({
        event,
        facilitatorStatus,
        maxTicketPricePerPerson,
      })
    : null;
  const completedChecklistItems = draftReadiness?.checklist.filter((item) => item.valid).length ?? 0;
  const isActive = event.status === "active" || event.status === "sold_out";
  const isCopyableAsDraft =
    event.status === "active" ||
    event.status === "sold_out" ||
    event.status === "completed" ||
    event.status === "cancelled" ||
    new Date(event.starts_at) < new Date();
  const statusUpdatedLabel =
    event.status === "draft"
      ? "Kladde opdateret"
      : event.status === "active"
        ? "Aktiveret/senest opdateret"
        : event.status === "pending_review"
          ? "Sendt til godkendelse/senest opdateret"
          : event.status === "cancelled"
            ? "Deaktiveret/aflyst"
            : "Status opdateret";

  const cardClass =
    tone === "muted"
      ? "border-[#D8D2CA] bg-[#F1EEE9]"
      : isDraft
        ? "border-[#D8D2CA] bg-[#F1EEE9]"
        : "border-[#E5DDEA] bg-white";

  return (
    <article className={"rounded-[24px] border p-5 shadow-soft " + cardClass}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={"rounded-full px-3 py-1 text-xs font-semibold " + statusClass(event.status)}>{statusLabel(event.status)}</span>
        {event.event_reference_id ? <span className="rounded-full bg-[#FAF7F2] px-3 py-1 text-xs font-semibold text-[#6E6475]">Ref. {event.event_reference_id}</span> : null}
      </div>
      <h3 className="mt-4 text-xl font-semibold leading-tight text-[#2F2437]">{event.title || "Event uden titel"}</h3>
      <div className="mt-4 grid gap-2 text-sm text-[#6E6475]">
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
        <p className="inline-flex items-center gap-2">
          <Clock3 className="size-4 text-[#7A5D91]" aria-hidden="true" />
          {statusUpdatedLabel}: {formatDateTime(event.updated_at)}
        </p>
      </div>
      {categories.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((category: string) => (
            <span className="rounded-full bg-[#F4F0F7] px-3 py-1 text-xs font-semibold text-[#6E5A86]" key={category}>
              {category}
            </span>
          ))}
        </div>
      ) : null}
      {draftReadiness ? (
        <div
          className={
            "mt-5 rounded-[18px] border px-4 py-3 text-sm leading-6 " +
            (draftReadiness.canPublish
              ? "border-[#CFE3C8] bg-[#F3F7F0] text-[#4F6F48]"
              : "border-[#E8DEC9] bg-[#FBF5E8] text-[#6F5A35]")
          }
        >
          <p className="font-semibold">
            {draftReadiness.canPublish ? "🟢 Klar til offentliggørelse" : "🟡 Mangler før offentliggørelse"}
          </p>
          {draftReadiness.canPublish ? (
            <p className="mt-1">Alle oplysninger er udfyldt.</p>
          ) : (
            <>
              <div className="mt-3 grid gap-1">
                {draftReadiness.checklist.map((item) => (
                  <p className="flex items-center justify-between gap-3" key={item.key}>
                    <span>{item.valid ? "✅" : "❌"} {item.label}</span>
                  </p>
                ))}
              </div>
              <p className="mt-3 font-semibold">
                {completedChecklistItems} af {draftReadiness.checklist.length} krav opfyldt
              </p>
            </>
          )}
        </div>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-2">
        {draftReadiness?.canPublish ? (
          <div className="grid gap-2">
            <form action={publishDraftEventAction}>
              <input name="event_id" type="hidden" value={event.id} />
              <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#7A5D91] px-4 text-sm font-semibold text-white transition hover:bg-[#6E4F86]" type="submit">
                <ArrowRight className="size-4" aria-hidden="true" />
                Offentliggør event
              </button>
            </form>
            <p className="max-w-md text-xs leading-5 text-ink/58">
              Ved at offentliggøre bekræfter du, at eventet overholder SoulEvents&apos; gældende{" "}
              <Link className="font-semibold text-[#7A4EAB] underline underline-offset-4" href="/legal/arrangoervilkaar" target="_blank">
                arrangørvilkår
              </Link>{" "}
              og{" "}
              <Link className="font-semibold text-[#7A4EAB] underline underline-offset-4" href="/legal/platformens-retningslinjer" target="_blank">
                retningslinjer
              </Link>
              .
            </p>
          </div>
        ) : null}
        <Link
          className={
            "inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition " +
            (draftReadiness?.canPublish
              ? "border border-[#E5DDEA] bg-white text-[#2F2437] hover:border-[#7A5D91] hover:text-[#7A5D91]"
              : "bg-[#7A5D91] text-white hover:bg-[#6E4F86]")
          }
          href={"/facilitator/events?draft=" + event.id}
        >
          <PencilLine className="size-4" aria-hidden="true" />
          {isDraft ? "Fortsæt redigering" : "Rediger"}
        </Link>
        <Link
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#E5DDEA] bg-white px-4 text-sm font-semibold text-[#2F2437] transition hover:border-[#7A5D91] hover:text-[#7A5D91]"
          href={"/facilitator/bookings?event=" + event.id}
        >
          <Inbox className="size-4" aria-hidden="true" />
          Se tilmeldinger
        </Link>
        {isActive ? (
          <Link
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#E5DDEA] bg-white px-4 text-sm font-semibold text-[#2F2437] transition hover:border-[#7A5D91] hover:text-[#7A5D91]"
            href={"/events/" + event.id}
          >
            <ArrowRight className="size-4" aria-hidden="true" />
            Del event
          </Link>
        ) : null}
        {event.status === "draft" ? (
          <form action={deleteDraftEventAction}>
            <input name="event_id" type="hidden" value={event.id} />
            <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-800 transition hover:bg-red-100" type="submit">
              <XCircle className="size-4" aria-hidden="true" />
              Slet kladde
            </button>
          </form>
        ) : null}
        {isCopyableAsDraft ? (
          <form action={copyEventAsDraftAction}>
            <input name="event_id" type="hidden" value={event.id} />
            <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#E5DDEA] bg-[#F4F0F7] px-4 text-sm font-semibold text-[#6E5A86]" type="submit">
              <Copy className="size-4" aria-hidden="true" />
              Kopiér som nyt event
            </button>
          </form>
        ) : null}
        {event.status === "pending_review" ? (
          <StatusAction eventId={event.id} status="draft">
            <RotateCcw className="size-4" aria-hidden="true" />
            Fortryd indsendelse
          </StatusAction>
        ) : null}
        {event.status !== "cancelled" && event.status !== "draft" && event.status !== "pending_review" ? (
          <StatusAction eventId={event.id} status="cancelled">
            <PauseCircle className="size-4" aria-hidden="true" />
            Aflys
          </StatusAction>
        ) : null}
      </div>
    </article>
  );
}

function EventSection({
  title,
  text,
  events,
  facilitatorStatus,
  id,
  maxTicketPricePerPerson,
  tone = "default",
  emptyText = "Her vises dine events, når de er klar.",
}: {
  title: string;
  text?: string;
  events: any[];
  facilitatorStatus?: string | null;
  id?: string;
  maxTicketPricePerPerson?: number | null;
  tone?: "default" | "muted";
  emptyText?: string;
}) {
  return (
    <section id={id}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[#2F2437]">{title}</h2>
          {text ? <p className="mt-1 text-sm leading-6 text-[#6E6475]">{text}</p> : null}
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {events.length > 0 ? (
          events.map((event) => (
            <EventCard
              event={event}
              facilitatorStatus={facilitatorStatus}
              key={event.id}
              maxTicketPricePerPerson={maxTicketPricePerPerson}
              tone={tone}
            />
          ))
        ) : (
          <div className="rounded-[24px] border border-[#E5DDEA] bg-white p-6 text-sm leading-6 text-[#6E6475] shadow-soft lg:col-span-2">
            {emptyText}
          </div>
        )}
      </div>
    </section>
  );
}

function InsightCard({ events }: { events: any[] }) {
  const categoryCounts = events.reduce<Record<string, number>>((acc, event) => {
    for (const row of event.event_categories ?? []) {
      const name = first(row.categories)?.name;
      if (name) acc[name] = (acc[name] ?? 0) + 1;
    }
    return acc;
  }, {});
  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  if (topCategories.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[24px] border border-[#E5DDEA] bg-white p-5 shadow-soft sm:p-6">
      <h2 className="text-xl font-semibold text-[#2F2437]">Indblik</h2>
      <p className="mt-1 text-sm text-[#6E6475]">Små mønstre og kategorier, når der er nok data.</p>
      {topCategories.length > 0 ? (
        <div className="mt-5">
          <p className="text-sm font-semibold text-[#2F2437]">Mest brugte kategorier</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {topCategories.map(([name, count]) => (
              <span className="rounded-full bg-[#F4F0F7] px-3 py-1 text-xs font-semibold text-[#6E5A86]" key={name}>
                {name} · {count}
              </span>
            ))}
          </div>
        </div>
      ) : null}
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
    <a
      className="flex items-center justify-between gap-4 rounded-[24px] border border-[#D8CBE4] bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg"
      href="#beskeder-admin"
    >
      <span className="flex min-w-0 items-center gap-4">
        <span className="relative grid size-12 shrink-0 place-items-center rounded-full bg-[#F4F0F7] text-[#7A5D91]">
          <Bell className="size-5" aria-hidden="true" />
          <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-[#B56F8A] text-[11px] font-bold text-white">
            {unreadCount}
          </span>
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-[#2F2437]">
            {unreadCount === 1 ? "Ny besked fra SoulEvents administration" : "Nye beskeder fra SoulEvents administration"}
          </span>
          <span className="mt-1 block text-sm leading-5 text-[#6E6475]">
            Åbn dialogen og marker beskeden som læst.
          </span>
        </span>
      </span>
      <ArrowRight className="size-5 shrink-0 text-[#A08BB4]" aria-hidden="true" />
    </a>
  );
}

function SettingsPanel({ adminMessages, isPaused, unreadMessageCount }: { adminMessages: any[]; isPaused: boolean; unreadMessageCount: number }) {

  return (
    <details className="rounded-[18px] border border-[#E5DDEA] bg-white/70 shadow-soft" id="beskeder-admin" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[#6E6475] transition hover:text-[#7A5D91]">
        <span className="inline-flex items-center gap-2">
          <Settings className="size-4 text-[#7A5D91]" aria-hidden="true" />
          Din kontakt med SoulEvents
        </span>
        <span className="text-lg leading-none text-[#A08BB4]">⌄</span>
      </summary>
      <div className="grid gap-4 border-t border-[#E5DDEA] p-4 lg:grid-cols-2">
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
          <form action={requestFacilitatorProfileClosureAction} className="rounded-[20px] border border-[#E5DDEA] bg-[#FAF7F2] p-5">
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
                  <p className="font-semibold text-[#2F2437]">{item.subject}</p>
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
  const [{ message }, profile] = await Promise.all([searchParams, requireRole("facilitator")]);
  const supabase = createAdminClient();
  const { data: facilitatorProfile } = await supabase
    .from("facilitator_profiles")
    .select(
      "id, status, is_paused, is_disabled, host_reference_id, company_name, profile_image_path, address_line, city, postal_code, short_description, offers_services, service_description, service_other_title, is_active_host, is_experienced_host, max_ticket_price_per_person, facilitator_categories(category_id, categories(name, color_hex)), facilitator_tags(tag_id, tags(name)), facilitator_images(image_path, alt_text, sort_order), facilitator_service_titles(service_title_id, service_titles(name, is_active))",
    )
    .eq("profile_id", profile.id)
    .single();

  const status = facilitatorProfile?.status ?? "pending";
  const hostReferenceId = facilitatorProfile?.host_reference_id ?? null;
  const profileImageUrl = facilitatorProfile?.profile_image_path
    ? supabase.storage.from("media").getPublicUrl(facilitatorProfile.profile_image_path).data.publicUrl
    : null;
  const profileName = facilitatorProfile?.company_name || profile.full_name || "Personlig profil";
  const fullProfileHref = facilitatorProfile?.id ? "/facilitators/" + facilitatorProfile.id + "?facilitator_return=/facilitator" : null;
  const categoryNames =
    facilitatorProfile?.facilitator_categories
      ?.map((row: CategoryRelation) => (Array.isArray(row.categories) ? row.categories[0] : row.categories))
      .filter((category): category is { name: string; color_hex?: string } => Boolean(category)) ?? [];
  const serviceTitleNames =
    facilitatorProfile?.offers_services
      ? facilitatorProfile.facilitator_service_titles
          ?.map((row: any) => (Array.isArray(row.service_titles) ? row.service_titles[0] : row.service_titles))
          .filter((title: any) => Boolean(title?.name))
          .map((title: { name: string }) => title.name) ?? []
      : [];
  const otherTreatmentForms = facilitatorProfile?.offers_services
    ? splitOtherTreatmentForms(facilitatorProfile.service_other_title)
    : [];
  const tagNames =
    facilitatorProfile?.facilitator_tags
      ?.map((row: any) => (Array.isArray(row.tags) ? row.tags[0] : row.tags))
      .filter((tag: any) => Boolean(tag?.name))
      .map((tag: { name: string }) => tag.name) ?? [];
  const profileBadges = [
    facilitatorProfile?.is_experienced_host ? "experienced" : null,
    facilitatorProfile?.is_active_host ? "active" : null,
  ].filter(Boolean) as Array<"experienced" | "active">;

  const now = new Date();
  const [{ data: events }, { data: adminMessages }, { count: pendingBookingCount }] =
    facilitatorProfile
      ? await Promise.all([
          supabase
            .from("events")
            .select("id, title, status, starts_at, ends_at, created_at, updated_at, address_line, postal_code, city, country, long_description, cover_image_path, event_format, online_url_or_note, price_cents, capacity, event_reference_id, event_categories(categories(name)), event_main_categories(main_category_id), event_tags(tag_id), bookings(id)")
            .eq("facilitator_id", facilitatorProfile.id)
            .order("starts_at", { ascending: false }),
          supabase
            .from("facilitator_admin_messages")
            .select("id, subject, message, type, status, created_at")
            .eq("facilitator_id", facilitatorProfile.id)
            .order("created_at", { ascending: false })
            .limit(3),
          supabase
            .from("bookings")
            .select("id, events!inner(facilitator_id)", { count: "exact", head: true })
            .eq("events.facilitator_id", facilitatorProfile.id)
            .eq("status", "pending")
            .in("events.status", ["active", "sold_out"])
            .gte("events.ends_at", now.toISOString()),
        ])
      : [{ data: [] }, { data: [] }, { count: 0 }];

  const moodImages =
    facilitatorProfile?.facilitator_images
      ?.slice()
      .sort((a: MoodImage, b: MoodImage) => a.sort_order - b.sort_order)
      .map((image: MoodImage) => ({
        altText: image.alt_text,
        imagePath: image.image_path,
        url: supabase.storage.from("media").getPublicUrl(image.image_path).data.publicUrl,
      })) ?? [];

  const eventRows = (events ?? []) as any[];
  const limitStatus = facilitatorProfile
    ? await getFacilitatorEventLimitStatus(supabase, facilitatorProfile.id)
    : { activeCount: 0, draftCount: 0, maxActiveEvents: 10, maxDraftEvents: 5 };
  const messageRows = (adminMessages ?? []) as any[];
  const unreadMessageCount = 0;
  const activeEvents = eventRows.filter((event) => ["active", "sold_out", "pending_review"].includes(event.status) && !isPastEvent(event, now));
  const completedEvents = eventRows.filter((event) => isPastEvent(event, now));
  const heldEvents = completedEvents.filter((event) => event.status !== "cancelled");
  const draftEvents = eventRows.filter((event) => event.status === "draft");
  const profileReadiness = getProfileReadiness({
    categoryCount: categoryNames.length,
    facilitatorProfile,
  });
  const primaryAction = getDashboardAction({
    draftEvents,
    maxDraftEvents: limitStatus.maxDraftEvents,
    profileReadiness,
  });
  const hasDashboardActivity = activeEvents.length > 0 || draftEvents.length > 0 || completedEvents.length > 0 || (pendingBookingCount ?? 0) > 0;
  const showPerformanceDashboard = profileReadiness.isComplete && hasDashboardActivity;
  return (
    <main className="min-h-screen bg-[#F8F3FA] text-[#2F2437]">
      <header className="border-b border-[#E5DDEA] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#6E6475] transition hover:text-[#7A5D91]" href="/">
            SoulEvents.dk
          </Link>
          <SignOutButton />
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <div className="min-w-0 space-y-6">
          <AuthMessage message={message} />

          <DashboardHeader
            name={profile.full_name}
            hostReferenceId={hostReferenceId}
            profileReadiness={profileReadiness}
            primaryAction={primaryAction}
            fullProfileHref={fullProfileHref}
          />

          {showPerformanceDashboard ? (
            <div className="space-y-3">
              <section className="grid gap-3 sm:grid-cols-3">
                <StatsCard
                  description="Dine kommende events."
                  href="#aktive-events"
                  icon={CalendarCheck2}
                  label="Aktive events"
                  value={activeEvents.length}
                  tone="lavender"
                />
                <StatsCard
                  description={`Du har ${draftEvents.length} ${draftEvents.length === 1 ? "event" : "events"}, der mangler at blive færdiggjort.`}
                  href="#kladder"
                  icon={CalendarDays}
                  label="Kladder"
                  value={draftEvents.length}
                  tone="sage"
                />
                <StatsCard
                  description={`Du har afholdt i alt ${heldEvents.length} ${heldEvents.length === 1 ? "event" : "events"}.`}
                  href="#tidligere-events"
                  icon={Clock3}
                  label="Afholdte events"
                  value={heldEvents.length}
                  tone="cream"
                />
              </section>
              <BookingAttentionCard pendingCount={pendingBookingCount ?? 0} />
            </div>
          ) : profileReadiness.isComplete ? (
            <section className="rounded-[24px] border border-[#E5DDEA] bg-white p-5 shadow-soft sm:p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Næste skridt</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#2F2437]">Din profil er klar</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6E6475]">
                Fantastisk. Nu er du klar til at invitere mennesker til dit første event, mens SoulEvents gennemgår din profil.
              </p>
              <Link
                className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#7A5D91] px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-[#6E5285]"
                href="/facilitator/events"
              >
                <CalendarPlus className="size-4" aria-hidden="true" />
                Opret event
              </Link>
            </section>
          ) : null}

          <AdminMessageCta unreadCount={unreadMessageCount} />

          {profileReadiness.isComplete && draftEvents.length > 0 ? (
            <EventSection
              facilitatorStatus={facilitatorProfile?.status}
              id="kladder"
              maxTicketPricePerPerson={facilitatorProfile?.max_ticket_price_per_person}
              title="Kladder"
              text="Events du kan åbne og gøre færdige i dit eget tempo."
              events={draftEvents}
            />
          ) : null}

          {profileReadiness.isComplete ? (
            <EventSection id="aktive-events" title="Dine aktive events" text="Kommende events og events, der er ved at blive gjort klar." events={activeEvents} />
          ) : null}

          {showPerformanceDashboard ? <InsightCard events={eventRows} /> : null}

          {showPerformanceDashboard ? (
            <EventSection id="tidligere-events" title="Tidligere events" emptyText="Her vises dine events, når de er udløbet på dato." events={completedEvents.slice(0, 6)} tone="muted" />
          ) : null}

        </div>

        <aside className="w-full space-y-4 lg:self-start">
          <ProfileStatusPanel profileReadiness={profileReadiness} />

          <FacilitatorProfilePreview
            badges={profileBadges}
            categories={categoryNames.map((category) => ({
              colorHex: category.color_hex,
              name: category.name,
            }))}
            editHref="/facilitator/profile"
            fullProfileHref={fullProfileHref}
            city={facilitatorProfile?.city}
            introText="Sådan møder deltagerne dig på SoulEvents.dk."
            moodImages={moodImages}
            profileImageUrl={profileImageUrl}
            profileName={profileName}
            serviceDescription={facilitatorProfile?.offers_services ? facilitatorProfile.service_description : null}
            serviceTitles={[...serviceTitleNames, ...otherTreatmentForms, ...tagNames]}
            title="Din profilvisning"
            shortDescription={facilitatorProfile?.short_description}
          />

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

        <section className="lg:col-span-2">
          <SettingsPanel adminMessages={messageRows} isPaused={Boolean(facilitatorProfile?.is_paused)} unreadMessageCount={0} />
        </section>
      </section>
    </main>
  );
}
