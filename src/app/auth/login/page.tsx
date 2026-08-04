import type { Metadata } from "next";
import Link from "next/link";
import { continueWithEmailAction, resendConfirmationAction, signInAction } from "@/app/auth/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { SignupForm } from "@/components/auth/signup-form";
import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";
import { OnboardingIntro, OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { getBrandLogoSources, type LogoSettingClient } from "@/lib/brand-logo";
import { createPageMetadata } from "@/lib/open-graph";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = createPageMetadata({
  title: "Log ind | SoulEvents.dk",
  description: "Log ind på SoulEvents.dk som arrangør eller administrator.",
  imageTitle: "Log ind på SoulEvents.dk",
  imageSubtitle: "Administrer profil, begivenheder og tilmeldinger.",
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
  if (value === "new" || value === "password" || value === "signup") {
    return value;
  }

  return "email";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [{ confirmation, email, message, role, step }, supabase] = await Promise.all([searchParams, createClient()]);
  const logoSources = await getBrandLogoSources(supabase as unknown as LogoSettingClient);
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
      : currentStep === "new"
        ? "Skal vi oprette en profil til dig?"
        : currentStep === "signup"
          ? "Lad os oprette din arrangørkonto"
          : loginRole === "admin"
            ? "Admin-login"
            : "Velkommen til SoulEvents";
  const description =
    currentStep === "password"
      ? "Skriv din adgangskode for at fortsætte."
      : currentStep === "new"
        ? "Det ser ud til, at du er ny hos SoulEvents."
        : currentStep === "signup"
          ? "Opret din konto. Bagefter hjælper vi dig roligt videre til din arrangørprofil."
          : loginRole === "admin"
            ? "Start med din e-mailadresse. Hvis kontoen findes, går du videre til login."
            : "Start med din e-mailadresse. Så finder vi den rigtige vej for dig.";

  return (
    <OnboardingShell
      backLink={{ href: "/", label: "Tilbage til forsiden" }}
      mode="auth"
      scrollKey={currentStep}
      visualPanel={{
        logoSources,
        text: "En rolig vej ind til din profil, dine begivenheder og dit fællesskab.",
      }}
    >
      <div className="mx-auto w-full max-w-md">
        <OnboardingIntro
          eyebrow={currentStep === "email" ? "Log ind eller opret konto" : "SoulEvents-konto"}
          text={description}
          title={title}
        />

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
                  className="h-14 rounded-2xl border border-midnight/15 bg-white px-4 text-base outline-none transition focus:border-sage-700"
                  defaultValue={selectedEmail}
                  name="email"
                  required
                  type="email"
                />
              </label>

              <AuthSubmitButton
                className="h-12 rounded-full bg-midnight px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-700 disabled:cursor-wait disabled:opacity-75"
                pendingLabel="Tjekker e-mail..."
              >
                Fortsæt
              </AuthSubmitButton>
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
                  className="h-12 rounded-2xl border border-midnight/15 bg-white px-4 text-base outline-none transition focus:border-sage-700"
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
                  className="h-12 rounded-2xl border border-midnight/15 bg-white px-4 text-base outline-none transition focus:border-sage-700"
                  minLength={8}
                  name="password"
                  required
                  type="password"
                />
              </label>

              <div className="flex items-center justify-between gap-3">
                <Link className="text-sm font-semibold text-sage-700 hover:text-midnight" href="/auth/login">
                  Brug en anden e-mail
                </Link>
                <Link className="text-sm font-semibold text-[#4B5645] hover:text-[#D8A7B1]" href="/auth/forgot-password">
                  Glemt adgangskode?
                </Link>
              </div>

              <AuthSubmitButton
                className="mt-1 h-12 rounded-full bg-midnight px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-700 disabled:cursor-wait disabled:opacity-75"
                pendingLabel="Logger ind..."
              >
                Log ind
              </AuthSubmitButton>
            </form>

            <div className="my-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#2F2633]/42">
              <span className="h-px flex-1 bg-[#EDE4F7]" />
              eller
              <span className="h-px flex-1 bg-[#EDE4F7]" />
            </div>

            <SocialAuthButtons mode="login" />
          </>
        ) : null}

        {currentStep === "new" ? (
          <div className="mt-7 space-y-6">
            <section className="rounded-[1.5rem] border border-[#A8BFA3]/30 bg-[#F2F8EF] p-5 shadow-soft">
              <h2 className="text-lg font-semibold leading-snug text-[#2F2633]">
                Vi kunne ikke finde en konto med denne e-mail.
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#2F2633]/70">Det ser ud til, at du er ny hos SoulEvents.</p>
              <p className="mt-3 text-sm leading-6 text-[#2F2633]/70">
                Hvis du ønsker at blive arrangør, kan du oprette en gratis konto og derefter opbygge din profil.
              </p>
              <p className="mt-3 text-sm leading-6 text-[#2F2633]/70">Det tager kun et par minutter.</p>
              <div className="mt-4 rounded-2xl border border-[#7A4EAB]/12 bg-white/75 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4B5645]/70">E-mail</p>
                <p className="mt-1 break-all text-sm font-semibold text-[#2F2633]">{selectedEmail}</p>
              </div>
              <div className="mt-5 grid gap-4">
                <Link
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-midnight px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-700"
                  href={`/auth/login?step=signup&email=${encodeURIComponent(selectedEmail)}`}
                >
                  Fortsæt og opret arrangørprofil
                </Link>
                <div className="grid gap-1 text-center text-sm text-[#2F2633]/64">
                  <p>Har du skrevet e-mailen forkert?</p>
                  <Link
                    className="font-semibold text-sage-700 hover:text-midnight"
                    href={selectedEmail ? `/auth/login?email=${encodeURIComponent(selectedEmail)}` : "/auth/login"}
                  >
                    Prøv en anden e-mailadresse
                  </Link>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {currentStep === "signup" ? (
          <div className="mt-7">
            <p className="mb-5 rounded-[1.25rem] border border-[#A8BFA3]/25 bg-[#F2F8EF] p-4 text-sm leading-6 text-[#2F2633]/70">
              Vi bruger e-mailen nedenfor til din konto. Juridisk accept kommer først, når din profil er klar til at blive sendt til godkendelse.
            </p>
            <SignupForm initialEmail={selectedEmail} returnToEmailFirstLogin variant="onboarding" />
            <p className="mt-5 text-center text-sm text-[#2F2633]/64">
              Har du allerede en konto?{" "}
              <Link
                className="font-semibold text-sage-700 hover:text-midnight"
                href={selectedEmail ? `/auth/login?step=password&email=${encodeURIComponent(selectedEmail)}` : "/auth/login"}
              >
                Log ind i stedet
              </Link>
            </p>
          </div>
        ) : null}

        {showConfirmationHelp ? (
          <form action={resendConfirmationAction} className="mt-7 rounded-[1.25rem] border border-[#D8A7B1]/45 bg-[#FFF8F6] p-4 shadow-soft">
            <p className="text-sm font-semibold text-[#4B5645]">
              {confirmation === "expired" ? "Bekræftelseslinket er udløbet" : "Mangler du bekræftelsesmailen?"}
            </p>
            <p className="mt-1 text-sm leading-6 text-[#2F2633]/65">
              Skriv din e-mailadresse, så sender vi et nyt link. Brug altid den nyeste mail i din indbakke.
            </p>
            <div className="mt-3 grid gap-3">
              <input
                className="h-11 rounded-xl border border-[#4B5645]/15 bg-white px-3 text-base outline-none transition focus:border-sage-700"
                defaultValue={selectedEmail}
                name="email"
                placeholder="din@email.dk"
                required
                type="email"
              />
              <AuthSubmitButton
                className="min-h-11 rounded-full bg-[#4B5645] px-4 text-sm font-semibold text-white transition hover:bg-[#6A765F] disabled:cursor-wait disabled:opacity-75"
                pendingLabel="Sender..."
              >
                Send bekræftelsesmail igen
              </AuthSubmitButton>
            </div>
          </form>
        ) : null}
      </div>
    </OnboardingShell>
  );
}
