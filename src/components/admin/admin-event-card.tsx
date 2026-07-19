import Image from "next/image";
import Link from "next/link";
import { Archive, CalendarDays, Check, Clock3, Eye, MoreHorizontal, RotateCcw, Slash, UserRound } from "lucide-react";
import { markAdminEventReviewedAction, updateAdminEventStatusAction } from "@/app/admin/events/actions";
import { AdminActionMenu } from "@/components/admin/action-menu";
import { cn } from "@/lib/utils";
import type { EventStatus } from "@/types/database";

type AdminEventCardProps = {
  activeBookingCount: number;
  categories: string[];
  cityOrRegion: string;
  event: {
    created_at: string | null;
    id: string;
    price_cents: number | null;
    published_at: string | null;
    reviewed_at: string | null;
    slug: string | null;
    starts_at: string | null;
    status: EventStatus;
    title: string;
    updated_at: string | null;
  };
  eventImageUrl: string | null;
  facilitator: {
    email: string | null;
    id: string | null;
    imageUrl: string | null;
    isApproved: boolean;
    name: string;
    profileHref: string | null;
  };
  latestNotificationLine: string | null;
  publicEventHref: string;
};

const statusLabels: Record<string, string> = {
  active: "Publiceret",
  archived: "Arkiveret",
  cancelled: "Aflyst",
  completed: "Afholdt",
  draft: "Kladde",
  pending_review: "Legacy",
  rejected: "Skjult",
  sold_out: "Udsolgt",
};

const statusClasses: Record<string, string> = {
  active: "border-sage-200 bg-sage-50 text-sage-800",
  archived: "border-midnight/10 bg-midnight/5 text-ink/70",
  cancelled: "border-rose/20 bg-rose/10 text-rose",
  completed: "border-[#E8DEC8] bg-sand text-midnight",
  draft: "border-midnight/10 bg-midnight/5 text-ink/72",
  pending_review: "border-terracotta/20 bg-terracotta/10 text-terracotta",
  rejected: "border-rose/20 bg-rose/10 text-rose",
  sold_out: "border-[#D9CBAA] bg-[#F7F0DE] text-[#766338]",
};

function EventStatusButton({ eventId, status, children }: { children: React.ReactNode; eventId: string; status: EventStatus }) {
  return (
    <form action={updateAdminEventStatusAction}>
      <input name="event_id" type="hidden" value={eventId} />
      <input name="status" type="hidden" value={status} />
      <button
        className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
        type="submit"
      >
        {children}
      </button>
    </form>
  );
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Mangler";
  return new Intl.DateTimeFormat("da-DK", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatMoney(cents: number | null | undefined) {
  if (!cents) return "Gratis";
  return new Intl.NumberFormat("da-DK", { currency: "DKK", maximumFractionDigits: 0, style: "currency" }).format(cents / 100);
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[14px] border border-midnight/8 bg-[#FBFAF7] px-3 py-2">
      <dt className="text-[0.68rem] font-bold uppercase tracking-wide text-ink/45">{label}</dt>
      <dd className="mt-1 min-w-0 break-words text-sm font-semibold leading-5 text-midnight">{value}</dd>
    </div>
  );
}

export function AdminEventCard({
  activeBookingCount,
  categories,
  cityOrRegion,
  event,
  eventImageUrl,
  facilitator,
  latestNotificationLine,
  publicEventHref,
}: AdminEventCardProps) {
  const isPublic = ["active", "sold_out"].includes(event.status);
  const isReviewed = Boolean(event.reviewed_at);
  const canMarkReviewed = isPublic && !isReviewed;

  return (
    <article className="grid gap-4 rounded-[22px] border border-midnight/10 bg-white p-4 shadow-soft transition hover:border-midnight/15 sm:p-5 lg:grid-cols-[8.5rem_minmax(0,1fr)]">
      <div className="relative aspect-[4/3] min-h-28 overflow-hidden rounded-[18px] border border-midnight/10 bg-[#F4F0EA] lg:aspect-auto lg:h-full lg:min-h-36">
        {eventImageUrl ? (
          <Image alt="" className="object-cover" fill sizes="(min-width: 1024px) 136px, 100vw" src={eventImageUrl} />
        ) : (
          <div className="grid size-full place-items-center text-sage-700">
            <CalendarDays className="size-9" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="grid min-w-0 gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className={cn("rounded-full border px-2.5 py-1 text-xs font-bold", statusClasses[event.status] ?? "border-midnight/10 bg-midnight/5 text-ink/72")}>
            {statusLabels[event.status] ?? event.status}
          </span>
          {isReviewed ? (
            <span className="rounded-full border border-sage-200 bg-sage-50 px-2.5 py-1 text-xs font-bold text-sage-800">Kontrolleret</span>
          ) : isPublic ? (
            <span className="rounded-full border border-[#E8D6A8] bg-[#FFF8E8] px-2.5 py-1 text-xs font-bold text-[#8A6A2E]">Ikke kontrolleret</span>
          ) : null}
          {event.status === "pending_review" ? (
            <span className="rounded-full border border-midnight/10 bg-white px-2.5 py-1 text-xs font-semibold text-ink/50">Legacy-status</span>
          ) : null}
        </div>

        <div className="min-w-0">
          <h3 className="break-words text-xl font-semibold leading-tight text-midnight">{event.title}</h3>
          <div className="mt-2 flex min-w-0 items-center gap-2 text-sm text-ink/65">
            <span className="relative size-9 shrink-0 overflow-hidden rounded-[10px] border border-white bg-[#F4F0EA] shadow-soft">
              {facilitator.imageUrl ? (
                <Image alt="" className="object-cover" fill sizes="36px" src={facilitator.imageUrl} />
              ) : (
                <span className="grid size-full place-items-center text-sage-700">
                  <UserRound className="size-4" aria-hidden="true" />
                </span>
              )}
            </span>
            <span className="min-w-0 break-words">
              <span className="font-semibold text-midnight">{facilitator.name}</span>
              {facilitator.email ? <span className="text-ink/58"> · {facilitator.email}</span> : null}
            </span>
          </div>
          {!facilitator.isApproved && event.status !== "active" ? (
            <p className="mt-2 text-sm font-semibold text-[#8A6A2E]">Arrangøren skal godkendes, før eventet kan publiceres.</p>
          ) : null}
        </div>

        <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MetaItem label="Afholdes" value={formatDateTime(event.starts_at)} />
          <MetaItem label="Område" value={cityOrRegion} />
          <MetaItem label="Tilmeldte" value={new Intl.NumberFormat("da-DK").format(activeBookingCount)} />
          <MetaItem label="Pris" value={formatMoney(event.price_cents)} />
        </dl>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium leading-5 text-ink/50">
          <span>Oprettet {formatDateTime(event.created_at)}</span>
          <span>Offentliggjort {formatDateTime(event.published_at ?? event.created_at)}</span>
          <span>Senest ændret {formatDateTime(event.updated_at)}</span>
          {event.reviewed_at ? <span>Kontrolleret {formatDateTime(event.reviewed_at)}</span> : null}
        </div>

        {latestNotificationLine ? <p className="text-xs font-semibold leading-5 text-[#6E5A86]">{latestNotificationLine}</p> : null}

        {categories.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <span className="rounded-full bg-sage-50 px-2.5 py-1 text-xs font-semibold text-sage-700" key={category}>
                {category}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t border-midnight/8 pt-3">
          <Link
            className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-midnight px-4 text-sm font-semibold text-white transition hover:bg-midnight/90"
            href={publicEventHref}
          >
            <Eye className="size-4" aria-hidden="true" />
            Åbn
          </Link>

          {canMarkReviewed ? (
            <form action={markAdminEventReviewedAction}>
              <input name="event_id" type="hidden" value={event.id} />
              <button
                className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-sage-700 px-4 text-sm font-semibold text-white transition hover:bg-sage-800"
                type="submit"
              >
                <Check className="size-4" aria-hidden="true" />
                Marker som kontrolleret
              </button>
            </form>
          ) : null}

          <AdminActionMenu id={event.id} label="Flere">
            <div className="grid gap-3">
              <div>
                <p className="px-1 text-xs font-bold uppercase tracking-wide text-ink/45">Navigation</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {facilitator.profileHref ? (
                    <Link className="inline-flex h-9 items-center gap-2 rounded-full border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700" href={facilitator.profileHref}>
                      <UserRound className="size-4" aria-hidden="true" />
                      Se arrangør
                    </Link>
                  ) : null}
                </div>
              </div>

              <div>
                <p className="px-1 text-xs font-bold uppercase tracking-wide text-ink/45">Publicering</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {event.status !== "active" && facilitator.isApproved ? (
                    <EventStatusButton eventId={event.id} status="active">
                      <RotateCcw className="size-4" aria-hidden="true" />
                      Genpublicér
                    </EventStatusButton>
                  ) : null}
                  {event.status !== "active" && !facilitator.isApproved ? (
                    <button
                      className="inline-flex h-9 cursor-not-allowed items-center gap-2 rounded-full border border-[#E8D6A8] bg-[#FFF8E8] px-3 text-sm font-semibold text-[#8A6A2E]"
                      disabled
                      title="Arrangøren skal godkendes først"
                      type="button"
                    >
                      <Clock3 className="size-4" aria-hidden="true" />
                      Arrangør afventer
                    </button>
                  ) : null}
                  {event.status !== "rejected" ? (
                    <EventStatusButton eventId={event.id} status="rejected">
                      <Slash className="size-4" aria-hidden="true" />
                      Skjul
                    </EventStatusButton>
                  ) : null}
                </div>
              </div>

              <div className="border-t border-midnight/10 pt-3">
                <p className="px-1 text-xs font-bold uppercase tracking-wide text-ink/45">Administration</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {event.status !== "archived" ? (
                    <EventStatusButton eventId={event.id} status="archived">
                      <Archive className="size-4" aria-hidden="true" />
                      Arkiver
                    </EventStatusButton>
                  ) : null}
                  {event.status !== "pending_review" ? (
                    <EventStatusButton eventId={event.id} status="pending_review">
                      <MoreHorizontal className="size-4" aria-hidden="true" />
                      Sæt legacy-status
                    </EventStatusButton>
                  ) : null}
                </div>
              </div>
            </div>
          </AdminActionMenu>
        </div>
      </div>
    </article>
  );
}
