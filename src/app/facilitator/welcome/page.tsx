import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Images, Leaf, Tags } from "lucide-react";
import { OnboardingIntro, OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { createPageMetadata } from "@/lib/open-graph";
import { getBrandLogoSources, type LogoSettingClient } from "@/lib/brand-logo";
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
  const logoSources = await getBrandLogoSources(supabase as unknown as LogoSettingClient);
  const { data: facilitatorProfile } = await supabase
    .from("facilitator_profiles")
    .select("company_name, short_description, postal_code, city, facilitator_categories(category_id)")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!facilitatorProfile) {
    redirect("/auth/oauth-profile");
  }

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
    <OnboardingShell
      backLink={{ href: "/", label: "Tilbage til forsiden" }}
      footer={
        <Link
          autoFocus
          className="inline-flex min-h-16 w-full items-center justify-center gap-2 rounded-[999px] bg-midnight px-6 text-lg font-semibold text-white shadow-soft transition duration-200 hover:bg-sage-700 lg:min-h-12 lg:text-base xl:min-h-14"
          href="/facilitator/profile"
        >
          Lad os komme i gang
          <ArrowRight aria-hidden="true" className="size-5" />
        </Link>
      }
      mode="welcome"
      scrollKey="facilitator-welcome"
      visualPanel={{
        logoSources,
        text: "En varm begyndelse på en profil, mennesker kan mærke.",
      }}
    >
      <OnboardingIntro
        eyebrow="Arrangørprofil"
        text="Tak fordi du vil være en del af SoulEvents. Vi hjælper dig nu med at skabe en profil, så mennesker kan finde dig og dine begivenheder. Det tager kun få minutter."
        title="🌿 Velkommen til SoulEvents"
      />

      <ul className="grid gap-3">
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
    </OnboardingShell>
  );
}
