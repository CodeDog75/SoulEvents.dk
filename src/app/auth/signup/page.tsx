import Link from "next/link";
import { AuthMessage } from "@/components/auth/auth-message";
import { BrandLogo } from "@/components/brand-logo";
import { LegalConsentLinks } from "@/components/auth/legal-consent-links";
import { SignupSteps } from "@/components/auth/signup-steps";
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
    <main className="grid min-h-screen place-items-center bg-[#fbfaf7] px-4 py-10">
      <section className="w-full max-w-2xl rounded-md border border-midnight/10 bg-white p-6 shadow-soft">
        <Link className="mb-8 flex items-center gap-3" href="/">
          <BrandLogo className="h-24 w-24" priority />
          <div>
            <p className="text-sm text-ink/65">Facilitator</p>
          </div>
        </Link>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-midnight">Opret facilitatorprofil</h1>
          <div className="rounded-md border border-sage-700/10 bg-sage-50/60 px-3 py-3 text-sm leading-6 text-ink/72">
            <p className="font-semibold text-midnight">Sådan kommer du i gang</p>
            <SignupSteps />
            <p className="mt-4 text-ink/68">
              Det er gratis at blive en del af SoulEvents. Du har altid kontrol over dine oplysninger og kan få din
              profil slettet når som helst.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <AuthMessage message={message} />
        </div>

        <form
          action={signUpFacilitatorAction}
          className="mt-6 grid gap-4 [&_input::placeholder]:text-sm [&_input::placeholder]:font-normal [&_input::placeholder]:text-ink/45"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              E-mail *
              <input
                autoComplete="email"
                className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
                name="email"
                placeholder="din@mail.dk"
                required
                type="email"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Adgangskode *
              <input
                autoComplete="new-password"
                className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
                minLength={8}
                name="password"
                placeholder="Mindst 8 tegn"
                required
                type="password"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Dit rigtige navn *
              <input
                autoComplete="name"
                className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
                name="full_name"
                placeholder="Dit fulde navn"
                required
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Telefon
              <input
                autoComplete="tel"
                inputMode="tel"
                className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
                maxLength={11}
                name="phone"
                pattern="[0-9 ]*"
                placeholder="Kan udfyldes senere"
                title="Telefonnummer skal bestå af præcis 8 tal. Mellemrum er tilladt."
              />
            </label>
          </div>

          <label className="flex items-start gap-3 rounded-md bg-sage-50 p-4 text-sm leading-6 text-ink/72">
            <input className="mt-1 size-4 accent-sage-700" name="accepted_terms" required type="checkbox" />
            <span>
              <LegalConsentLinks documents={legalDocuments ?? []} />
            </span>
          </label>

          <button
            className="mt-2 h-11 rounded-md bg-midnight px-4 text-sm font-semibold text-white transition hover:bg-sage-700"
            type="submit"
          >
            Opret facilitatorprofil
          </button>
        </form>

        <p className="mt-6 text-sm text-ink/66">
          Har du allerede en konto?{" "}
          <Link className="font-semibold text-sage-700 hover:text-terracotta" href="/auth/login">
            Log ind
          </Link>
        </p>
      </section>
    </main>
  );
}
