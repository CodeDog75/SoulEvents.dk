import Link from "next/link";
import { ArrowLeft, HeartHandshake, MapPinned, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { SiteFooterLogin } from "@/components/site-footer-login";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#FAF6EF] text-[#2F2633]">
      <section className="mx-auto max-w-[1100px] px-5 py-8 sm:px-8 sm:py-12">
        <Link className="inline-flex items-center gap-2 text-sm font-semibold text-olive transition hover:text-rose" href="/">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Tilbage til forsiden
        </Link>

        <div className="mt-8 grid gap-8 rounded-[28px] bg-white p-6 shadow-soft sm:p-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <BrandLogo className="h-28 w-28 sm:h-40 sm:w-40" priority />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Om SoulEvents</p>
            <h1 className="mt-3 text-4xl font-medium leading-tight text-olive sm:text-6xl">
              Danmarks samlingssted for spirituelle events
            </h1>
            <p className="mt-4 text-base leading-7 text-ink/70">
              SoulEvents.dk hjælper mennesker med at finde yoga, meditation, lydbade, saunagus, retreats, ceremonier,
              healing og andre oplevelser for krop, sind og sjæl.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Sparkles,
              title: "Ro og overblik",
              text: "Find events, ydelser og arrangører i et enkelt og trygt univers.",
            },
            {
              icon: MapPinned,
              title: "Tæt på dig",
              text: "Udforsk oplevelser på kortet eller søg efter område, kategori og dato.",
            },
            {
              icon: HeartHandshake,
              title: "Fællesskab",
              text: "SoulEvents samler mennesker og arrangører, der skaber nærvær og udvikling.",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article className="rounded-[24px] bg-white p-6 shadow-soft" key={item.title}>
                <Icon className="size-6 text-[#7A4EAB]" aria-hidden="true" />
                <h2 className="mt-4 text-2xl font-medium text-olive">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-ink/68">{item.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <SiteFooterLogin />
    </main>
  );
}
