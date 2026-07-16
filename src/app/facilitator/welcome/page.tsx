import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Images, Leaf, Tags } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { createPageMetadata } from "@/lib/open-graph";
import { getDashboardPath, requireProfile } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
  title: "Velkommen til SoulEvents | SoulEvents.dk",
  description: "En rolig start på din arrangørprofil hos SoulEvents.",
  imageTitle: "Velkommen til SoulEvents",
  imageSubtitle: "Lad os skabe din arrangørprofil.",
  path: "/facilitator/welcome",
});

function isProfileComplete(facilitatorProfile: {
  city: string | null;
  company_name: string | null;
  facilitator_categories?: Array<{ category_id: string }> | null;
  postal_code: string | null;
  short_description: string | null;
}) {
  return (
    Boolean(facilitatorProfile.company_name) &&
    Boolean(facilitatorProfile.postal_code) &&
    Boolean(facilitatorProfile.city) &&
    Boolean(facilitatorProfile.short_description && facilitatorProfile.short_description.trim().length >= 20) &&
    Boolean(facilitatorProfile.facilitator_categories?.length)
  );
}

export default async function FacilitatorWelcomePage() {
  const profile = await requireProfile();

  if (profile.role !== "facilitator") {
    redirect(getDashboardPath(profile.role));
  }

  const supabase = await createClient();
  const { data: facilitatorProfile } = await supabase
    .from("facilitator_profiles")
    .select("company_name, short_description, postal_code, city, facilitator_categories(category_id)")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (facilitatorProfile && isProfileComplete(facilitatorProfile)) {
    redirect("/facilitator");
  }

  const steps = [
    {
      icon: Leaf,
      text: "Fortæl lidt om dig selv",
    },
    {
      icon: Images,
      text: "Tilføj billeder",
    },
    {
      icon: Tags,
      text: "Vælg dine arbejdsområder",
    },
  ];

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
                  En varm begyndelse på en profil, mennesker kan mærke.
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
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7A4EAB]">Arrangørprofil</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight text-[#2F2633] sm:text-5xl">
              🌿 Velkommen til SoulEvents
            </h1>
            <div className="mt-6 space-y-4 text-base leading-7 text-[#2F2633]/72">
              <p>Tak fordi du vil være en del af SoulEvents.</p>
              <p>
                Vi hjælper dig nu med at skabe en profil, så mennesker kan finde dig og dine begivenheder.
              </p>
              <p>Det tager kun få minutter.</p>
            </div>

            <ul className="mt-8 grid gap-3">
              {steps.map((step) => {
                const Icon = step.icon;

                return (
                  <li
                    className="flex items-center gap-3 rounded-2xl border border-[#A8BFA3]/25 bg-white/72 p-4 text-sm font-semibold text-[#2F2633] shadow-soft"
                    key={step.text}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#A8BFA3]/24 text-[#4B5645]">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <span>{step.text}</span>
                  </li>
                );
              })}
            </ul>

            <Link
              autoFocus
              className="mt-9 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#7A4EAB] px-5 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-[#6A4199] hover:shadow-lift"
              href="/facilitator/profile"
            >
              Lad os komme i gang
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}
