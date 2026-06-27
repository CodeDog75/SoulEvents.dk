import Link from "next/link";
import { AuthMessage } from "@/components/auth/auth-message";
import { BrandLogo } from "@/components/brand-logo";
import { SignupForm } from "@/components/auth/signup-form";
import { createClient } from "@/lib/supabase/server";

type SignUpPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { message } = await searchParams;
  const existingAccountMessage = message?.toLowerCase().includes("der findes allerede en konto") ?? false;
  const rateLimitMessage = message?.toLowerCase().includes("for mange mails") ?? false;
  const shouldRestoreFormValues = Boolean(message) && !message?.toLowerCase().includes("oprettet");
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
              Det er gratis at oprette en arrangørprofil på SoulEvents.dk, og det er gratis at oprette events. Du har altid fuld kontrol over dine oplysninger og kan redigere dine oplysninger eller sætte din profil på pause, når du ønsker det.
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
              SoulEvents er for dig, der inviterer mennesker ind i fællesskaber, oplevelser og udviklingsrum. Her finder du plads til alt fra yoga, meditation og saunagus til healing, ceremonier, retreats, musik, naturoplevelser og andre aktiviteter, der skaber nærvær, balance og forbindelse.
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

          {rateLimitMessage && (
            <div className="mt-4 rounded-2xl border border-[#F0DEC0] bg-[#FFF6E8] p-4 text-sm text-[#2F2633]/75">
              <p className="font-semibold text-[#2F2633]">For mange mails på kort tid</p>
              <p className="mt-1 leading-6">
                Du kan prøve igen om lidt. Hvis du allerede har oprettet en konto, kan du logge ind eller bruge glemt adgangskode.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#7A4EAB] px-4 text-sm font-semibold text-white transition hover:bg-[#6D439C]"
                  href="/auth/login"
                >
                  Gå til login
                </Link>
                <Link
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#7A4EAB]/25 bg-white px-4 text-sm font-semibold text-[#7A4EAB] transition hover:bg-[#EDE4F7]"
                  href="/auth/forgot-password"
                >
                  Glemt adgangskode?
                </Link>
              </div>
            </div>
          )}

          {existingAccountMessage && (
            <div className="mt-4 rounded-2xl border border-[#EDE4F7] bg-[#FAF6EF] p-4 text-sm text-[#2F2633]/75">
              <p className="font-semibold text-[#2F2633]">Har du allerede en profil?</p>
              <p className="mt-1 leading-6">
                Log ind med din e-mail, eller få tilsendt et link til ny adgangskode, hvis du ikke kan huske den.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#7A4EAB] px-4 text-sm font-semibold text-white transition hover:bg-[#6D439C]"
                  href="/auth/login"
                >
                  Gå til login
                </Link>
                <Link
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#7A4EAB]/25 bg-white px-4 text-sm font-semibold text-[#7A4EAB] transition hover:bg-[#EDE4F7]"
                  href="/auth/forgot-password"
                >
                  Glemt adgangskode?
                </Link>
              </div>
            </div>
          )}

          <SignupForm documents={legalDocuments ?? []} restoreValues={shouldRestoreFormValues} />

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
