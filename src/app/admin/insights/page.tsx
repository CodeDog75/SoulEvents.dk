import Link from "next/link";
import { ArrowLeft, BarChart3, CalendarDays, MousePointerClick, Share2, Ticket, TrendingUp, UserRound, UsersRound } from "lucide-react";
import { requireRole } from "@/lib/auth/roles";
import { publicEventPath, publicFacilitatorPath } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AdminInsightsPageProps = {
  searchParams: Promise<{ period?: string }>;
};

type Summary = {
  activeFacilitators?: number;
  bookings?: number;
  confirmedSeats?: number;
  eventShares?: number;
  facilitatorProfileViews?: number;
  uniqueEventViews?: number;
  upcomingPublicEvents?: number;
};

type DailyPoint = {
  bookings?: number;
  date?: string;
  eventViews?: number;
  profileViews?: number;
  shares?: number;
};

type TopEvent = {
  bookings?: number;
  confirmed_seats?: number;
  facilitator_name?: string;
  id?: string;
  shares?: number;
  slug?: string | null;
  starts_at?: string;
  title?: string;
  unique_views?: number;
};

type FacilitatorInsight = {
  bookings?: number;
  event_views?: number;
  host_reference_id?: string | null;
  id?: string;
  name?: string;
  profile_views?: number;
  slug?: string | null;
  status?: string;
};

type CategoryInsight = {
  event_views?: number;
  id?: string;
  name?: string;
  shares?: number;
  slug?: string;
};

type ShareMethodInsight = {
  count?: number;
  method?: string;
};

type InsightsData = {
  categories?: CategoryInsight[];
  daily?: DailyPoint[];
  facilitators?: FacilitatorInsight[];
  shareMethods?: ShareMethodInsight[];
  summary?: Summary;
  topEvents?: TopEvent[];
};

const periods = [
  { label: "7 dage", value: "7d" },
  { label: "30 dage", value: "30d" },
  { label: "Denne måned", value: "this_month" },
  { label: "Sidste måned", value: "last_month" },
] as const;

function periodRange(period: string | undefined) {
  const now = new Date();
  const end = now;
  const start = new Date(now);
  const selected = periods.some((item) => item.value === period) ? period : "30d";

  if (selected === "7d") {
    start.setDate(start.getDate() - 7);
  } else if (selected === "this_month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else if (selected === "last_month") {
    start.setMonth(start.getMonth() - 1, 1);
    start.setHours(0, 0, 0, 0);
    end.setDate(1);
    end.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 30);
  }

  return { end, selected, start };
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("da-DK").format(value ?? 0);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 }).format(value) + "%";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Dato mangler";
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium" }).format(new Date(value));
}

function shareMethodLabel(method: string | null | undefined) {
  const labels: Record<string, string> = {
    copy_link: "Kopiér link",
    email: "E-mail",
    facebook: "Facebook",
    messenger: "Messenger",
    native_share: "Deling på enhed",
    other: "Andet",
    sms: "SMS",
  };

  return labels[method ?? ""] ?? "Andet";
}

function StatCard({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string }) {
  return (
    <article className="rounded-[22px] border border-midnight/10 bg-white p-5 shadow-soft">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-[#F1EAF5] text-[#7A4EAB]">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-2xl font-semibold text-midnight">{value}</p>
          <p className="text-sm font-semibold text-ink/58">{label}</p>
        </div>
      </div>
    </article>
  );
}

function SimpleTrend({ points }: { points: DailyPoint[] }) {
  const maxValue = Math.max(1, ...points.map((point) => (point.eventViews ?? 0) + (point.profileViews ?? 0) + (point.shares ?? 0)));

  return (
    <div className="mt-5 flex h-52 items-end gap-2 overflow-x-auto rounded-[22px] border border-midnight/10 bg-[#FBFAF7] p-4">
      {points.map((point) => {
        const value = (point.eventViews ?? 0) + (point.profileViews ?? 0) + (point.shares ?? 0);
        const height = Math.max(8, Math.round((value / maxValue) * 150));

        return (
          <div className="flex min-w-8 flex-1 flex-col items-center justify-end gap-2" key={point.date}>
            <div
              className="w-full rounded-t-full bg-gradient-to-t from-[#7A4EAB] to-[#D89A94]"
              style={{ height }}
              title={`${formatDate(point.date)} · ${formatNumber(value)} interaktioner`}
            />
            <span className="text-[0.65rem] font-semibold text-ink/45">{point.date ? new Date(point.date).getDate() : ""}</span>
          </div>
        );
      })}
    </div>
  );
}

export default async function AdminInsightsPage({ searchParams }: AdminInsightsPageProps) {
  await requireRole("admin");
  const { period } = await searchParams;
  const { end, selected, start } = periodRange(period);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_admin_platform_insights", {
    period_end: end.toISOString(),
    period_start: start.toISOString(),
  });
  if (error) {
    console.error("[admin-insights] Platform insights could not be loaded", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
    });
  }
  const insights = (data ?? {}) as InsightsData;
  const summary = insights.summary ?? {};
  const conversionRate =
    (summary.uniqueEventViews ?? 0) > 0 ? ((summary.bookings ?? 0) / Math.max(1, summary.uniqueEventViews ?? 0)) * 100 : 0;

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <Link className="inline-flex items-center gap-2 text-sm font-semibold text-ink/58 transition hover:text-purple" href="/admin">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Tilbage til dashboard
            </Link>
            <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-purple">Platformindsigter</p>
            <h1 className="mt-1 font-serif text-4xl font-semibold text-midnight">SoulEvents analytics</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/64">
              Interne nøgletal baseret på anonymiserede hændelser, bookings og offentlige events. Ingen persondata eller rå IP-adresser gemmes her.
            </p>
          </div>

          <form className="flex flex-wrap gap-2" action="/admin/insights">
            {periods.map((item) => (
              <button
                className={
                  "h-10 rounded-full border px-4 text-sm font-semibold transition " +
                  (selected === item.value
                    ? "border-purple bg-purple text-white shadow-soft"
                    : "border-midnight/10 bg-white text-ink/64 hover:border-purple/40 hover:text-purple")
                }
                key={item.value}
                name="period"
                type="submit"
                value={item.value}
              >
                {item.label}
              </button>
            ))}
          </form>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        {error ? (
          <section className="rounded-[22px] border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-800 shadow-soft">
            Platformindsigter kunne ikke hentes lige nu. Se serverloggen for den tekniske årsag.
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={MousePointerClick} label="Unikke eventvisninger" value={formatNumber(summary.uniqueEventViews)} />
          <StatCard icon={Share2} label="Eventdelinger" value={formatNumber(summary.eventShares)} />
          <StatCard icon={UserRound} label="Profilvisninger" value={formatNumber(summary.facilitatorProfileViews)} />
          <StatCard icon={Ticket} label="Bookinger" value={formatNumber(summary.bookings)} />
          <StatCard icon={UsersRound} label="Bekræftede pladser" value={formatNumber(summary.confirmedSeats)} />
          <StatCard icon={CalendarDays} label="Kommende offentlige events" value={formatNumber(summary.upcomingPublicEvents)} />
          <StatCard icon={UsersRound} label="Aktive arrangører" value={formatNumber(summary.activeFacilitators)} />
          <StatCard icon={TrendingUp} label="Booking pr. visning" value={formatPercent(conversionRate)} />
        </section>

        <section className="rounded-[26px] border border-midnight/10 bg-white p-5 shadow-soft sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-[#E8EFE5] text-[#394E35]">
              <BarChart3 className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-serif text-2xl font-semibold text-midnight">Udvikling i perioden</h2>
              <p className="text-sm text-ink/58">Visninger, profilstrafik og delinger pr. dag.</p>
            </div>
          </div>
          <SimpleTrend points={insights.daily ?? []} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <section className="rounded-[26px] border border-midnight/10 bg-white p-5 shadow-soft sm:p-6">
            <h2 className="font-serif text-2xl font-semibold text-midnight">Top events</h2>
            <div className="mt-4 grid gap-3">
              {(insights.topEvents ?? []).length > 0 ? (
                (insights.topEvents ?? []).map((event) => (
                  <article className="rounded-[18px] border border-midnight/10 bg-[#FBFAF7] p-4" key={event.id}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <Link className="font-semibold text-midnight transition hover:text-purple" href={publicEventPath(event.slug || event.id || "")}>
                          {event.title}
                        </Link>
                        <p className="mt-1 text-xs font-semibold text-ink/50">
                          {event.facilitator_name} · {formatDate(event.starts_at)}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-ink/60">
                        <span className="rounded-full bg-[#F1EAF5] px-3 py-2">{formatNumber(event.unique_views)} visn.</span>
                        <span className="rounded-full bg-[#EDF5EA] px-3 py-2">{formatNumber(event.bookings)} book.</span>
                        <span className="rounded-full bg-[#FFF0DF] px-3 py-2">{formatNumber(event.shares)} del.</span>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-[18px] bg-[#FBFAF7] p-4 text-sm text-ink/58">Der er endnu ingen eventdata i perioden.</p>
              )}
            </div>
          </section>

          <section className="rounded-[26px] border border-midnight/10 bg-white p-5 shadow-soft sm:p-6">
            <h2 className="font-serif text-2xl font-semibold text-midnight">Arrangørindsigter</h2>
            <div className="mt-4 grid gap-3">
              {(insights.facilitators ?? []).length > 0 ? (
                (insights.facilitators ?? []).map((facilitator) => (
                  <article className="rounded-[18px] border border-midnight/10 bg-[#FBFAF7] p-4" key={facilitator.id}>
                    <Link className="font-semibold text-midnight transition hover:text-purple" href={publicFacilitatorPath(facilitator.slug || facilitator.id || "")}>
                      {facilitator.name}
                    </Link>
                    <p className="mt-1 text-xs font-semibold text-ink/50">{facilitator.host_reference_id || facilitator.status || "Arrangør"}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-ink/60">
                      <span className="rounded-full bg-[#F1EAF5] px-3 py-1.5">{formatNumber(facilitator.profile_views)} profilvisninger</span>
                      <span className="rounded-full bg-[#E8EFE5] px-3 py-1.5">{formatNumber(facilitator.event_views)} eventvisninger</span>
                      <span className="rounded-full bg-[#FFF6E6] px-3 py-1.5">{formatNumber(facilitator.bookings)} bookinger</span>
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-[18px] bg-[#FBFAF7] p-4 text-sm text-ink/58">Der er endnu ingen arrangørdata i perioden.</p>
              )}
            </div>
          </section>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-[26px] border border-midnight/10 bg-white p-5 shadow-soft sm:p-6">
            <h2 className="font-serif text-2xl font-semibold text-midnight">Kategorier</h2>
            <div className="mt-4 grid gap-2">
              {(insights.categories ?? []).length > 0 ? (
                (insights.categories ?? []).map((category) => (
                  <div className="flex items-center justify-between rounded-[16px] bg-[#FBFAF7] px-4 py-3 text-sm" key={category.id}>
                    <span className="font-semibold text-midnight">{category.name}</span>
                    <span className="font-semibold text-ink/58">{formatNumber(category.event_views)} visninger</span>
                  </div>
                ))
              ) : (
                <p className="rounded-[18px] bg-[#FBFAF7] p-4 text-sm text-ink/58">Kategoridata vises, når der er robuste visninger i perioden.</p>
              )}
            </div>
          </section>

          <section className="rounded-[26px] border border-midnight/10 bg-white p-5 shadow-soft sm:p-6">
            <h2 className="font-serif text-2xl font-semibold text-midnight">Delingsmetoder</h2>
            <div className="mt-4 grid gap-2">
              {(insights.shareMethods ?? []).length > 0 ? (
                (insights.shareMethods ?? []).map((shareMethod) => (
                  <div className="flex items-center justify-between rounded-[16px] bg-[#FBFAF7] px-4 py-3 text-sm" key={shareMethod.method}>
                    <span className="font-semibold text-midnight">{shareMethodLabel(shareMethod.method)}</span>
                    <span className="font-semibold text-ink/58">{formatNumber(shareMethod.count)} delinger</span>
                  </div>
                ))
              ) : (
                <p className="rounded-[18px] bg-[#FBFAF7] p-4 text-sm text-ink/58">Der er endnu ingen delinger i perioden.</p>
              )}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}
