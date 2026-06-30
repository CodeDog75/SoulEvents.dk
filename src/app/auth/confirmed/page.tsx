import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { getCurrentProfile, getDashboardPath } from "@/lib/auth/roles";

type ConfirmedPageProps = {
  searchParams: Promise<{
    message?: string;
    next?: string;
    session?: string;
    status?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function ConfirmedPage({ searchParams }: ConfirmedPageProps) {
  const { message, next, session, status } = await searchParams;
  const profile = await getCurrentProfile();
  const isError = status === "error";
  const needsLogin = session === "missing";
  const primaryHref = profile
    ? profile.role === "facilitator"
      ? "/facilitator/profile"
      : getDashboardPath(profile.role)
    : `/auth/login?message=${encodeURIComponent("E-mailen er bekræftet. Log ind og færdiggør din arrangørprofil.")}`;
  const primaryLabel = profile ? "Færdiggør profil" : "Log ind og færdiggør profil";

  return (
    <main className="grid min-h-screen place-items-center bg-[#FAF6EF] px-4 py-10 text-[#2F2633]">
      <section className="w-full max-w-2xl rounded-[2rem] border border-[#EDE4F7] bg-white/90 p-6 shadow-soft sm:p-9">
        <Link className="mb-8 flex items-center gap-3" href="/">
          <BrandLogo className="h-24 w-24" priority />
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">SoulEvents.dk</p>
            <p className="mt-1 text-sm text-[#2F2633]/62">Events for krop, sind og sjæl</p>
          </div>
        </Link>

        <div className="rounded-[1.5rem] bg-[#FAF6EF] p-5 sm:p-7">
          <p className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#7A4EAB] shadow-soft">
            {isError ? "Bekræftelse" : "Velkommen"}
          </p>

          <h1 className="mt-5 font-serif text-4xl font-semibold leading-tight text-[#4B5645] sm:text-5xl">
            {isError ? "Linket kunne ikke bekræftes" : "Din e-mail er bekræftet"}
          </h1>

          {isError ? (
            <p className="mt-4 text-base leading-7 text-[#2F2633]/72">
              {message || "Linket kunne ikke bekræftes. Prøv at logge ind eller bed om en ny bekræftelsesmail."}
            </p>
          ) : (
            <>
              <p className="mt-4 text-base leading-7 text-[#2F2633]/72">
                Velkommen til SoulEvents. Du kan nu logge ind og færdiggøre din arrangørprofil.
              </p>
              {needsLogin ? (
                <p className="mt-4 rounded-2xl border border-[#EDE4F7] bg-white p-4 text-sm leading-6 text-[#2F2633]/70">
                  Din e-mail er bekræftet. Af sikkerhedshensyn skal du blot logge ind igen, før du fortsætter.
                </p>
              ) : null}
              <p className="mt-4 text-base leading-7 text-[#2F2633]/72">
                For at blive godkendt som arrangør skal du færdiggøre din profil med beskrivelse,
                kontaktoplysninger og relevante billeder. Når profilen er klar, gennemgår SoulEvents den og giver dig
                besked.
              </p>
            </>
          )}

          {next ? (
            <p className="mt-4 text-sm leading-6 text-[#2F2633]/54">
              Du bliver guidet videre i SoulEvents, når du fortsætter.
            </p>
          ) : null}
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-[1fr_auto]">
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#7A4EAB] px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-[#6D439C]"
            href={isError ? "/auth/login?confirmation=needed" : primaryHref}
          >
            {isError ? "Log ind eller send ny bekræftelsesmail" : primaryLabel}
          </Link>
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#7A4EAB]/18 bg-white px-5 text-sm font-semibold text-[#7A4EAB] transition hover:bg-[#EDE4F7]/65"
            href="/"
          >
            Til forsiden
          </Link>
        </div>
      </section>
    </main>
  );
}
