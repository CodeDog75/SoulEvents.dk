import Link from "next/link";
import { AuthMessage } from "@/components/auth/auth-message";
import { BrandLogo } from "@/components/brand-logo";
import { resendConfirmationAction, signInAction } from "@/app/auth/actions";

type LoginPageProps = {
  searchParams: Promise<{
    message?: string;
    role?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { message, role } = await searchParams;
  const loginRole = role === "admin" ? "admin" : role === "facilitator" ? "facilitator" : null;
  const title =
    loginRole === "admin" ? "Admin-login" : loginRole === "facilitator" ? "Facilitator-login" : "Log ind";
  const description =
    loginRole === "admin"
      ? "Log ind for at godkende profiler, se dashboard og arbejde med fakturakladder."
      : loginRole === "facilitator"
        ? "Log ind for at redigere profil, oprette events og håndtere tilmeldinger."
        : "Brug din konto som administrator eller facilitator.";

  return (
    <main className="grid min-h-screen place-items-center bg-[#fbfaf7] px-4 py-10">
      <section className="w-full max-w-md rounded-md border border-midnight/10 bg-white p-6 shadow-soft">
        <Link className="mb-8 flex items-center gap-3" href="/">
          <BrandLogo className="h-24 w-24" priority />
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

        <form action={resendConfirmationAction} className="mt-6 rounded-card bg-sage-50 p-4">
          <p className="text-sm font-semibold text-olive">Har du ikke fået bekræftet e-mailen?</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              className="h-11 rounded-input border border-olive/15 px-3 text-base outline-none transition focus:border-rose"
              name="email"
              placeholder="munch4300+leif@gmail.com"
              type="email"
            />
            <button
              className="h-11 rounded-button bg-olive px-4 text-sm font-semibold text-white transition hover:bg-sage-500"
              type="submit"
            >
              Send igen
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
