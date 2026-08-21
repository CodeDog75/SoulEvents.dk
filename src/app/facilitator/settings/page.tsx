import { redirect } from "next/navigation";
import { CookieSettingsButton } from "@/components/cookie-settings-button";
import { LoginSecuritySection } from "@/components/facilitator/login-security-section";
import { FacilitatorPauseSection } from "@/components/facilitator/facilitator-dashboard-settings-sections";
import { getFacilitatorDashboardContext } from "@/lib/facilitator/dashboard-data";

export const dynamic = "force-dynamic";

export default async function FacilitatorSettingsPage() {
  const { facilitatorProfile, profile, supabase } = await getFacilitatorDashboardContext();

  if (!facilitatorProfile) {
    redirect("/auth/oauth-profile");
  }

  const [{ data: authUserData, error: authUserError }, { data: pendingEmailChange }] = await Promise.all([
    supabase.auth.admin.getUserById(profile.id),
    supabase
      .from("email_change_requests")
      .select("new_email, expires_at")
      .eq("profile_id", profile.id)
      .eq("status", "pending")
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const authProviders = authUserData.user?.identities?.map((identity) => identity.provider).filter(Boolean) ?? [];

  return (
    <main className="min-h-screen bg-[#FAF8F4] px-4 py-6 text-[#2F2437] sm:px-6 lg:px-8">
      <section className="mx-auto grid max-w-5xl gap-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Generelle indstillinger</p>
          <h1 className="mt-1 text-3xl font-semibold text-[#2F2437]">Konto og sikkerhed</h1>
          <p className="mt-2 text-sm leading-6 text-[#6E6475]">Administrér login, mailadresse, adgangskode og profilpause.</p>
        </header>
        <LoginSecuritySection
          authProviders={authProviders}
          currentEmail={profile.email}
          pendingEmailChange={pendingEmailChange}
        />
        <FacilitatorPauseSection isPaused={Boolean(facilitatorProfile.is_paused)} />
        <section className="rounded-[28px] border border-[#E5DDEA] bg-white/78 p-5 shadow-soft">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7A5D91]">Cookievalg</p>
          <h2 className="mt-1 text-lg font-semibold text-[#2F2437]">Cookieindstillinger</h2>
          <p className="mt-2 text-sm leading-6 text-[#6E6475]">
            Du kan altid justere, hvilke valgfrie cookies SoulEvents må bruge til statistik og markedsføring.
          </p>
          <CookieSettingsButton className="mt-3 inline-flex text-sm font-semibold text-[#7A5D91] underline underline-offset-4 transition hover:text-[#5F4777] focus:outline-none focus:ring-4 focus:ring-[#E5DDEA]" />
        </section>
      </section>
    </main>
  );
}
