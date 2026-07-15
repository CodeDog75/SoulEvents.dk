import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { SiteFooterLogin } from "@/components/site-footer-login";
import { createPageMetadata } from "@/lib/open-graph";

export const metadata: Metadata = createPageMetadata({
  title: "Cookieoversigt | SoulEvents.dk",
  description: "Se hvilke cookies og lagringsteknologier SoulEvents bruger.",
  imageTitle: "Cookieoversigt",
  imageSubtitle: "Cookies og lagringsteknologier på SoulEvents.dk.",
  path: "/legal/cookies",
});

const technologies = [
  {
    name: "soulevents_cookie_consent",
    provider: "SoulEvents",
    purpose: "Gemmer dit cookievalg, så banneret ikke vises igen, før samtykket udløber eller versionen ændres.",
    category: "Nødvendig",
    expiry: "6 måneder",
    type: "Cookie",
  },
  {
    name: "Supabase auth session",
    provider: "Supabase / SoulEvents",
    purpose: "Holder brugere logget ind og understøtter sikker sessionsstyring.",
    category: "Nødvendig",
    expiry: "Varierer efter session og auth-konfiguration",
    type: "Cookie",
  },
  {
    name: "soulevents_oauth_flow",
    provider: "SoulEvents",
    purpose: "Bruges kortvarigt under social login for at håndtere loginflowet korrekt.",
    category: "Nødvendig",
    expiry: "10 minutter",
    type: "Cookie",
  },
  {
    name: "soulevents:signup-form-draft:v1",
    provider: "SoulEvents",
    purpose: "Gemmer midlertidigt indtastninger i oprettelsesformularen, hvis brugeren sendes tilbage efter en fejl.",
    category: "Nødvendig",
    expiry: "Indtil browserfanen/sessionen ryddes eller formularen afsluttes",
    type: "sessionStorage",
  },
  {
    name: "soulevents:event-draft:*",
    provider: "SoulEvents",
    purpose: "Gemmer lokale eventkladder i browseren, så arrangøren ikke mister indtastet arbejde.",
    category: "Nødvendig",
    expiry: "Indtil kladden gemmes, ryddes eller slettes i browseren",
    type: "localStorage",
  },
];

export default function CookieOverviewPage() {
  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link className="flex items-center gap-3" href="/">
            <BrandLogo className="h-28 w-28" priority />
            <span className="text-sm font-semibold text-olive">SoulEvents.dk</span>
          </Link>
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta"
            href="/"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Tilbage
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <article className="rounded-card bg-white p-6 shadow-soft sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Juridisk dokument</p>
          <h1 className="mt-2 text-4xl font-medium text-olive">Cookieoversigt</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-ink/72">
            Her kan du se de cookies og lagringsteknologier, SoulEvents bruger i den nuværende løsning. Statistik og
            markedsføring er bygget som samtykkekategorier, men der er ikke installeret Google Analytics, Meta Pixel
            eller tilsvarende tracking-scripts i projektet lige nu.
          </p>

          <div className="mt-8 overflow-x-auto rounded-md border border-midnight/10">
            <table className="min-w-full divide-y divide-midnight/10 text-left text-sm">
              <thead className="bg-sage-50 text-xs font-semibold uppercase tracking-wide text-ink/60">
                <tr>
                  <th className="px-4 py-3">Navn</th>
                  <th className="px-4 py-3">Udbyder</th>
                  <th className="px-4 py-3">Formål</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Udløb</th>
                  <th className="px-4 py-3">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-midnight/10 bg-white text-ink/72">
                {technologies.map((technology) => (
                  <tr key={technology.name}>
                    <td className="px-4 py-4 font-semibold text-midnight">{technology.name}</td>
                    <td className="px-4 py-4">{technology.provider}</td>
                    <td className="max-w-md px-4 py-4 leading-6">{technology.purpose}</td>
                    <td className="px-4 py-4">{technology.category}</td>
                    <td className="px-4 py-4">{technology.expiry}</td>
                    <td className="px-4 py-4">{technology.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section className="mt-8 rounded-md border border-[#D8CBE4] bg-[#F7F2FB] p-4 text-sm leading-6 text-ink/72">
            <h2 className="font-semibold text-midnight">Om statistik og markedsføring</h2>
            <p className="mt-2">
              SoulEvents kan senere tilkoble statistik eller markedsføring, men sådanne scripts må først indlæses, når
              du aktivt har givet samtykke til den relevante kategori.
            </p>
          </section>
        </article>
      </section>

      <SiteFooterLogin />
    </main>
  );
}
