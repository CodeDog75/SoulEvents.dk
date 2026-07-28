import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Home, PencilLine } from "lucide-react";
import { OnboardingIntro, OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { requireRole } from "@/lib/auth/roles";
import { getBrandLogoSources, type LogoSettingClient } from "@/lib/brand-logo";
import { getFacilitatorOnboardingStateForProfile } from "@/lib/facilitators/onboarding-state";
import { createPageMetadata } from "@/lib/open-graph";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
  title: "Profil gemt som kladde | SoulEvents.dk",
  description: "Din arrangørprofil er gemt som kladde, og du kan fortsætte senere.",
  imageTitle: "Din profil er gemt som kladde",
  imageSubtitle: "Fortsæt, når det passer dig.",
  path: "/facilitator/profile/draft",
});

export default async function FacilitatorProfileDraftPage() {
  const profile = await requireRole("facilitator");
  const supabase = await createClient();
  const [logoSources, onboardingState] = await Promise.all([
    getBrandLogoSources(supabase as unknown as LogoSettingClient),
    getFacilitatorOnboardingStateForProfile(supabase, {
      fullName: profile.full_name,
      profileId: profile.id,
    }),
  ]);

  if (onboardingState === "approved") {
    redirect("/facilitator");
  }

  if (onboardingState === "pending_review") {
    redirect("/facilitator/profile/submitted");
  }

  if (onboardingState === "changes_requested") {
    redirect("/facilitator/profile");
  }

  if (onboardingState === "disabled") {
    redirect("/auth/login");
  }

  return (
    <OnboardingShell
      backLink={{ href: "/", label: "Til forsiden" }}
      footer={
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Link
            className="inline-flex min-h-16 items-center justify-center gap-2 rounded-[999px] bg-midnight px-6 text-lg font-semibold text-white shadow-soft transition duration-200 hover:bg-sage-700 lg:min-h-12 lg:text-base xl:min-h-14"
            href="/facilitator/profile"
          >
            Fortsæt din profil
            <ArrowRight className="size-5" aria-hidden="true" />
          </Link>
          <Link
            className="inline-flex min-h-16 items-center justify-center gap-2 rounded-[999px] border border-sage-700/20 bg-white px-6 text-lg font-semibold text-sage-700 shadow-soft transition duration-200 hover:border-sage-700/35 hover:bg-sage-50 lg:min-h-12 lg:text-base xl:min-h-14"
            href="/"
          >
            <Home className="size-5" aria-hidden="true" />
            Til forsiden
          </Link>
        </div>
      }
      mode="success"
      scrollKey="facilitator-profile-draft"
      visualPanel={{
        logoSources,
        text: "Din profil venter roligt på dig, indtil du er klar til næste skridt.",
      }}
    >
      <div className="grid gap-8 text-left">
        <div className="grid justify-items-start gap-5">
          <span className="grid size-14 place-items-center rounded-full bg-sage-50 text-sage-700 shadow-soft">
            <PencilLine className="size-7" aria-hidden="true" />
          </span>
          <OnboardingIntro
            eyebrow="Kladde gemt"
            text="Du kan fortsætte med din profil, når det passer dig."
            title="Din profil er gemt som kladde"
          />
        </div>
      </div>
    </OnboardingShell>
  );
}
