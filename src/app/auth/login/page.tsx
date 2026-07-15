import type { Metadata } from "next";
import Link from "next/link";
import { continueWithEmailAction, resendConfirmationAction, signInAction } from "@/app/auth/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { SignupForm } from "@/components/auth/signup-form";
import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";
import { BrandLogo } from "@/components/brand-logo";
import { createPageMetadata } from "@/lib/open-graph";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = createPageMetadata({
  title: "Log ind | SoulEvents.dk",
  description: "Log ind på SoulEvents.dk som arrangør eller administrator.",
  imageTitle: "Log ind på SoulEvents.dk",
  imageSubtitle: "Administrer profil, events og tilmeldinger.",
  path: "/auth/login",
});

type LoginPageProps = {
  searchParams: Promise<{
    confirmation?: string;
    email?: string;
    message?: string;
    role?: string;
    step?: string;
  }>;
};

function normalizeEmail(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

function authStep(value?: string) {
  if (value === "password" || value === "signup") {
    return value;
  }

  return "email";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { confirmation, email, message, role, step } = await searchParams;
  const currentStep = authStep(step);
  const selectedEmail = normalizeEmail(email);
  const loginRole = role === "admin" ? "admin" : role === "facilitator" ? "facilitator" : null;
  const showConfirmationHelp =
    confirmation === "needed" ||
    confirmation === "expired" ||
    Boolean(message?.toLowerCase().includes("bekræftelsesmail") || message?.toLowerCase().includes("bekræftelseslink"));
  const title =
    currentStep === "password"
      ? "Velkommen tilbage"
      : currentStep === "signup"
        ? "Lad os oprette din arrangørkonto"
        : loginRole === "admin"
          ? "Admin-login"
          : "Velkommen til SoulEvents";
  const description =
    currentStep === "password"
      ? "Skriv din adgangskode for at fortsætte."
      : currentStep === "signup"
        ? "E-mailen ser ny ud hos SoulEvents. Opret en gratis arrangørkonto og kom videre til din profil."
        : loginRole === "admin"
          ? "Start med din e-mailadresse. Hvis kontoen findes, går du videre til login."
          : "Start med din e-mailadresse. Så finder vi den rigtige vej for dig.";
  const supabase = currentStep === "signup" ? await createClient() : null;
  const { data: legalDocuments } = supabase
    ? await supabase
        .from("legal_documents")
        .select("title, slug, body")
        .in("slug", ["handelsbetingelser", "privatlivspolitik", "platformens-retningslinjer"])
        .eq("is_published", true)
    : { data: null };

  return (
    <main className="min-h-screen bg-[#F4EEF8] px-4 py-6 text-[#2F2633] sm:py-10 lg:grid lg:place-items-center">
      <section className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/55 bg-[#FAF8F3] shadow-soft lg:min-h-[680px] lg:grid-cols-[42%_58%]">
        <aside className="hidden bg-[#2F2633] lg:block">
          <div className="relative h-full min-h-[680px] overflow-hidden">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[url('/facilitator/onboarding-nature.png')] bg-cover bg-center opacity-80"
            />
            <div aria-hidden="true" className="absolute inset-0 bg-[#2F2633]/35" />
            <div className="relative flex h-full flex-col justify-between p-10 text-white">
              <Link aria-label="SoulEvents forside" className="inline-flex w-fit" href="/">
                <BrandLogo className="h-28 w-28 brightness-0 invert" priority />
              </Link>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/70">SoulEvents.dk</p>
                <p className="mt-4 text-3xl font-semibold leading-tight">
                  En rolig vej ind til din profil, dine events og dit fællesskab.
                </p>
              </div>
            </div>
          </div>
        </aside>

        <section className="flex min-h-[calc(100dvh-48px)] flex-col px-5 py-6 sm:px-8 lg:min-h-0 lg:px-12 lg:py-10">
          <div className="mb-8 flex items-start justify-between gap-4">
            <Link aria-label="SoulEvents forside" className="shrink-0 lg:hidden" href="/">
              <BrandLogo className="h-24 w-24" priority />
            </Link>
            <Link
              className="ml-auto inline-flex min-h-11 items-center justify-center rounded-full border border-[#7A4EAB]/15 bg-white/80 px-4 text-sm font-semibold text-[#7A4EAB] shadow-soft transition hover:border-[#7A4EAB]/35 hover:bg-[#EDE4F7]/70"
              href="/"
            >
              Tilbage til forsiden
            </Link>
          </div>

          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7A4EAB]">
                {currentStep === "email" ? "Log ind eller opret konto" : "SoulEvents-konto"}
              </p>
              <h1 className="text-3xl font-semibold leading-tight text-[#2F2633] sm:text-4xl">{title}</h1>
              <p className="text-base leading-7 text-[#2F2633]/68">{description}</p>
            </div>

            <div className="mt-5">
              <AuthMessage message={message} />
            </div>

            {currentStep === "email" ? (
              <>
                <form action={continueWithEmailAction} className="mt-7 grid gap-4">
                  <label className="grid gap-2 text-sm font-medium text-[#2F2633]/72">
                    E-mail
                    <input
                      autoComplete="email"
                      autoFocus
                      className="h-14 rounded-2xl border border-[#7A4EAB]/15 bg-white px-4 text-base outline-none transition focus:border-[#7A4EAB]"
                      defaultValue={selectedEmail}
                      name="email"
                      required
                      type="email"
                    />
                  </label>

                  <button
                    className="h-12 rounded-full bg-[#7A4EAB] px-5 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-[#6A4199] hover:shadow-lift"
                    type="submit"
                  >
                    Fortsæt
                  </button>
                </form>

                <div className="my-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#2F2633]/42">
                  <span className="h-px flex-1 bg-[#EDE4F7]" />
                  eller
                  <span className="h-px flex-1 bg-[#EDE4F7]" />
                </div>

                <SocialAuthButtons mode="login" />
              </>
            ) : null}

            {currentStep === "password" ? (
              <>
                <form action={signInAction} className="mt-7 grid gap-4">
                  <label className="grid gap-2 text-sm font-medium text-[#2F2633]/72">
                    E-mail
                    <input
                      autoComplete="email"
                      className="h-12 rounded-2xl border border-[#7A4EAB]/15 bg-white px-4 text-base outline-none transition focus:border-[#7A4EAB]"
                      defaultValue={selectedEmail}
                      name="email"
                      readOnly
                      required
                      type="email"
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-[#2F2633]/72">
                    Adgangskode
                    <input
                      autoComplete="current-password"
                      autoFocus
                      className="h-12 rounded-2xl border border-[#7A4EAB]/15 bg-white px-4 text-base outline-none transition focus:border-[#7A4EAB]"
                      minLength={8}
                      name="password"
                      required
                      type="password"
                    />
                  </label>

                  <div className="flex items-center justify-between gap-3">
                    <Link className="text-sm font-semibold text-[#7A4EAB] hover:text-[#D8A7B1]" href="/auth/login">
                      Brug en anden e-mail
                    </Link>
                    <Link className="text-sm font-semibold text-[#4B5645] hover:text-[#D8A7B1]" href="/auth/forgot-password">
                      Glemt adgangskode?
                    </Link>
                  </div>

                  <button
                    className="mt-1 h-12 rounded-full bg-[#7A4EAB] px-5 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-[#6A4199] hover:shadow-lift"
                    type="submit"
                  >
                    Log ind
                  </button>
                </form>

                <div className="my-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#2F2633]/42">
                  <span className="h-px flex-1 bg-[#EDE4F7]" />
                  eller
                  <span className="h-px flex-1 bg-[#EDE4F7]" />
                </div>

                <SocialAuthButtons mode="login" />
              </>
            ) : null}

            {currentStep === "signup" ? (
              <div className="mt-7 space-y-6">
                <section className="rounded-[1.5rem] border border-[#A8BFA3]/30 bg-[#F2F8EF] p-5 shadow-soft">
                  <h2 className="text-lg font-semibold leading-snug text-[#2F2633]">
                    Vi kunne ikke finde en konto med denne e-mail.
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-[#2F2633]/70">
                    Det ser ud til, at du er ny hos SoulEvents. Hvis du ønsker at oprette en arrangørprofil, kan du gøre det her. Det er gratis og tager kun et par minutter.
                  </p>
                  <div className="mt-4 rounded-2xl border border-[#7A4EAB]/12 bg-white/75 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4B5645]/70">E-mail</p>
                    <p className="mt-1 break-all text-sm font-semibold text-[#2F2633]">{selectedEmail}</p>
                  </div>
                  <p className="mt-4 text-sm text-[#2F2633]/64">
                    Har du skrevet forkert?{" "}
                    <Link
                      className="font-semibold text-[#7A4EAB] hover:text-[#D8A7B1]"
                      href={selectedEmail ? `/auth/login?email=${encodeURIComponent(selectedEmail)}` : "/auth/login"}
                    >
                      Brug en anden e-mail
                    </Link>
                  </p>
                </section>

                <SignupForm
                  documents={legalDocuments ?? []}
                  initialEmail={selectedEmail}
                  returnToEmailFirstLogin
                />
                <p className="mt-5 text-center text-sm text-[#2F2633]/64">
                  Har du allerede en konto?{" "}
                  <Link
                    className="font-semibold text-[#7A4EAB] hover:text-[#D8A7B1]"
                    href={selectedEmail ? `/auth/login?step=password&email=${encodeURIComponent(selectedEmail)}` : "/auth/login"}
                  >
                    Log ind i stedet
                  </Link>
                </p>
              </div>
            ) : null}

            {showConfirmationHelp ? (
              <form
                action={resendConfirmationAction}
                className="mt-7 rounded-[1.25rem] border border-[#D8A7B1]/45 bg-[#FFF8F6] p-4 shadow-soft"
              >
                <p className="text-sm font-semibold text-[#4B5645]">
                  {confirmation === "expired" ? "Bekræftelseslinket er udløbet" : "Mangler du bekræftelsesmailen?"}
                </p>
                <p className="mt-1 text-sm leading-6 text-[#2F2633]/65">
                  Skriv din e-mailadresse, så sender vi et nyt link. Brug altid den nyeste mail i din indbakke.
                </p>
                <div className="mt-3 grid gap-3">
                  <input
                    className="h-11 rounded-xl border border-[#4B5645]/15 bg-white px-3 text-base outline-none transition focus:border-[#7A4EAB]"
                    defaultValue={selectedEmail}
                    name="email"
                    placeholder="din@email.dk"
                    required
                    type="email"
                  />
                  <button
                    className="min-h-11 rounded-full bg-[#4B5645] px-4 text-sm font-semibold text-white transition hover:bg-[#6A765F]"
                    type="submit"
                  >
                    Send bekræftelsesmail igen
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}
