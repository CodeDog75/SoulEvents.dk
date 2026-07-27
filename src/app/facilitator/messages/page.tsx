import { redirect } from "next/navigation";
import { AuthMessage } from "@/components/auth/auth-message";
import { markCurrentFacilitatorAdminMessagesRead } from "@/app/facilitator/actions";
import { FacilitatorMessageNavigationRefresh } from "@/components/facilitator/facilitator-message-navigation-refresh";
import {
  FacilitatorAdminMessagesSection,
  FacilitatorSupportForm,
} from "@/components/facilitator/facilitator-dashboard-settings-sections";
import { getFacilitatorAdminMessages, getFacilitatorDashboardContext } from "@/lib/facilitator/dashboard-data";

export const dynamic = "force-dynamic";

type FacilitatorMessagesPageProps = {
  searchParams: Promise<{ message?: string }>;
};

export default async function FacilitatorMessagesPage({ searchParams }: FacilitatorMessagesPageProps) {
  const [{ message }, { facilitatorProfile }] = await Promise.all([searchParams, getFacilitatorDashboardContext()]);

  if (!facilitatorProfile) {
    redirect("/auth/oauth-profile");
  }

  const markReadResult = await markCurrentFacilitatorAdminMessagesRead();
  const adminMessages = await getFacilitatorAdminMessages(facilitatorProfile.id, 30);
  const shouldRefreshNavigation = markReadResult.markedCount > 0;

  return (
    <main className="min-h-screen bg-[#FAF8F4] px-4 py-6 text-[#2F2437] sm:px-6 lg:px-8">
      <FacilitatorMessageNavigationRefresh shouldRefresh={shouldRefreshNavigation} />
      <section className="mx-auto grid max-w-5xl gap-6">
        <AuthMessage message={message} />
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Beskedcenter</p>
          <h1 className="mt-1 text-3xl font-semibold text-[#2F2437]">Beskeder fra SoulEvents</h1>
          <p className="mt-2 text-sm leading-6 text-[#6E6475]">Her finder du den eksisterende kommunikation mellem dig og SoulEvents administration.</p>
        </header>
        <FacilitatorSupportForm />
        <FacilitatorAdminMessagesSection adminMessages={adminMessages} />
      </section>
    </main>
  );
}
