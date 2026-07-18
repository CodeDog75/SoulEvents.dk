/* eslint-disable @typescript-eslint/no-explicit-any */
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  LayoutDashboard,
  LayoutGrid,
  Mail,
  Megaphone,
  ReceiptText,
  Scale,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tags,
  UserCog,
  UserRound,
  UsersRound,
} from "lucide-react";
import { AuthMessage } from "@/components/auth/auth-message";
import { FacilitatorStatusBadge } from "@/components/admin/facilitator-status-badge";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams: Promise<{ message?: string }>;
};

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("da-DK").format(value ?? 0);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Tidspunkt mangler";
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Dato mangler";
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium" }).format(new Date(value));
}

function waitTimeText(value: string | null | undefined) {
  if (!value) return "Ventetid ukendt";
  const createdAt = new Date(value);
  const now = new Date();
  const days = Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000)));
  if (days === 0) return "Oprettet i dag";
  if (days === 1) return "Har ventet 1 dag";
  return "Har ventet " + days + " dage";
}

function textExcerpt(value: string | null | undefined) {
  const text = (value ?? "").trim().replace(/\s+/g, " ");
  if (!text) return "Ingen profiltekst endnu.";
  return text.length > 120 ? text.slice(0, 117).trimEnd() + "..." : text;
}

function facilitatorCenterHref(facilitator: { id: string; status?: string | null }) {
  const params = new URLSearchParams({
    highlight: facilitator.id,
    q: facilitator.id,
    status: facilitator.status === "changes_requested" ? "changes_requested" : "pending",
  });

  return "/admin/users?" + params.toString();
}

function DashboardFacilitatorCard({
  facilitator,
  profile,
  profileImageUrl,
}: {
  facilitator: any;
  profile: any;
  profileImageUrl: string | null;
}) {
  const displayName = facilitator.company_name || profile?.full_name || "Uden navn";
  const location = [facilitator.postal_code, facilitator.city].filter(Boolean).join(" ") || "Lokation mangler";
  const centerHref = facilitatorCenterHref(facilitator);

  return (
    <article className="rounded-[22px] border border-midnight/10 bg-[#fbfaf7] p-3 shadow-soft transition hover:border-sage-700/30">
      <div className="grid gap-3 sm:grid-cols-[5.5rem_minmax(0,1fr)]">
        <div className="relative size-[5.5rem] overflow-hidden rounded-[16px] border border-midnight/10 bg-[#F4F0EA]">
          {profileImageUrl ? (
            <Image alt="" className="object-cover" fill sizes="88px" src={profileImageUrl} />
          ) : (
            <div className="grid size-full place-items-center text-sage-700">
              <UserRound className="size-8" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <FacilitatorStatusBadge facilitator={facilitator} />
            {facilitator.host_reference_id ? (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink/60 shadow-soft">{facilitator.host_reference_id}</span>
            ) : null}
          </div>

          <h3 className="mt-3 break-words text-base font-semibold leading-tight text-midnight">{displayName}</h3>
          <p className="mt-1 truncate text-xs font-semibold text-ink/52">{location}</p>
          <p className="mt-1 text-xs font-semibold text-ink/52" title={formatDate(facilitator.created_at)}>
            {waitTimeText(facilitator.created_at)}
          </p>
          <p className="mt-3 line-clamp-2 text-sm leading-5 text-ink/68">
            {textExcerpt(facilitator.short_description || facilitator.long_description)}
          </p>
        </div>
      </div>

      <Link
        className="mt-4 inline-flex min-h-10 w-full items-center justify-center whitespace-nowrap rounded-full bg-midnight px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-900"
        href={centerHref}
      >
        Åbn i Arrangørcenter
      </Link>
    </article>
  );
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const [{ message }, profile] = await Promise.all([searchParams, requireRole("admin")]);
  const supabase = await createClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    { count: activeFacilitators },
    { count: pendingFacilitators },
    { count: changesRequestedFacilitators },
    { count: upcomingEvents },
    { count: onlineEvents },
    { count: pendingEvents },
    { count: recentBookings },
    { count: reminderSubscribers },
    { data: recentFacilitators },
    { data: recentEvents },
    { data: latestBookings },
    { count: openAdminMessages },
  ] = await Promise.all([
    supabase.from("facilitator_profiles").select("id", { count: "exact", head: true }).eq("status", "approved").eq("is_paused", false).eq("is_disabled", false),
    supabase.from("facilitator_profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("facilitator_profiles").select("id", { count: "exact", head: true }).eq("status", "changes_requested"),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "active").gte("starts_at", today.toISOString()),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "active").eq("event_format", "online").gte("starts_at", today.toISOString()),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo.toISOString()),
    supabase.from("facilitator_event_reminders").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("facilitator_profiles")
      .select("id, host_reference_id, status, is_paused, is_disabled, company_name, profile_image_path, city, postal_code, short_description, long_description, created_at, profiles!facilitator_profiles_profile_id_fkey(full_name)")
      .in("status", ["pending", "changes_requested"])
      .eq("is_paused", false)
      .eq("is_disabled", false)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("events").select("id, title, status, starts_at, created_at, updated_at, facilitator_profiles(company_name, profiles!facilitator_profiles_profile_id_fkey(full_name))").order("created_at", { ascending: false }).limit(5),
    supabase.from("bookings").select("id, participant_name, created_at, events(title)").order("created_at", { ascending: false }).limit(5),
    supabase
      .from("facilitator_admin_messages")
      .select("id", { count: "exact", head: true })
      .in("type", ["message", "closure_request"])
      .in("status", ["unread", "read"]),
  ]);

  const stats = [
    { label: "Aktive arrangører", value: formatNumber(activeFacilitators), icon: UsersRound },
    { label: "Kommende events", value: formatNumber(upcomingEvents), icon: CalendarDays },
    { label: "Online events", value: formatNumber(onlineEvents), icon: CheckCircle2 },
    { label: "Tilmeldinger seneste 30 dage", value: formatNumber(recentBookings), icon: ReceiptText },
    { label: "Påmindelses-mails", value: formatNumber(reminderSubscribers), icon: Bell },
    { label: "Nye arrangøransøgninger", value: formatNumber(pendingFacilitators), icon: Clock3 },
    { label: "Kræver ændringer", value: formatNumber(changesRequestedFacilitators), icon: AlertCircle },
    { label: "Events til godkendelse", value: formatNumber(pendingEvents), icon: AlertCircle },
  ];

  const adminLinks = [
    { href: "/admin/events", title: "Eventmoderation", text: "Godkend, afvis, skjul og arkiver events.", icon: CalendarDays },
    { href: "/admin/bookings", title: "Tilmeldinger", text: "Se deltagere, status og antal pladser.", icon: ReceiptText },
    { href: "/admin/messages", title: "Beskeder", text: "Indbakke, sendte svar og arkiverede beskeder.", icon: Mail, badge: openAdminMessages ? `${formatNumber(openAdminMessages)} ubesvarede` : undefined },
    { href: "/admin/category-architecture", title: "Kategorier & tags", text: "Administrer kategorier, tags og tagfarver ét samlet sted.", icon: Tags },
    { href: "/admin/about", title: "Om SoulEvents", text: "Rediger den offentlige fortælling, CTA og billeder.", icon: FileText },
    { href: "/admin/content/bliv-arrangoer", title: "Bliv arrangør", text: "Rediger landingssiden for nye arrangører.", icon: FileText },
    { href: "/admin/homepage", title: "Forsidebokse og temaer", text: "Styr de store 1:1 bokse og kampagne-temaer på forsiden.", icon: LayoutGrid },
    { href: "/admin/current-experiences", title: "Aktuelle oplevelser", text: "Opret og styr de eventrækker, der vises på forsiden.", icon: Sparkles },
    { href: "/admin/inspirators", title: "Inspiratorer", text: "Opret og rediger inspiratorprofiler til inspirationsuniverset.", icon: Sparkles },
    { href: "/admin/ads", title: "Reklamer / partnerindhold", text: "Styr diskrete reklamer på forsiden og hovedkategorisider.", icon: Megaphone },
    { href: "/admin/featured-facilitators", title: "Fremhævede arrangører", text: "Vælg hvem der skal vises særskilt på forsiden.", icon: Star },
    { href: "/admin/settings", title: "Platformindstillinger", text: "Styr grænser for kladder og aktive events per arrangør.", icon: SlidersHorizontal },
    { href: "/admin/users", title: "Arrangørcenter", text: "Find arrangører, events og styr adminadgang.", icon: UserCog },
    { href: "/admin/legal", title: "Juridiske dokumenter", text: "Opdater betingelser, privatliv og retningslinjer.", icon: Scale },
    { href: "/admin/reports", title: "Rapporter og eksport", text: "Excel-eksport til statistik, status og dokumentation.", icon: FileText },
  ];
  const facilitatorReviewCount = (pendingFacilitators ?? 0) + (changesRequestedFacilitators ?? 0);
  const dashboardFacilitators = (recentFacilitators ?? []).slice(0, 5);
  const hasMoreDashboardFacilitators = (recentFacilitators ?? []).length > 5;

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-sage-700 text-white">
              <LayoutDashboard className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Administrator</p>
              <h1 className="text-xl font-semibold text-midnight">Dashboard · {profile.full_name}</h1>
            </div>
          </div>
          <SignOutButton />
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <AuthMessage message={message} />

        <section className="scroll-mt-24 rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Søgning</p>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-midnight">Find arrangør eller event</h2>
            <p className="mt-2 text-sm leading-6 text-ink/64">
              Søgningen åbner resultaterne på en separat side, så dashboardet forbliver ryddeligt.
            </p>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <form action="/admin/users" className="grid gap-2">
              <label className="text-sm font-semibold text-midnight" htmlFor="admin-organizer-search">
                Søg arrangør eller event
              </label>
              <div className="flex min-w-0 gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/45" aria-hidden="true" />
                  <input
                    className="h-11 w-full rounded-md border border-midnight/15 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-sage-700"
                    id="admin-organizer-search"
                    name="q"
                    placeholder="Søg arrangørnavn, e-mail, by, medlemsnummer, eventtitel eller event-id"
                  />
                </div>
                <button className="h-11 rounded-md bg-midnight px-4 text-sm font-semibold text-white" type="submit">
                  Søg
                </button>
              </div>
            </form>

            <form action="/admin/events" className="grid gap-2">
              <label className="text-sm font-semibold text-midnight" htmlFor="admin-event-search">
                Søg events
              </label>
              <div className="flex min-w-0 gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/45" aria-hidden="true" />
                  <input
                    className="h-11 w-full rounded-md border border-midnight/15 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-sage-700"
                    id="admin-event-search"
                    name="q"
                    placeholder="Søg eventtitel, arrangør/kaldenavn, by, kategori eller e-mail"
                  />
                </div>
                <button className="h-11 rounded-md bg-sage-700 px-4 text-sm font-semibold text-white" type="submit">
                  Søg
                </button>
              </div>
            </form>
          </div>
        </section>

        <div className="mt-5 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {stats.map((stat) => (
            <article className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft" key={stat.label}>
              <stat.icon className="size-5 text-terracotta" aria-hidden="true" />
              <p className="mt-4 text-3xl font-semibold text-midnight">{stat.value}</p>
              <p className="mt-1 text-sm text-ink/64">{stat.label}</p>
            </article>
          ))}
        </div>

        <section className="mt-6 rounded-[26px] border border-[#F0DEC0] bg-[#FFF6E8] p-5 shadow-soft">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-[#7A5D3A]">
              <Bell className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-serif text-xl font-semibold text-midnight">Kræver opmærksomhed</h2>
              <p className="mt-1 text-sm leading-6 text-ink/64">De vigtigste punkter hvor admin typisk skal tage stilling.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Link className="rounded-[18px] border border-[#F0DEC0] bg-white/70 p-4 transition hover:bg-white" href="#admin-new-facilitators">
              <p className="font-semibold text-midnight">Nye arrangører</p>
              <p className="mt-1 text-sm text-ink/64">Profiler der afventer behandling.</p>
              <span className="mt-3 inline-flex rounded-full bg-[#FFF6E8] px-3 py-1 text-sm font-semibold text-[#7A5D3A]">{formatNumber(facilitatorReviewCount)}</span>
            </Link>
            <Link className="rounded-[18px] border border-[#F0DEC0] bg-white/70 p-4 transition hover:bg-white" href="/admin/events?status=pending_review">
              <p className="font-semibold text-midnight">Events til godkendelse</p>
              <p className="mt-1 text-sm text-ink/64">Events der skal læses og godkendes.</p>
              <span className="mt-3 inline-flex rounded-full bg-[#FFF6E8] px-3 py-1 text-sm font-semibold text-[#7A5D3A]">{formatNumber(pendingEvents)}</span>
            </Link>
            <Link className="rounded-[18px] border border-[#F0DEC0] bg-white/70 p-4 transition hover:bg-white" href="/admin/messages">
              <p className="font-semibold text-midnight">Beskeder</p>
              <p className="mt-1 text-sm text-ink/64">Beskeder og anmodninger fra arrangører.</p>
              <span className="mt-3 inline-flex rounded-full bg-[#FFF6E8] px-3 py-1 text-sm font-semibold text-[#7A5D3A]">{formatNumber(openAdminMessages)}</span>
            </Link>
            <Link className="rounded-[18px] border border-[#F0DEC0] bg-white/70 p-4 transition hover:bg-white" href="#admin-permissions">
              <p className="font-semibold text-midnight">Særlige tilladelser</p>
              <p className="mt-1 text-sm text-ink/64">Arrangører med badges eller auto-publicering.</p>
              <span className="mt-3 inline-flex rounded-full bg-[#FFF6E8] px-3 py-1 text-sm font-semibold text-[#7A5D3A]">Se liste</span>
            </Link>
          </div>
        </section>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {adminLinks.map((item) => (
            <Link className="relative rounded-md border border-midnight/10 bg-white p-5 shadow-soft transition hover:border-sage-700" href={item.href} key={item.href}>
              {item.badge && (
                <span className="absolute right-4 top-4 rounded-full bg-[#F6EFFF] px-3 py-1 text-xs font-semibold text-[#7A4EAB]">
                  {item.badge}
                </span>
              )}
              <item.icon className="size-5 text-sage-700" aria-hidden="true" />
              <h2 className="mt-4 font-semibold text-midnight">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink/64">{item.text}</p>
            </Link>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <section id="admin-new-facilitators" className="scroll-mt-24 rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-midnight">Nye arrangører</h2>
                <p className="mt-1 text-sm text-ink/64">Profiler, der afventer din behandling.</p>
              </div>
              <Link className="text-sm font-semibold text-sage-700 transition hover:text-terracotta" href="/admin/users?sort=priority">
                Åbn Arrangørcenter
              </Link>
            </div>
            <div className="mt-4 grid gap-3">
              {dashboardFacilitators.length === 0 ? (
                <div className="rounded-[18px] border border-midnight/10 bg-[#fbfaf7] p-4 text-sm leading-6 text-ink/64">
                  <p className="font-semibold text-midnight">Ingen nye profiler afventer behandling</p>
                  <p className="mt-1">Du er ajour med arrangørgodkendelserne.</p>
                </div>
              ) : null}
              {dashboardFacilitators.map((facilitator: any) => {
                const profile = Array.isArray(facilitator.profiles) ? facilitator.profiles[0] : facilitator.profiles;
                const profileImageUrl = facilitator.profile_image_path
                  ? supabase.storage.from("media").getPublicUrl(facilitator.profile_image_path).data.publicUrl
                  : null;

                return (
                  <DashboardFacilitatorCard
                    facilitator={facilitator}
                    key={facilitator.id}
                    profile={profile}
                    profileImageUrl={profileImageUrl}
                  />
                );
              })}
              {hasMoreDashboardFacilitators ? (
                <Link
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-midnight/10 bg-white px-4 text-sm font-semibold text-sage-700 transition hover:border-sage-700"
                  href="/admin/users?sort=priority"
                >
                  Se alle profiler, der kræver handling
                </Link>
              ) : null}
            </div>
          </section>

          <section id="admin-new-events" className="scroll-mt-24 rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
            <h2 className="font-semibold text-midnight">Nye events</h2>
            <div className="mt-4 grid gap-3">
              {(recentEvents ?? []).map((event: any) => {
                const facilitator = Array.isArray(event.facilitator_profiles) ? event.facilitator_profiles[0] : event.facilitator_profiles;
                const eventProfile = Array.isArray(facilitator?.profiles) ? facilitator.profiles[0] : facilitator?.profiles;
                return (
                  <div className="rounded-md bg-sage-50 p-3" key={event.id}>
                    <p className="font-semibold text-midnight">{event.title}</p>
                    <p className="mt-1 text-xs text-ink/64">
                      {facilitator?.company_name || eventProfile?.full_name || "Arrangør"} · {event.status}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-ink/55">
                      Oprettet {formatDateTime(event.created_at)} · Senest ændret {formatDateTime(event.updated_at)}
                    </p>
                    <Link className="mt-2 inline-flex text-sm font-semibold text-sage-700" href={"/events/" + event.id + "?admin_return=/admin%23admin-new-events"}>
                      Åbn event
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
            <h2 className="font-semibold text-midnight">Seneste tilmeldinger</h2>
            <div className="mt-4 grid gap-3">
              {(latestBookings ?? []).map((booking: any) => {
                const event = Array.isArray(booking.events) ? booking.events[0] : booking.events;
                return (
                  <div className="rounded-md bg-sage-50 p-3" key={booking.id}>
                    <p className="font-semibold text-midnight">{booking.participant_name}</p>
                    <p className="mt-1 text-xs text-ink/64">
                      {event?.title || "Event"} · {new Intl.DateTimeFormat("da-DK").format(new Date(booking.created_at))}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <section id="admin-permissions" className="mb-6 scroll-mt-24 rounded-md border border-[#D8CBE4] bg-[#F7F2FA] p-5 shadow-soft">
          <h2 className="font-semibold text-midnight">Særlige tilladelser</h2>
          <p className="mt-1 text-sm leading-6 text-ink/64">
            Auto-godkendelse og badges fjernes ved at åbne arrangørens redigering og fjerne markeringen under &quot;Status og synlighed&quot;.
          </p>
        </section>

      </section>
    </main>
  );
}
