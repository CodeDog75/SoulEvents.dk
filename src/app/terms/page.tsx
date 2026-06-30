import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText, Mail } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { SiteFooterLogin } from "@/components/site-footer-login";

export const metadata: Metadata = {
  title: "Vilkår og betingelser | SoulEvents.dk",
  description: "Læs vilkår og betingelser for brug af SoulEvents.dk.",
};

const terms = [
  {
    title: "Brug af SoulEvents.dk",
    text: "SoulEvents.dk er en platform, hvor besøgende kan finde spirituelle events, ydelser og arrangører, og hvor arrangører kan oprette profiler og events. Ved at bruge platformen accepterer du at anvende den på en respektfuld, lovlig og ansvarlig måde.",
  },
  {
    title: "Arrangørprofiler og events",
    text: "Arrangører er ansvarlige for, at oplysninger om profil, events, priser, tider, lokation og øvrigt indhold er korrekte og opdaterede. SoulEvents kan gennemgå, godkende, afvise, skjule eller fjerne indhold, hvis det vurderes nødvendigt for platformens kvalitet og tryghed.",
  },
  {
    title: "Tilmeldinger og kontakt",
    text: "Når en deltager tilmelder sig et event eller kontakter en arrangør, bruges oplysningerne til at håndtere den konkrete relation mellem deltager og arrangør. Arrangøren er ansvarlig for den praktiske afvikling af egne events.",
  },
  {
    title: "Indhold og billeder",
    text: "Du må kun uploade tekst, billeder og andet materiale, som du har ret til at bruge. Du giver SoulEvents.dk ret til at vise dit offentlige profil- og eventindhold på platformen, så længe profilen eller eventet er aktivt.",
  },
  {
    title: "Ændringer og drift",
    text: "SoulEvents.dk kan løbende ændre, forbedre eller midlertidigt begrænse funktioner på platformen. Vi arbejder for en stabil og tryg oplevelse, men kan ikke garantere, at platformen altid er fejlfri eller tilgængelig uden afbrydelser.",
  },
  {
    title: "Privatliv og sletning",
    text: "Behandling af personoplysninger er beskrevet i vores privatlivspolitik. Du kan også anmode om at få slettet din profil og dine oplysninger via siden for datasletning.",
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#FAF6EF] text-[#2F2633]">
      <section className="mx-auto max-w-[1100px] px-5 py-8 sm:px-8 sm:py-12">
        <Link className="inline-flex items-center gap-2 text-sm font-semibold text-olive transition hover:text-rose" href="/">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Tilbage til forsiden
        </Link>

        <div className="mt-8 rounded-[28px] bg-white p-6 shadow-soft sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
            <div className="flex items-center gap-5">
              <BrandLogo className="h-24 w-24 sm:h-32 sm:w-32" priority />
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">SoulEvents.dk</p>
                <p className="mt-1 text-base text-ink/70">Events for krop, sind og sjæl</p>
              </div>
            </div>

            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-[#F3ECF8] px-4 py-2 text-sm font-semibold text-[#7A4EAB]">
                <FileText className="size-4" aria-hidden="true" />
                Terms of Service
              </p>
              <h1 className="mt-4 text-4xl font-medium leading-tight text-olive sm:text-6xl">Vilkår og betingelser</h1>
              <p className="mt-4 text-base leading-7 text-ink/70">
                Her finder du de overordnede vilkår for brug af SoulEvents.dk som besøgende, deltager og arrangør.
              </p>
              <p className="mt-3 text-sm font-semibold text-ink/55">Senest opdateret: 1. juli 2026</p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4">
          {terms.map((section) => (
            <article className="rounded-[24px] bg-white p-6 shadow-soft" key={section.title}>
              <h2 className="text-2xl font-medium text-olive">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-ink/70">{section.text}</p>
            </article>
          ))}
        </div>

        <section className="mt-8 rounded-[24px] bg-white p-6 shadow-soft sm:p-8">
          <h2 className="text-2xl font-medium text-olive">Kontakt</h2>
          <p className="mt-3 text-sm leading-7 text-ink/70">
            Har du spørgsmål til vilkårene, er du velkommen til at kontakte SoulEvents.dk.
          </p>
          <a
            className="mt-5 inline-flex items-center gap-2 rounded-button bg-olive px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-500"
            href="mailto:hej@soulevents.dk?subject=Sp%C3%B8rgsm%C3%A5l%20til%20vilk%C3%A5r"
          >
            <Mail className="size-4" aria-hidden="true" />
            Skriv til hej@soulevents.dk
          </a>
        </section>
      </section>

      <SiteFooterLogin />
    </main>
  );
}
