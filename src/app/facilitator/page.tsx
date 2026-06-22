import {
  ArrowRight,
  Bell,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Copy,
  HeartHandshake,
  Inbox,
  Leaf,
  Mail,
  MessageCircle,
  PauseCircle,
  PencilLine,
  RotateCcw,
  Settings,
  Sparkles,
  Ticket,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { requestFacilitatorProfileClosureAction, sendFacilitatorAdminMessageAction } from "@/app/facilitator/actions";
import { updateEventStatusAction, copyEventAsDraftAction, deleteDraftEventAction } from "@/app/facilitator/events/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { FacilitatorProfilePreview } from "@/components/facilitator/facilitator-profile-preview";
import { requireRole } from "@/lib/auth/roles";
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

function formatDay(value: string) {
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium" }).format(new Date(value));
}

function statusLabel(status: string) {
  return statusLabels[status] ?? status;
}

function statusClass(status: string) {
  return statusStyles[status] ?? "bg-stone-100 text-stone-700";
}

function CreateEventCtaCard() {
  return (
    <div className="w-full rounded-[24px] border border-[#D8CBE4] bg-[#F4F0F7] p-5 shadow-[0_10px_30px_rgba(122,93,145,0.10)] md:max-w-[280px] md:p-6">
      <div className="hidden items-start justify-between gap-4 md:flex">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-[#2F2437]">🌿 Invitér til en oplevelse</h2>
          <p className="mt-1 text-sm leading-6 text-[#6E6475]">Skab et event og invitér mennesker ind i nærvær, fællesskab og udvikling.</p>
        </div>
        <span className="grid size-11 shrink-0 place-items-center rounded-full border border-[#D8CBE4] bg-white text-[#7A5D91]">
          <CalendarPlus className="size-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mb-3 text-center text-sm font-medium text-[#6E6475] md:hidden">Skab et event og invitér mennesker ind i nærvær, fællesskab og udvikling.</p>
      <Link
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#7A5D91] px-5 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-[#6E5285] hover:shadow-[0_8px_18px_rgba(122,93,145,0.18)] md:mt-5 md:h-11 md:w-auto md:px-5"
        href="/facilitator/events"
      >
        <CalendarPlus className="size-4" aria-hidden="true" />
        Opret event
      </Link>
    </div>
  );
}

function DashboardHeader({
  name,
  profileStatus,
  hostReferenceId,
}: {
  name: string | null;
  profileStatus: string;
  hostReferenceId?: string | null;
}) {
  const statusText =
    profileStatus === "approved"
      ? "Din profil er synlig"
      : profileStatus === "disabled"
        ? "Din profil er sat på pause"
        : "Din profil afventer godkendelse";

  return (
    <section className="overflow-hidden rounded-[28px] border border-[#E5DDEA] bg-white p-6 shadow-soft sm:p-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Arrangør</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight text-[#2F2437] sm:text-4xl">
            Hej {name || "og velkommen"} 🌿
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[#6E6475]">
            Her er dit overblik over dine events, tilmeldinger og din profil på SoulEvents.dk.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
            <span
              className={
                "inline-flex items-center gap-2 rounded-full px-4 py-2 " +
                (profileStatus === "disabled" ? "bg-[#F4E7C8] text-[#7A6235]" : "bg-[#DDE8D7] text-[#4E6A45]")
              }
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {statusText}
            </span>
            {hostReferenceId ? (
              <span className="inline-flex items-center rounded-full bg-[#F4F0F7] px-4 py-2 text-[#6E5A86]">
                Medlemsnummer {hostReferenceId}
              </span>
            ) : null}
          </div>
        </div>
        <CreateEventCtaCard />
      </div>
    </section>
  );
}

function StatsCard({
  icon: Icon,
  label,
  value,
  tone,
  href,
}: {
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
      <span className="flex min-w-0 flex-1 items-baseline gap-3">
        <span className="text-2xl font-semibold leading-none text-[#2F2437] sm:text-3xl">{value}</span>
        <span className="text-sm font-semibold leading-tight text-[#6E6475] sm:text-base">{label}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-[#A08BB4] transition group-hover:translate-x-0.5 group-hover:text-[#7A5D91]" aria-hidden="true" />
    </Link>
  );
}

function ActivityFeed({ items }: { items: Array<{ id: string; icon: React.ElementType; text: string; detail?: string }> }) {
  return (
    <section className="rounded-[24px] border border-[#E5DDEA] bg-white p-5 shadow-soft sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-[#F4F0F7] text-[#7A5D91]">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-semibold text-[#2F2437]">Det sker omkring dine events</h2>
          <p className="mt-1 text-sm text-[#6E6475]">Små tegn på aktivitet og bevægelse.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3">
        {items.length > 0 ? (
          items.map((item) => (
            <article className="flex gap-3 rounded-[18px] bg-[#FAF7F2] p-4" key={item.id}>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-[#7A5D91] shadow-sm">
                <item.icon className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#2F2437]">{item.text}</p>
                {item.detail ? <p className="mt-1 text-xs text-[#6E6475]">{item.detail}</p> : null}
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-[18px] bg-[#FAF7F2] p-4 text-sm leading-6 text-[#6E6475]">
            Når der kommer tilmeldinger, ændringer eller nye events, samler vi dem roligt her.
          </p>
        )}
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

function EventCard({ event }: { event: any }) {
  const categories =
    event.event_categories?.map((row: any) => first(row.categories)?.name).filter((name: string | undefined): name is string => Boolean(name)) ?? [];
  const bookingCount = event.bookings?.length ?? 0;
  const location = event.event_format === "online" ? "Online" : event.city || "Lokation kommer";
  const isDraft = event.status === "draft";
  const isActive = event.status === "active" || event.status === "sold_out";
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

  return (
    <article className={"rounded-[24px] border p-5 shadow-soft " + (isDraft ? "border-[#D8D2CA] bg-[#F1EEE9]" : "border-[#E5DDEA] bg-white")}>
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
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#7A5D91] px-4 text-sm font-semibold text-white transition hover:bg-[#6E4F86]"
          href={"/facilitator/events?draft=" + event.id}
        >
          <PencilLine className="size-4" aria-hidden="true" />
          {isDraft ? "Fortsæt redigering" : "Rediger"}
        </Link>
        <Link
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#E5DDEA] bg-white px-4 text-sm font-semibold text-[#2F2437] transition hover:border-[#7A5D91] hover:text-[#7A5D91]"
          href="/facilitator/bookings"
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
        {event.status === "completed" ? (
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

function EventSection({ title, text, events, id }: { title: string; text: string; events: any[]; id?: string }) {
  return (
    <section id={id}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[#2F2437]">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-[#6E6475]">{text}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {events.length > 0 ? (
          events.map((event) => <EventCard event={event} key={event.id} />)
        ) : (
          <div className="rounded-[24px] border border-[#E5DDEA] bg-white p-6 text-sm leading-6 text-[#6E6475] shadow-soft lg:col-span-2">
            Her vises dine events, når de er klar.
          </div>
        )}
      </div>
    </section>
  );
}

function MilestoneCard({
  activeEventCount,
  completedEventCount,
  reminderSubscriberCount,
}: {
  activeEventCount: number;
  completedEventCount: number;
  reminderSubscriberCount: number;
}) {
  return (
    <section className="rounded-[24px] border border-[#E5DDEA] bg-[#F4F0F7] p-5 shadow-soft sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-white text-[#7A5D91]">
          <HeartHandshake className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-semibold text-[#2F2437]">Milepæle</h2>
          <p className="mt-1 text-sm text-[#6E6475]">Tak fordi du bidrager til fællesskabet.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 text-sm leading-6 text-[#4D4458]">
        <p className="rounded-[18px] bg-white/75 p-4">
          🌱 Din aktivitet skaber flere muligheder for mennesker, der søger ro, nærvær og fællesskab.
        </p>
        <p className="rounded-[18px] bg-white/75 p-4">
          🌿 Din erfaring vokser gennem hvert event og hver tilmelding på SoulEvents.dk.
        </p>
        <p className="rounded-[18px] bg-white/75 p-4">
          Du har {activeEventCount} aktive/kommende events, {completedEventCount} afholdte events og {reminderSubscriberCount} personer på påmindelseslisten.
        </p>
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

function MessageStatusLabel({ status }: { status: string }) {
  const labels: Record<string, string> = {
    handled: "Behandlet",
    read: "Læst",
    unread: "Afventer svar",
  };

  return labels[status] ?? status;
}

function AdminMessageCta({ count }: { count: number }) {
  if (count === 0) {
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
            {count}
          </span>
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-[#2F2437]">Beskeder med SoulEvents administration</span>
          <span className="mt-1 block text-sm leading-5 text-[#6E6475]">
            Se dialogen og dine seneste beskeder.
          </span>
        </span>
      </span>
      <ArrowRight className="size-5 shrink-0 text-[#A08BB4]" aria-hidden="true" />
    </a>
  );
}

function SettingsPanel({ adminMessages }: { adminMessages: any[] }) {
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

        <form action={requestFacilitatorProfileClosureAction} className="rounded-[20px] border border-[#E5DDEA] bg-[#FAF7F2] p-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Pause</p>
          <h2 className="mt-1 text-lg font-semibold text-[#2F2437]">Sæt profil på pause</h2>
          <p className="mt-2 text-sm leading-6 text-[#6E6475]">
            Hvis du ønsker en pause, skjuler vi din offentlige profil og sender en besked til admin. Profilen kan genåbnes, hvis du fortryder. Ønsker du at få slettet alle dine data, så skriv det i kommentarfeltet.
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
      </div>

      {adminMessages.length > 0 ? (
        <section className="mt-5 rounded-[20px] bg-[#F4F0F7] p-5">
          <h2 className="font-semibold text-[#2F2437]">Dine seneste beskeder med SoulEvents administration</h2>
          <div className="mt-4 grid gap-3">
            {adminMessages.map((item) => (
              <article className="rounded-[16px] bg-white p-4 text-sm" key={item.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-[#2F2437]">{item.subject}</p>
                  <span className="rounded-full bg-[#FAF7F2] px-3 py-1 text-xs font-semibold text-[#6E6475]">
                    <MessageStatusLabel status={item.status} />
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
      "id, status, host_reference_id, company_name, profile_image_path, address_line, city, postal_code, short_description, offers_services, service_description, service_other_title, facilitator_categories(category_id, categories(name, color_hex)), facilitator_tags(tag_id), facilitator_images(image_path, alt_text, sort_order), facilitator_service_titles(service_title_id, service_titles(name, is_active))",
    )
    .eq("profile_id", profile.id)
    .single();

  const status = facilitatorProfile?.status ?? "pending";
  const hostReferenceId = facilitatorProfile?.host_reference_id ?? null;
  const profileImageUrl = facilitatorProfile?.profile_image_path
    ? supabase.storage.from("media").getPublicUrl(facilitatorProfile.profile_image_path).data.publicUrl
    : null;
  const profileName = facilitatorProfile?.company_name || profile.full_name || "Personlig profil";
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

  const [{ data: events }, { count: reminderSubscriberCount }, { data: adminMessages }, { count: bookingCount }, { data: recentBookings }] =
    facilitatorProfile
      ? await Promise.all([
          supabase
            .from("events")
            .select("id, title, status, starts_at, created_at, updated_at, city, event_format, price_cents, capacity, event_reference_id, event_categories(categories(name)), bookings(id)")
            .eq("facilitator_id", facilitatorProfile.id)
            .order("starts_at", { ascending: false }),
          supabase
            .from("facilitator_event_reminders")
            .select("id", { count: "exact", head: true })
            .eq("facilitator_id", facilitatorProfile.id)
            .eq("status", "active"),
          supabase
            .from("facilitator_admin_messages")
            .select("id, subject, message, type, status, created_at")
            .eq("facilitator_id", facilitatorProfile.id)
            .order("created_at", { ascending: false })
            .limit(3),
          supabase
            .from("bookings")
            .select("id, events!inner(facilitator_id)", { count: "exact", head: true })
            .eq("events.facilitator_id", facilitatorProfile.id),
          supabase
            .from("bookings")
            .select("id, participant_name, created_at, events!inner(title, facilitator_id)")
            .eq("events.facilitator_id", facilitatorProfile.id)
            .order("created_at", { ascending: false })
            .limit(5),
        ])
      : [{ data: [] }, { count: 0 }, { data: [] }, { count: 0 }, { data: [] }];

  const moodImages =
    facilitatorProfile?.facilitator_images
      ?.slice()
      .sort((a: MoodImage, b: MoodImage) => a.sort_order - b.sort_order)
      .map((image: MoodImage) => ({
        altText: image.alt_text,
        imagePath: image.image_path,
        url: supabase.storage.from("media").getPublicUrl(image.image_path).data.publicUrl,
      })) ?? [];

  const now = new Date();
  const eventRows = (events ?? []) as any[];
  const activeEvents = eventRows.filter((event) => ["active", "sold_out", "pending_review"].includes(event.status) && new Date(event.starts_at) >= now);
  const completedEvents = eventRows.filter((event) => event.status === "completed" || new Date(event.starts_at) < now);
  const draftEvents = eventRows.filter((event) => event.status === "draft");
  const activityItems = [
    ...((recentBookings ?? []) as any[]).map((booking) => {
      const bookingEvent = first(booking.events);
      return {
        id: "booking-" + booking.id,
        icon: Ticket,
        text: (booking.participant_name || "En deltager") + " har tilmeldt sig " + (bookingEvent?.title || "dit event") + ".",
        detail: formatDay(booking.created_at),
      };
    }),
    ...eventRows.slice(0, 3).map((event) => ({
      id: "event-" + event.id,
      icon: CalendarClock,
      text: event.status === "completed" ? "Dit event " + event.title + " er afholdt." : "Dit event " + event.title + " ligger i dit overblik.",
      detail: formatDate(event.starts_at),
    })),
  ].slice(0, 6);

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

          <DashboardHeader name={profile.full_name} profileStatus={status} hostReferenceId={hostReferenceId} />

          <section className="grid gap-3 sm:grid-cols-2">
            <StatsCard href="#aktive-events" icon={CalendarCheck2} label="Aktive events" value={activeEvents.length} tone="lavender" />
            <StatsCard href="#kladder" icon={CalendarDays} label="Kladder" value={draftEvents.length} tone="sage" />
            <StatsCard href="#tidligere-events" icon={Clock3} label="Afholdte events" value={completedEvents.length} tone="cream" />
            <StatsCard href="/facilitator/bookings" icon={Ticket} label="Tilmeldinger" value={bookingCount ?? 0} tone="rose" />
          </section>

          <AdminMessageCta count={(adminMessages ?? []).length} />

          <ActivityFeed items={activityItems} />

          {draftEvents.length > 0 ? (
            <EventSection id="kladder" title="Kladder" text="Events du kan åbne og gøre færdige i dit eget tempo." events={draftEvents} />
          ) : null}

          <EventSection id="aktive-events" title="Dine aktive events" text="Kommende events og events, der er ved at blive gjort klar." events={activeEvents} />

          <MilestoneCard
            activeEventCount={activeEvents.length}
            completedEventCount={completedEvents.length}
            reminderSubscriberCount={reminderSubscriberCount ?? 0}
          />

          <InsightCard events={eventRows} />

          <EventSection id="tidligere-events" title="Tidligere events" text="En rolig historik over events, du allerede har afholdt." events={completedEvents.slice(0, 6)} />

        </div>

        <aside className="w-full space-y-4 lg:sticky lg:top-6 lg:self-start">
          <FacilitatorProfilePreview
            categories={categoryNames.map((category) => ({
              colorHex: category.color_hex,
              name: category.name,
            }))}
            editHref="/facilitator/profile"
            city={facilitatorProfile?.city}
            introText="Sådan møder deltagerne dig på SoulEvents.dk."
            moodImages={moodImages}
            profileImageUrl={profileImageUrl}
            profileName={profileName}
            serviceDescription={facilitatorProfile?.offers_services ? facilitatorProfile.service_description : null}
            serviceTitles={serviceTitleNames}
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
          <SettingsPanel adminMessages={(adminMessages ?? []) as any[]} />
        </section>
      </section>
    </main>
  );
}
