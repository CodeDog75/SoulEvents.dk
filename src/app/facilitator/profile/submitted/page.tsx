import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { OnboardingIntro, OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { requireRole } from "@/lib/auth/roles";
import { getBrandLogoSources, type LogoSettingClient } from "@/lib/brand-logo";
import { getFacilitatorOnboardingStateForProfile } from "@/lib/facilitators/onboarding-state";
import { createPageMetadata } from "@/lib/open-graph";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
  title: "Profil sendt til gennemgang | SoulEvents.dk",
  description: "Din arrangørprofil er oprettet og sendt til SoulEvents’ gennemgang.",
  imageTitle: "Velkommen til SoulEvents",
  imageSubtitle: "Din profil er sendt til gennemgang.",
  path: "/facilitator/profile/submitted",
});

export default async function FacilitatorProfileSubmittedPage() {
  const profile = await requireRole("facilitator");
  const supabase = await createClient();
  const [logoSources, onboardingState] = await Promise.all([
    getBrandLogoSources(supabase as unknown as LogoSettingClient),
    getFacilitatorOnboardingStateForProfile(supabase, {
      fullName: profile.full_name,
      profileId: profile.id,
    }),
  ]);

  if (onboardingState === "onboarding" || onboardingState === "changes_requested") {
    redirect("/facilitator/profile");
  }

  if (onboardingState === "approved") {
    redirect("/facilitator");
  }

  if (onboardingState === "disabled") {
    redirect("/auth/login");
  }

  return (
    <OnboardingShell
      footer={
        <div className="grid gap-4">
          <Link
            className="inline-flex min-h-16 w-full items-center justify-center gap-2 rounded-[999px] bg-midnight px-6 text-lg font-semibold text-white shadow-soft transition duration-200 hover:bg-sage-700 lg:min-h-12 lg:text-base xl:min-h-14"
            href="/facilitator/events"
          >
            Opret dit første event
            <ArrowRight className="size-5" aria-hidden="true" />
          </Link>
          <Link
            className="justify-self-center text-sm font-semibold text-sage-700 underline underline-offset-4 transition hover:text-midnight"
            href="/facilitator"
          >
            Gå til mit dashboard
          </Link>
        </div>
      }
      mode="success"
      scrollKey="facilitator-profile-submitted"
      visualPanel={{
        logoSources,
        text: "Din profil er sendt videre. Nu begynder næste skridt.",
      }}
    >
      <div className="grid gap-8 text-left">
        <div className="grid justify-items-start gap-5">
          <span className="grid size-14 place-items-center rounded-full bg-sage-50 text-sage-700 shadow-soft">
            <CheckCircle2 className="size-7" aria-hidden="true" />
          </span>
          <OnboardingIntro
            eyebrow="VELKOMMEN"
            text="Din arrangørprofil er nu oprettet og sendt til gennemgang."
            title="Vi er glade for at byde dig velkommen til SoulEvents."
          />
        </div>

        <div className="grid gap-4 text-base leading-7 text-ink/65">
          <p>
            Vi gennemgår alle nye profiler manuelt for at sikre en tryg og troværdig platform. Du modtager en e-mail,
            så snart din profil er godkendt.
          </p>
          <p>
            Du kan allerede nu begynde at oprette dit første event. Eventet gemmes som en kladde og bliver først synligt,
            når din arrangørprofil er godkendt.
          </p>
        </div>
      </div>
    </OnboardingShell>
  );
}
