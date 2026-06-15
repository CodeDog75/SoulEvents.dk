import Link from "next/link";
import {
  AlertCircle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  LayoutDashboard,
  LayoutGrid,
  Megaphone,
  ReceiptText,
  Scale,
  Search,
  Star,
  Shapes,
  ShieldCheck,
  Tags,
  UserCog,
  UsersRound,
} from "lucide-react";
import { FacilitatorApprovalTable } from "@/components/admin/facilitator-approval-table";
import { AuthMessage } from "@/components/auth/auth-message";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { FacilitatorStatus } from "@/types/database";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams: Promise<{ status?: string; message?: string }>;
};

const statuses: Array<{ label: string; value: "all" | FacilitatorStatus }> = [
  { label: "Alle", value: "all" },
  { label: "Afventer", value: "pending" },
  { label: "Godkendt", value: "approved" },
  { label: "Deaktiveret", value: "disabled" },
];

function normalizeStatus(status?: string) {
  return statuses.some((item) => item.value === status) ? (status as "all" | FacilitatorStatus) : "all";
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("da-DK").format(value ?? 0);
}

function formatMoney(valueCents: number) {
  return new Intl.NumberFormat("da-DK").format(valueCents / 100) + " kr.";
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const [{ status, message }, profile] = await Promise.all([searchParams, requireRole("admin")]);
  const selectedStatus = normalizeStatus(status);
  const supabase = await createClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let facilitatorQuery = supabase
    .from("facilitator_profiles")
    .select("id, host_reference_id, status, company_name, short_description, city, postal_code, website_url, created_at, profiles(full_name, email, phone), regions(name), facilitator_categories(categories(name))")
    .order("created_at", { ascending: false });

  if (selectedStatus !== "all") {
    facilitatorQuery = facilitatorQuery.eq("status", selectedStatus);
  }

  const [
    { data: facilitators },
    { count: activeFacilitators },
    { count: pendingFacilitators },
    { count: upcomingEvents },
    { count: onlineEvents },
    { count: pendingEvents },
    { count: recentBookings },
    { data: bookingStats },
    { data: recentFacilitators },
    { data: recentEvents },
    { data: latestBookings },
  ] = await Promise.all([
    facilitatorQuery.limit(20),
    supabase.from("facilitator_profiles").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("facilitator_profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "active").gte("starts_at", today.toISOString()),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "active").eq("event_format", "online").gte("starts_at", today.toISOString()),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo.toISOString()),
    supabase.from("bookings").select("booking_value_cents, commission_cents, seats"),
    supabase.from("facilitator_profiles").select("id, host_reference_id, status, company_name, created_at, profiles(full_name, email)").order("created_at", { ascending: false }).limit(5),
    supabase.from("events").select("id, title, status, starts_at, created_at, facilitator_profiles(company_name, profiles(full_name))").order("created_at", { ascending: false }).limit(5),
    supabase.from("bookings").select("id, participant_name, created_at, events(title)").order("created_at", { ascending: false }).limit(5),
  ]);

  const totalBookingValue = bookingStats?.reduce((sum: number, booking: { booking_value_cents: number }) => sum + booking.booking_value_cents, 0) ?? 0;
  const totalCommission = bookingStats?.reduce((sum: number, booking: { commission_cents: number }) => sum + booking.commission_cents, 0) ?? 0;

  const stats = [
    { label: "Aktive værter", value: formatNumber(activeFacilitators), icon: UsersRound },
    { label: "Kommende events", value: formatNumber(upcomingEvents), icon: CalendarDays },
    { label: "Online events", value: formatNumber(onlineEvents), icon: CheckCircle2 },
    { label: "Tilmeldinger seneste 30 dage", value: formatNumber(recentBookings), icon: ReceiptText },
    { label: "Nye værtansøgninger", value: formatNumber(pendingFacilitators), icon: Clock3 },
    { label: "Events til godkendelse", value: formatNumber(pendingEvents), icon: AlertCircle },
  ];

  const adminLinks = [
    { href: "/admin/events", title: "Eventmoderation", text: "Godkend, afvis, skjul og arkiver events.", icon: CalendarDays },
    { href: "/admin/bookings", title: "Tilmeldinger og statistik", text: "Se bookingværdi, kommission og pladser.", icon: Banknote },
    { href: "/admin/category-architecture", title: "Kategorier & tag-farver", text: "Administrer kategorier, tags, eventformat og farver på tags.", icon: Tags },
    { href: "/admin/homepage", title: "Forsidebokse og temaer", text: "Styr de store 1:1 bokse og kampagne-temaer på forsiden.", icon: LayoutGrid },
    { href: "/admin/ads", title: "Reklamer / partnerindhold", text: "Styr diskrete reklamer på forsiden og hovedkategorisider.", icon: Megaphone },
    { href: "/admin/featured-facilitators", title: "Fremhævede værter", text: "Vælg hvem der skal vises særskilt på forsiden.", icon: Star },
    { href: "/admin/users", title: "Brugere og roller", text: "Styr adgang til adminpanelet.", icon: UserCog },
    { href: "/admin/legal", title: "Juridiske dokumenter", text: "Opdater betingelser, privatliv og retningslinjer.", icon: Scale },
    { href: "/admin/reports", title: "Rapporter og faktura", text: "Månedsrapporter og fakturakladder.", icon: FileText },
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

        <div className="mt-5 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {stats.map((stat) => (
            <article className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft" key={stat.label}>
              <stat.icon className="size-5 text-terracotta" aria-hidden="true" />
              <p className="mt-4 text-3xl font-semibold text-midnight">{stat.value}</p>
              <p className="mt-1 text-sm text-ink/64">{stat.label}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {adminLinks.map((item) => (
            <Link className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft transition hover:border-sage-700" href={item.href} key={item.href}>
              <item.icon className="size-5 text-sage-700" aria-hidden="true" />
              <h2 className="mt-4 font-semibold text-midnight">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink/64">{item.text}</p>
            </Link>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
            <h2 className="font-semibold text-midnight">Nye værter</h2>
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
                    {facilitator.status === "pending" && (
                      <Link className="mt-2 inline-flex text-sm font-semibold text-sage-700" href="/admin">
                        Godkend
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
            <h2 className="font-semibold text-midnight">Nye events</h2>
            <div className="mt-4 grid gap-3">
              {(recentEvents ?? []).map((event: any) => {
                const facilitator = Array.isArray(event.facilitator_profiles) ? event.facilitator_profiles[0] : event.facilitator_profiles;
                const eventProfile = Array.isArray(facilitator?.profiles) ? facilitator.profiles[0] : facilitator?.profiles;
                return (
                  <div className="rounded-md bg-sage-50 p-3" key={event.id}>
                    <p className="font-semibold text-midnight">{event.title}</p>
                    <p className="mt-1 text-xs text-ink/64">
                      {facilitator?.company_name || eventProfile?.full_name || "Vært"} · {event.status}
                    </p>
                    <Link className="mt-2 inline-flex text-sm font-semibold text-sage-700" href="/admin/events">
                      Gå til moderation
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

        <div className="mt-6 rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-midnight">Platformøkonomi</h2>
              <p className="mt-1 text-sm text-ink/64">Samlet overblik baseret på registrerede tilmeldinger.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm font-semibold text-midnight">
              <span className="rounded-md bg-sand px-3 py-2">Bookingværdi: {formatMoney(totalBookingValue)}</span>
              <span className="rounded-md bg-sage-50 px-3 py-2">Kommission: {formatMoney(totalCommission)}</span>
            </div>
          </div>
        </div>

        <div className="my-6 flex flex-wrap gap-2">
          {statuses.map((item) => {
            const active = item.value === selectedStatus;
            return (
              <Link
                className={
                  active
                    ? "rounded-md bg-midnight px-3 py-2 text-sm font-semibold text-white"
                    : "rounded-md border border-midnight/10 bg-white px-3 py-2 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta"
                }
                href={item.value === "all" ? "/admin" : "/admin?status=" + item.value}
                key={item.value}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <FacilitatorApprovalTable facilitators={(facilitators ?? []) as never} />
      </section>
    </main>
  );
}
