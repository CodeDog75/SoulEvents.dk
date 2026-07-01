import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, Trash2 } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { SiteFooterLogin } from "@/components/site-footer-login";

export const metadata: Metadata = {
  title: "Sletning af data | SoulEvents.dk",
  description: "Sådan kan du anmode om at få slettet din profil og dine oplysninger hos SoulEvents.dk.",
};

const deletionSteps = [
  {
    title: "Send en anmodning",
    text: "Skriv til hej@soulevents.dk fra den e-mailadresse, der er knyttet til din SoulEvents-profil. Skriv gerne 'Slet min data' i emnefeltet.",
  },
  {
    title: "Vi bekræfter din identitet",
    text: "For at beskytte din profil kan vi bede dig bekræfte, at anmodningen kommer fra dig.",
  },
  {
    title: "Vi sletter eller anonymiserer oplysninger",
    text: "Når anmodningen er bekræftet, sletter eller anonymiserer vi de oplysninger, der kan slettes. Oplysninger, som vi er lovmæssigt forpligtet til at opbevare, gemmes kun så længe det er nødvendigt.",
  },
  {
    title: "Du får besked",
    text: "Vi giver dig besked, når anmodningen er behandlet.",
  },
];

export default function DataDeletionPage() {
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
                <p className="mt-1 text-base text-ink/70">Du har kontrol over dine oplysninger</p>
              </div>
            </div>

            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-[#F3ECF8] px-4 py-2 text-sm font-semibold text-[#7A4EAB]">
                <Trash2 className="size-4" aria-hidden="true" />
                Sletning af data
              </p>
              <h1 className="mt-4 text-4xl font-medium leading-tight text-olive sm:text-6xl">Sådan kan du få slettet dine oplysninger</h1>
              <p className="mt-4 text-base leading-7 text-ink/70">
                Du kan til enhver tid anmode om at få slettet din SoulEvents-profil og de personoplysninger, der er
                knyttet til den.
              </p>
              <p className="mt-3 text-sm font-semibold text-ink/55">Senest opdateret: 1. juli 2026</p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {deletionSteps.map((step, index) => (
            <article className="rounded-[24px] bg-white p-6 shadow-soft" key={step.title}>
              <p className="inline-flex size-10 items-center justify-center rounded-full bg-[#F3ECF8] text-sm font-bold text-[#7A4EAB]">
                {index + 1}
              </p>
              <h2 className="mt-4 text-2xl font-medium text-olive">{step.title}</h2>
              <p className="mt-3 text-sm leading-7 text-ink/70">{step.text}</p>
            </article>
          ))}
        </div>

        <section className="mt-8 rounded-[24px] bg-white p-6 shadow-soft sm:p-8">
          <h2 className="text-2xl font-medium text-olive">Send din anmodning</h2>
          <p className="mt-3 text-sm leading-7 text-ink/70">
            Brug knappen herunder, hvis du ønsker at få slettet din profil og dine oplysninger hos SoulEvents.dk.
          </p>
          <a
            className="mt-5 inline-flex items-center gap-2 rounded-button bg-olive px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-500"
            href="mailto:hej@soulevents.dk?subject=Slet%20min%20data&body=Hej%20SoulEvents%0A%0AJeg%20%C3%B8nsker%20at%20f%C3%A5%20slettet%20min%20profil%20og%20mine%20oplysninger.%0A%0AMin%20profil-e-mail%20er%3A%20"
          >
            <Mail className="size-4" aria-hidden="true" />
            Send anmodning om sletning
          </a>
        </section>
      </section>

      <SiteFooterLogin />
    </main>
  );
}
