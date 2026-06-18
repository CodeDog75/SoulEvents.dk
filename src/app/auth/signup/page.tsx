import Link from "next/link";
import { AuthMessage } from "@/components/auth/auth-message";
import { BrandLogo } from "@/components/brand-logo";
import { LegalConsentLinks } from "@/components/auth/legal-consent-links";
import { signUpFacilitatorAction } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

type SignUpPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { message } = await searchParams;
  const supabase = await createClient();
  const { data: legalDocuments } = await supabase
    .from("legal_documents")
    .select("title, slug, body")
    .in("slug", ["handelsbetingelser", "privatlivspolitik", "platformens-retningslinjer"])
    .eq("is_published", true);

  return (
    <main className="min-h-screen bg-[#FAF6EF] px-4 py-8 text-[#2F2633] sm:py-12">
      <div className="mx-auto mb-5 flex w-full max-w-6xl justify-end">
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#7A4EAB]/15 bg-white/85 px-4 text-sm font-semibold text-[#7A4EAB] shadow-soft transition hover:border-[#7A4EAB]/35 hover:bg-[#EDE4F7]/70"
          href="/"
        >
          Tilbage til forsiden
        </Link>
      </div>
      <section className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
        <aside className="rounded-[1.75rem] border border-[#EDE4F7] bg-white/80 p-6 shadow-soft sm:p-8">
          <Link className="mb-8 flex items-center gap-3" href="/">
            <BrandLogo className="h-28 w-28 sm:h-36 sm:w-36" priority />
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">SoulEvents.dk</p>
              <p className="mt-1 text-sm text-[#2F2633]/65">For arrangører og fællesskaber</p>
            </div>
          </Link>

          <p className="inline-flex rounded-full bg-[#EDE4F7] px-4 py-2 text-sm font-semibold text-[#7A4EAB]">
            Gratis arrangørprofil og gratis eventoprettelse
          </p>
          <h1 className="mt-5 text-3xl font-semibold leading-tight text-[#2F2633] sm:text-5xl">
            Opret gratis arrangørprofil
          </h1>
          <p className="mt-5 text-base leading-7 text-[#2F2633]/72 sm:text-lg">
            Bliv en del af SoulEvents.dk og del dine events, fællesskaber og aktiviteter gratis med mennesker, der søger mere ro,
            nærvær og balance i hverdagen.
          </p>

          <section className="mt-5 rounded-[1.25rem] border border-[#D8A7B1]/35 bg-[#D8A7B1]/14 p-5">
            <h2 className="text-lg font-semibold text-[#2F2633]">💜 Gratis og uden binding</h2>
            <p className="mt-2 text-sm leading-6 text-[#2F2633]/72">
              Det er gratis at oprette en arrangørprofil på SoulEvents.dk, og det er gratis at oprette events. Du har altid fuld kontrol over dine oplysninger og kan redigere eller slette din profil og dine events, når du ønsker det.
            </p>
          </section>

          <section className="mt-5 rounded-[1.25rem] border border-[#EDE4F7] bg-white/75 p-5">
            <h2 className="text-lg font-semibold text-[#2F2633]">Dansk udviklet med nærvær</h2>
            <p className="mt-2 text-sm leading-6 text-[#2F2633]/72">
              SoulEvents er dansk udviklet med fokus på tryghed, fællesskab og enkelhed. Du er altid velkommen til at
              skrive til SoulEvents.dk, hvis du ønsker at høre mere, inden du opretter din profil.
            </p>
            <Link
              className="mt-4 inline-flex min-h-10 items-center justify-center rounded-full border border-[#7A4EAB]/25 px-4 text-sm font-semibold text-[#7A4EAB] transition hover:bg-[#EDE4F7]"
              href="/#contact"
            >
              Skriv til SoulEvents.dk
            </Link>
          </section>

          <section className="mt-5 rounded-[1.25rem] border border-[#A8BFA3]/35 bg-[#A8BFA3]/14 p-5">
            <h2 className="text-lg font-semibold text-[#2F2633]">Hvem er SoulEvents for?</h2>
            <p className="mt-2 text-sm leading-6 text-[#2F2633]/72">
              SoulEvents er for dig, der afholder aktiviteter inden for eksempelvis yoga, meditation, saunagus, healing,
              breathwork, ceremonier, retreats, personlig udvikling og andre fællesskaber med fokus på krop, sind og sjæl.
            </p>
          </section>
        </aside>

        <section className="rounded-[1.75rem] border border-[#EDE4F7] bg-white p-5 shadow-soft sm:p-8">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Opret profil</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#2F2633]">Dine loginoplysninger</h2>
            <p className="mt-2 text-sm leading-6 text-[#2F2633]/62">
              Start med e-mail, adgangskode og navn. Resten kan du udfylde, når din profil er oprettet.
            </p>
          </div>

          <AuthMessage message={message} />

          <form
            action={signUpFacilitatorAction}
            className="mt-6 grid gap-5 [&_input::placeholder]:text-sm [&_input::placeholder]:font-normal [&_input::placeholder]:text-[#2F2633]/42"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-[#2F2633]/72">
                E-mail *
                <input
                  autoComplete="email"
                  className="h-12 rounded-xl border border-[#7A4EAB]/15 bg-white px-4 text-base outline-none transition focus:border-[#7A4EAB]"
                  name="email"
                  placeholder="din@mail.dk"
                  required
                  type="email"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-[#2F2633]/72">
                Adgangskode *
                <input
                  autoComplete="new-password"
                  className="h-12 rounded-xl border border-[#7A4EAB]/15 bg-white px-4 text-base outline-none transition focus:border-[#7A4EAB]"
                  minLength={8}
                  name="password"
                  placeholder="Mindst 8 tegn"
                  required
                  type="password"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-[#2F2633]/72">
                Dit rigtige navn *
                <input
                  autoComplete="name"
                  className="h-12 rounded-xl border border-[#7A4EAB]/15 bg-white px-4 text-base outline-none transition focus:border-[#7A4EAB]"
                  name="full_name"
                  placeholder="Dit fulde navn"
                  required
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-[#2F2633]/72">
                Telefon
                <input
                  autoComplete="tel"
                  inputMode="tel"
                  className="h-12 rounded-xl border border-[#7A4EAB]/15 bg-white px-4 text-base outline-none transition focus:border-[#7A4EAB]"
                  maxLength={11}
                  name="phone"
                  pattern="[0-9 ]*"
                  placeholder="Kan udfyldes senere"
                  title="Telefonnummer skal bestå af præcis 8 tal. Mellemrum er tilladt."
                />
              </label>
            </div>

            <label className="flex items-start gap-3 rounded-[1.25rem] bg-[#EDE4F7]/65 p-4 text-sm leading-6 text-[#2F2633]/72">
              <input className="mt-1 size-4 accent-[#7A4EAB]" name="accepted_terms" required type="checkbox" />
              <span>
                <LegalConsentLinks documents={legalDocuments ?? []} />
              </span>
            </label>

            <button
              className="mt-1 h-12 rounded-full bg-[#7A4EAB] px-5 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-[#6A4199] hover:shadow-lift"
              type="submit"
            >
              Opret gratis arrangørprofil
            </button>
          </form>

          <section className="mt-7 rounded-[1.25rem] border border-[#EDE4F7] bg-[#FAF6EF] p-5">
            <h2 className="text-xl font-semibold text-[#2F2633]">Når din profil er oprettet 💜</h2>
            <p className="mt-2 text-sm leading-6 text-[#2F2633]/70">
              Det tager kun få minutter at komme videre.
            </p>
            <ol className="mt-5 grid gap-3 text-sm font-semibold text-[#2F2633]">
              {["Bekræft din e-mail", "Fortæl lidt om dig selv", "Opret dit første event gratis"].map((step, index) => (
                <li className="flex items-center gap-3" key={step}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#7A4EAB] text-white">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-5 border-t border-[#7A4EAB]/10 pt-4 text-sm leading-6 text-[#2F2633]/62">
              Du kan altid redigere dine oplysninger senere.
            </p>
          </section>


          <p className="mt-6 text-sm text-[#2F2633]/66">
            Har du allerede en konto?{" "}
            <Link className="font-semibold text-[#7A4EAB] hover:text-[#D8A7B1]" href="/auth/login">
              Log ind
            </Link>
          </p>
        </section>
      </section>
    </main>
  );
}
