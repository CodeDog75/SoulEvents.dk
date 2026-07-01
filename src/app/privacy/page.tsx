import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { SiteFooterLogin } from "@/components/site-footer-login";

export const metadata: Metadata = {
  title: "Privatlivspolitik | SoulEvents.dk",
  description: "Læs hvordan SoulEvents.dk behandler personoplysninger.",
};

const sections = [
  {
    title: "Hvilke oplysninger vi behandler",
    text: "Når du bruger SoulEvents.dk, kan vi behandle oplysninger som navn, e-mailadresse, telefonnummer, profiltekst, billeder, lokation, events, tilmeldinger og beskeder, du selv sender til os eller til arrangører via platformen.",
  },
  {
    title: "Login med Google, Facebook eller Apple",
    text: "Hvis du vælger social login, modtager vi kun de oplysninger, du vælger at dele via den pågældende tjeneste. Det kan for eksempel være navn, e-mailadresse og profilbillede. Vi bruger oplysningerne til at oprette eller logge dig ind på din SoulEvents-profil.",
  },
  {
    title: "Hvad oplysningerne bruges til",
    text: "Oplysningerne bruges til at drive platformen, vise offentlige arrangørprofiler og events, håndtere tilmeldinger, sende relevante e-mails og skabe en tryg oplevelse for brugere og arrangører.",
  },
  {
    title: "Deling af oplysninger",
    text: "Vi sælger ikke dine personoplysninger. Oplysninger deles kun, når det er nødvendigt for at levere platformens funktioner, for eksempel med tekniske leverandører som hosting, database, e-mail og loginudbydere.",
  },
  {
    title: "Dine rettigheder",
    text: "Du kan bede om indsigt, rettelse eller sletning af dine oplysninger. Du kan også få din arrangørprofil sat på pause eller slettet. Læs mere på siden for datasletning.",
  },
  {
    title: "Opbevaring",
    text: "Vi opbevarer oplysninger så længe det er nødvendigt for at levere SoulEvents.dk, overholde lovkrav og håndtere sikkerhed, support og dokumentation.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#FAF6EF] text-[#2F2633]">
      <section className="mx-auto max-w-[1100px] px-5 py-8 sm:px-8 sm:py-12">
        <div className="mt-8 rounded-[28px] bg-white p-6 shadow-soft sm:p-8 lg:p-10">
          <Link className="inline-flex items-center gap-2 text-sm font-semibold text-olive transition hover:text-rose" href="/">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Tilbage til forsiden
          </Link>

          <div className="mt-8 grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
            <div className="flex items-center gap-5">
              <BrandLogo className="h-24 w-24 sm:h-32 sm:w-32" priority />
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">SoulEvents.dk</p>
                <p className="mt-1 text-base text-ink/70">Events for krop, sind og sjæl</p>
              </div>
            </div>

            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-[#F3ECF8] px-4 py-2 text-sm font-semibold text-[#7A4EAB]">
                <ShieldCheck className="size-4" aria-hidden="true" />
                Privatlivspolitik
              </p>
              <h1 className="mt-4 text-4xl font-medium leading-tight text-olive sm:text-6xl">Sådan passer vi på dine oplysninger</h1>
              <p className="mt-4 text-base leading-7 text-ink/70">
                Denne privatlivspolitik forklarer, hvordan SoulEvents.dk behandler personoplysninger for brugere,
                arrangører og besøgende på platformen.
              </p>
              <p className="mt-3 text-sm font-semibold text-ink/55">Senest opdateret: 1. juli 2026</p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4">
          {sections.map((section) => (
            <article className="rounded-[24px] bg-white p-6 shadow-soft" key={section.title}>
              <h2 className="text-2xl font-medium text-olive">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-ink/70">{section.text}</p>
            </article>
          ))}
        </div>

        <section className="mt-8 rounded-[24px] bg-white p-6 shadow-soft sm:p-8">
          <h2 className="text-2xl font-medium text-olive">Kontakt om privatliv</h2>
          <p className="mt-3 text-sm leading-7 text-ink/70">
            Har du spørgsmål til privatliv eller ønsker du at få slettet dine oplysninger, kan du skrive til os.
          </p>
          <a
            className="mt-5 inline-flex items-center gap-2 rounded-button bg-olive px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-500"
            href="mailto:hej@soulevents.dk?subject=Privatliv%20og%20personoplysninger"
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
