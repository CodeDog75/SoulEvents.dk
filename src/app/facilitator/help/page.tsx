import { redirect } from "next/navigation";
import { FacilitatorSupportForm } from "@/components/facilitator/facilitator-dashboard-settings-sections";
import { getFacilitatorDashboardContext } from "@/lib/facilitator/dashboard-data";

export const dynamic = "force-dynamic";

export default async function FacilitatorHelpPage() {
  const { facilitatorProfile } = await getFacilitatorDashboardContext();

  if (!facilitatorProfile) {
    redirect("/auth/oauth-profile");
  }

  return (
    <main className="min-h-screen bg-[#FAF8F4] px-4 py-6 text-[#2F2437] sm:px-6 lg:px-8">
      <section className="mx-auto grid max-w-5xl gap-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Hjælp og support</p>
          <h1 className="mt-1 text-3xl font-semibold text-[#2F2437]">Kontakt SoulEvents</h1>
          <p className="mt-2 text-sm leading-6 text-[#6E6475]">
            Her kan du sende en besked direkte til SoulEvents administration, hvis du har brug for hjælp til din profil eller dine events.
          </p>
        </header>
        <FacilitatorSupportForm />
      </section>
    </main>
  );
}
