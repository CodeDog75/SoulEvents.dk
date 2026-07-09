/* eslint-disable @typescript-eslint/no-explicit-any */
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
  UsersRound,
} from "lucide-react";
import { AuthMessage } from "@/components/auth/auth-message";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { updateFacilitatorStatusAction } from "@/app/admin/facilitators/actions";
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
    supabase.from("facilitator_profiles").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("facilitator_profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "active").gte("starts_at", today.toISOString()),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "active").eq("event_format", "online").gte("starts_at", today.toISOString()),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo.toISOString()),
    supabase.from("facilitator_event_reminders").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("facilitator_profiles").select("id, host_reference_id, status, company_name, created_at, profiles(full_name, email)").order("created_at", { ascending: false }).limit(5),
    supabase.from("events").select("id, title, status, starts_at, created_at, updated_at, facilitator_profiles(company_name, profiles(full_name))").order("created_at", { ascending: false }).limit(5),
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
    { label: "Events til godkendelse", value: formatNumber(pendingEvents), icon: AlertCircle },
  ];

  const adminLinks = [
    { href: "/admin/events", title: "Eventmoderation", text: "Godkend, afvis, skjul og arkiver events.", icon: CalendarDays },
    { href: "/admin/bookings", title: "Tilmeldinger", text: "Se deltagere, status og antal pladser.", icon: ReceiptText },
    { href: "/admin/messages", title: "Beskeder", text: "Indbakke, sendte svar og arkiverede beskeder.", icon: Mail, badge: openAdminMessages ? `${formatNumber(openAdminMessages)} ubesvarede` : undefined },
    { href: "/admin/category-architecture", title: "Kategorier & tags", text: "Administrer kategorier, tags og tagfarver ét samlet sted.", icon: Tags },
    { href: "/admin/service-titles", title: "Behandlertitler", text: "Styr titler og ydelsestyper til arrangørprofiler.", icon: UserCog },
    { href: "/admin/homepage", title: "Forsidebokse og temaer", text: "Styr de store 1:1 bokse og kampagne-temaer på forsiden.", icon: LayoutGrid },
    { href: "/admin/current-experiences", title: "Aktuelle oplevelser", text: "Opret og styr de eventrækker, der vises på forsiden.", icon: Sparkles },
    { href: "/admin/ads", title: "Reklamer / partnerindhold", text: "Styr diskrete reklamer på forsiden og hovedkategorisider.", icon: Megaphone },
    { href: "/admin/featured-facilitators", title: "Fremhævede arrangører", text: "Vælg hvem der skal vises særskilt på forsiden.", icon: Star },
    { href: "/admin/settings", title: "Platformindstillinger", text: "Styr grænser for kladder og aktive events per arrangør.", icon: SlidersHorizontal },
    { href: "/admin/users", title: "Arrangører og admin", text: "Find arrangører og styr adminadgang.", icon: UserCog },
    { href: "/admin/legal", title: "Juridiske dokumenter", text: "Opdater betingelser, privatliv og retningslinjer.", icon: Scale },
    { href: "/admin/reports", title: "Rapporter og eksport", text: "Excel-eksport til statistik, status og dokumentation.", icon: FileText },
  ];

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
                Søg arrangør eller admin
              </label>
              <div className="flex min-w-0 gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/45" aria-hidden="true" />
                  <input
                    className="h-11 w-full rounded-md border border-midnight/15 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-sage-700"
                    id="admin-organizer-search"
                    name="q"
                    placeholder="Søg navn, kaldenavn, firma, e-mail, by eller medlemsnummer"
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
              <p className="mt-1 text-sm text-ink/64">Profiler der afventer godkendelse.</p>
              <span className="mt-3 inline-flex rounded-full bg-[#FFF6E8] px-3 py-1 text-sm font-semibold text-[#7A5D3A]">{formatNumber(pendingFacilitators)}</span>
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
            <h2 className="font-semibold text-midnight">Nye arrangører</h2>
            <div className="mt-4 grid gap-3">
              {(recentFacilitators ?? []).map((facilitator: any) => {
                const profile = Array.isArray(facilitator.profiles) ? facilitator.profiles[0] : facilitator.profiles;
                return (
                  <div className="rounded-md bg-sage-50 p-3" key={facilitator.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-midnight">{facilitator.company_name || profile?.full_name || "Uden navn"}</p>
                      {facilitator.host_reference_id && (
                        <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-sage-700">
                          {facilitator.host_reference_id}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-ink/64">
                      {new Intl.DateTimeFormat("da-DK").format(new Date(facilitator.created_at))} · {facilitator.status}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        className="inline-flex min-h-9 items-center justify-center rounded-full border border-midnight/10 bg-white px-3 text-xs font-semibold text-ink/70 transition hover:border-sage-700 hover:text-sage-700"
                        href={"/facilitators/" + facilitator.id + "?admin_return=/admin%23admin-new-facilitators"}
                      >
                        Se profil
                      </Link>
                      <Link
                        className="inline-flex min-h-9 items-center justify-center rounded-full border border-midnight/10 bg-white px-3 text-xs font-semibold text-ink/70 transition hover:border-sage-700 hover:text-sage-700"
                        href={"/admin/facilitators/" + facilitator.id + "/edit"}
                      >
                        Rediger
                      </Link>
                      {facilitator.status === "pending" && (
                        <form action={updateFacilitatorStatusAction}>
                          <input name="facilitator_id" type="hidden" value={facilitator.id} />
                          <input name="status" type="hidden" value="approved" />
                          <button
                            className="inline-flex min-h-9 items-center justify-center rounded-full bg-sage-700 px-3 text-xs font-semibold text-white shadow-soft transition hover:bg-sage-800"
                            type="submit"
                          >
                            Godkend
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
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
