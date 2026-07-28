import { ArrowLeft, ArrowRight, CalendarPlus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFacilitatorDashboardContext } from "@/lib/facilitator/dashboard-data";
import {
  formatYearRhythmDate,
  getUpcomingYearRhythmEvents,
  getYearRhythmCountdown,
  rhythmEventCreateHref,
} from "@/lib/year-rhythm";

export const dynamic = "force-dynamic";

function rhythmTone(type: string) {
  if (type === "new_moon") {
    return {
      body: "border-[#CAC1DD] bg-[#F7F4FB]",
      icon: "bg-[#2F2437] shadow-[0_0_22px_rgba(47,36,55,0.18)]",
      symbol: "bg-[#181321]",
      text: "text-[#5B4778]",
    };
  }

  if (type === "full_moon") {
    return {
      body: "border-[#E8DEC9] bg-[#FFFDF8]",
      icon: "bg-[#FFF8E8] shadow-[0_0_28px_rgba(239,225,191,0.58)]",
      symbol: "bg-[#F7EFD8]",
      text: "text-[#7A5D91]",
    };
  }

  if (type === "summer_solstice" || type === "winter_solstice") {
    return {
      body: "border-[#E8DEC9] bg-[#FFF9EC]",
      icon: "bg-[#F5D68C]/45 shadow-[0_0_24px_rgba(201,166,107,0.28)]",
      symbol: "bg-[#C9A66B]",
      text: "text-[#8A6A2E]",
    };
  }

  return {
    body: "border-[#D7E4D1] bg-[#F6FAF3]",
    icon: "bg-[#DDE8D7] shadow-[0_0_24px_rgba(134,164,120,0.22)]",
    symbol: "bg-gradient-to-r from-[#2F2437] from-50% to-[#F7EFD8] to-50%",
    text: "text-[#4E6A45]",
  };
}

export default async function YearRhythmPage() {
  const { facilitatorProfile } = await getFacilitatorDashboardContext();

  if (!facilitatorProfile) {
    redirect("/auth/oauth-profile");
  }

  const events = getUpcomingYearRhythmEvents(new Date());

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F4F0EA] text-[#2F2437]">
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <header className="relative overflow-hidden rounded-[36px] border border-white/18 bg-[#211C34] p-6 text-white shadow-[0_24px_70px_rgba(47,36,55,0.16)] sm:p-8 lg:p-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_24%,rgba(247,239,216,0.26),transparent_15rem),radial-gradient(circle_at_18%_82%,rgba(122,93,145,0.32),transparent_18rem),linear-gradient(135deg,#181321_0%,#302544_46%,#6F5A76_100%)]" aria-hidden="true" />
            <div className="absolute right-8 top-8 hidden h-44 w-44 rounded-full border border-white/14 lg:block" aria-hidden="true" />
            <div className="absolute right-20 top-20 hidden size-12 rounded-full bg-[#F7EFD8] shadow-[0_0_40px_rgba(247,239,216,0.42)] lg:block" aria-hidden="true" />
            <div className="absolute bottom-10 right-36 hidden size-6 rounded-full bg-[#2F2437] shadow-[0_0_26px_rgba(24,19,33,0.55)] lg:block" aria-hidden="true" />
            <div className="absolute left-8 top-10 size-1 rounded-full bg-white/55" aria-hidden="true" />
            <div className="absolute left-1/3 top-16 size-1 rounded-full bg-white/45" aria-hidden="true" />
            <div className="absolute bottom-16 left-1/4 size-1 rounded-full bg-white/45" aria-hidden="true" />
            <div className="relative z-10 max-w-3xl">
              <Link className="inline-flex items-center gap-2 text-sm font-semibold text-white/76 transition hover:text-white" href="/facilitator">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Tilbage til dashboard
              </Link>
              <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-white/68">Årets rytme</p>
              <h1 className="mt-3 font-serif text-4xl font-medium leading-tight text-white sm:text-5xl">
                Planlæg med naturens mærkedage
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/78">
                Se kommende datoer for nymåne, fuldmåne, solhverv og jævndøgn.
              </p>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/64">
                Funktionen er frivillig og kan bruges som rolig inspiration, når du selv ønsker at planlægge efter naturens rytmer.
              </p>
            </div>
          </header>

          {events.length === 0 ? (
            <section className="rounded-[28px] border border-[#E5DDEA] bg-white p-6 shadow-soft">
              <h2 className="text-xl font-semibold text-[#2F2437]">Årets rytme er midlertidigt utilgængelig.</h2>
            </section>
          ) : (
            <section className="grid gap-4">
              {events.map((event) => (
                <article className={"rounded-[28px] border p-5 shadow-soft sm:p-6 " + rhythmTone(event.type).body} key={event.type + event.localDate}>
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                    <div className="flex min-w-0 gap-4">
                      <span className={"grid size-14 shrink-0 place-items-center rounded-full " + rhythmTone(event.type).icon} aria-hidden="true">
                        <span className={"size-8 rounded-full " + rhythmTone(event.type).symbol} />
                      </span>
                      <div className="min-w-0">
                        <p className={"text-sm font-semibold uppercase tracking-wide " + rhythmTone(event.type).text}>
                          {formatYearRhythmDate(event.date, { includeTime: true })}
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold text-[#2F2437]">{event.title}</h2>
                        <p className="mt-1 text-sm font-semibold text-[#8B7F93]">{getYearRhythmCountdown(event.date)}</p>
                        <p className="mt-4 max-w-3xl text-sm leading-6 text-[#6E6475]">{event.description}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
                      <div className="flex flex-wrap gap-2">
                        {event.ideas.map((idea) => (
                          <span className="rounded-full border border-[#E5DDEA] bg-[#FAF8F4] px-3 py-1 text-xs font-semibold text-[#6E6475]" key={idea}>
                            {idea}
                          </span>
                        ))}
                      </div>
                      <Link
                        className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-[#7A5D91] px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-[#6E5285] lg:w-auto"
                        href={rhythmEventCreateHref(event)}
                      >
                        <CalendarPlus className="size-4" aria-hidden="true" />
                        Opret event
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
