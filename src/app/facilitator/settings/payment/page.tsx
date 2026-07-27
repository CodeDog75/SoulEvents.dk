import { redirect } from "next/navigation";
import { PaymentSettingsCard } from "@/components/facilitator/payment-settings-card";
import { getFacilitatorDashboardContext } from "@/lib/facilitator/dashboard-data";

export const dynamic = "force-dynamic";

export default async function FacilitatorPaymentSettingsPage() {
  const { facilitatorProfile, supabase } = await getFacilitatorDashboardContext();

  if (!facilitatorProfile) {
    redirect("/auth/oauth-profile");
  }

  const { data: paymentSettings } = await supabase
    .from("facilitator_payment_settings")
    .select(
      "mobilepay_number, bank_registration_number, bank_account_number, bank_account_name, external_url, instructions, deadline_days",
    )
    .eq("facilitator_id", facilitatorProfile.id)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-[#FAF8F4] px-4 py-6 text-[#2F2437] sm:px-6 lg:px-8">
      <section className="mx-auto grid max-w-5xl gap-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Betalingsindstillinger</p>
          <h1 className="mt-1 text-3xl font-semibold text-[#2F2437]">Standardbetaling</h1>
          <p className="mt-2 text-sm leading-6 text-[#6E6475]">Gem de betalingsoplysninger, du normalt vil sende til deltagere ved betalte events.</p>
        </header>
        <PaymentSettingsCard paymentSettings={paymentSettings} />
      </section>
    </main>
  );
}
