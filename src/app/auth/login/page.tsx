import Link from "next/link";
import { AuthMessage } from "@/components/auth/auth-message";
import { BrandLogo } from "@/components/brand-logo";
import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";
import { resendConfirmationAction, signInAction } from "@/app/auth/actions";

type LoginPageProps = {
  searchParams: Promise<{
    confirmation?: string;
    email?: string;
    message?: string;
    role?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { confirmation, email, message, role } = await searchParams;
  const loginRole = role === "admin" ? "admin" : role === "facilitator" ? "facilitator" : null;
  const showConfirmationHelp =
    confirmation === "needed" ||
    confirmation === "expired" ||
    Boolean(message?.toLowerCase().includes("bekræftelsesmail") || message?.toLowerCase().includes("bekræftelseslink"));
  const title =
    loginRole === "admin" ? "Admin-login" : loginRole === "facilitator" ? "Arrangør-login" : "Log ind";
  const description =
    loginRole === "admin"
      ? "Log ind for at godkende profiler, se dashboard og arbejde med fakturakladder."
      : loginRole === "facilitator"
        ? "Log ind for at redigere profil, oprette events og håndtere tilmeldinger."
        : "Brug din konto som administrator eller arrangør.";

  return (
    <main className="min-h-screen bg-[#fbfaf7] px-4 py-10">
      <div className="mx-auto mb-5 flex w-full max-w-md justify-end">
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#7A4EAB]/15 bg-white/85 px-4 text-sm font-semibold text-[#7A4EAB] shadow-soft transition hover:border-[#7A4EAB]/35 hover:bg-[#EDE4F7]/70"
          href="/"
        >
          Tilbage til forsiden
        </Link>
      </div>

      <section className="mx-auto w-full max-w-md rounded-md border border-midnight/10 bg-white p-6 shadow-soft">
        <Link className="mb-8 flex items-center gap-3" href="/">
          <BrandLogo className="h-32 w-32" priority />
          <div>
            <p className="text-sm text-ink/65">{title}</p>
          </div>
        </Link>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-midnight">{title}</h1>
          <p className="text-sm leading-6 text-ink/65">{description}</p>
        </div>

        <div className="mt-5">
          <AuthMessage message={message} />
        </div>

        <div className="mt-6">
          <SocialAuthButtons mode="login" />
        </div>

        <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#2F2633]/42">
          <span className="h-px flex-1 bg-[#EDE4F7]" />
          eller
          <span className="h-px flex-1 bg-[#EDE4F7]" />
        </div>

        <form action={signInAction} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-ink/72">
            E-mail
            <input
              autoComplete="email"
              className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
              name="email"
              required
              type="email"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            Adgangskode
            <input
              autoComplete="current-password"
              className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
              minLength={8}
              name="password"
              required
              type="password"
            />
          </label>

          <div className="flex justify-end">
            <Link className="text-sm font-semibold text-sage-700 hover:text-terracotta" href="/auth/forgot-password">
              Glemt adgangskode?
            </Link>
          </div>

          <button
            className="mt-2 h-11 rounded-md bg-midnight px-4 text-sm font-semibold text-white transition hover:bg-sage-700"
            type="submit"
          >
            Log ind
          </button>
        </form>

        <p className="mt-6 text-sm text-ink/66">
          Ny facilitator?{" "}
          <Link className="font-semibold text-sage-700 hover:text-terracotta" href="/auth/signup">
            Opret profil
          </Link>
        </p>

        <form
          action={resendConfirmationAction}
          className={
            "mt-6 rounded-card p-4 " +
            (showConfirmationHelp
              ? "border border-[#D8A7B1]/45 bg-[#FFF8F6] shadow-soft"
              : "bg-sage-50")
          }
        >
          <p className="text-sm font-semibold text-olive">
            {confirmation === "expired" ? "Bekræftelseslinket er udløbet" : "Mangler du bekræftelsesmailen?"}
          </p>
          {showConfirmationHelp ? (
            <p className="mt-1 text-sm leading-6 text-ink/65">
              Skriv din e-mailadresse, så sender vi et nyt link. Brug altid den nyeste mail i din indbakke.
            </p>
          ) : null}
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              className="h-11 rounded-input border border-olive/15 px-3 text-base outline-none transition focus:border-rose"
              defaultValue={email ?? ""}
              name="email"
              placeholder="din@email.dk"
              required
              type="email"
            />
            <button
              className="h-11 rounded-button bg-olive px-4 text-sm font-semibold text-white transition hover:bg-sage-500"
              type="submit"
            >
              Send bekræftelsesmail igen
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
