import { redirect } from "next/navigation";
import { CookieSettingsButton } from "@/components/cookie-settings-button";
import { LoginSecuritySection } from "@/components/facilitator/login-security-section";
import { FacilitatorPauseSection } from "@/components/facilitator/facilitator-dashboard-settings-sections";
import { updateFacilitatorNewsletterPreferenceAction } from "@/app/facilitator/settings/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { getFacilitatorDashboardContext } from "@/lib/facilitator/dashboard-data";

export const dynamic = "force-dynamic";

type FacilitatorSettingsPageProps = {
  searchParams: Promise<{ message?: string }>;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Ikke registreret";
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function sourceLabel(value: string | null | undefined) {
  if (value === "signup") return "Profiloprettelse";
  if (value === "account_settings") return "Kontoindstillinger";
  if (value === "admin") return "Admin";
  if (value === "unsubscribe_link") return "Afmeldingslink";
  if (value === "migration_existing_consent") return "Eksisterende arrangørsamtykke";
  return "Ikke registreret";
}

export default async function FacilitatorSettingsPage({ searchParams }: FacilitatorSettingsPageProps) {
  const { message } = await searchParams;
  const { facilitatorProfile, profile, supabase } = await getFacilitatorDashboardContext();

  if (!facilitatorProfile) {
    redirect("/auth/oauth-profile");
  }

  const [{ data: authUserData, error: authUserError }, { data: pendingEmailChange }, { data: newsletterPreference }, { data: newsletterHistory }] = await Promise.all([
    supabase.auth.admin.getUserById(profile.id),
    supabase
      .from("email_change_requests")
      .select("old_email, new_email, expires_at")
      .eq("profile_id", profile.id)
      .eq("status", "pending")
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("facilitator_newsletter_preferences")
      .select("status, consented_at, consent_source, unsubscribed_at, unsubscribe_source")
      .eq("profile_id", profile.id)
      .maybeSingle(),
    supabase
      .from("facilitator_newsletter_consent_events")
      .select("action, source, created_at")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(5),
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
        <AuthMessage message={message} variant={message ? "success" : "notice"} />
        <LoginSecuritySection
          authProviders={authProviders}
          currentEmail={profile.email}
          pendingEmailChange={pendingEmailChange}
        />
        <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7A5D91]">Nyhedsmails</p>
          <h2 className="mt-1 text-lg font-semibold text-[#2F2437]">Nyt fra SoulEvents</h2>
          <p className="mt-2 text-sm leading-6 text-[#6E6475]">
            Få rolige opdateringer om platformen, nye muligheder og inspiration til dit arrangørarbejde.
            Drifts-, booking- og sikkerhedsmails sendes uanset dette valg.
          </p>
          <div className="mt-4 rounded-[18px] border border-[#D8CBE4] bg-[#F7F2FB] p-4 text-sm leading-6 text-[#4F4756]">
            <p className="font-semibold text-[#2F2437]">
              Status: {newsletterPreference?.status === "subscribed" ? "Tilmeldt" : "Afmeldt"}
            </p>
            <p>
              Dato: {newsletterPreference?.status === "subscribed"
                ? formatDateTime(newsletterPreference.consented_at)
                : formatDateTime(newsletterPreference?.unsubscribed_at)}
            </p>
            <p>
              Kilde: {newsletterPreference?.status === "subscribed"
                ? sourceLabel(newsletterPreference.consent_source)
                : sourceLabel(newsletterPreference?.unsubscribe_source)}
            </p>
          </div>
          <form action={updateFacilitatorNewsletterPreferenceAction} className="mt-4">
            <label className="flex items-start gap-3 rounded-md border border-midnight/10 bg-white p-3 text-sm leading-6 text-[#2F2437]">
              <input
                className="mt-1 size-4 accent-[#7A5D91]"
                defaultChecked={newsletterPreference?.status === "subscribed"}
                name="newsletter_subscribed"
                type="checkbox"
              />
              <span>
                <span className="block font-semibold">Jeg vil gerne modtage nyhedsmails fra SoulEvents</span>
                <span className="mt-1 block text-[#6E6475]">Du kan altid slå dem fra igen her eller via linket i mailen.</span>
              </span>
            </label>
            <button className="mt-3 inline-flex h-10 items-center rounded-md bg-[#2F2437] px-4 text-sm font-semibold text-white" type="submit">
              Gem nyhedsbrevvalg
            </button>
          </form>
          {newsletterHistory?.length ? (
            <div className="mt-5 border-t border-midnight/10 pt-4">
              <p className="text-sm font-semibold text-[#2F2437]">Seneste historik</p>
              <ul className="mt-2 grid gap-2 text-sm text-[#6E6475]">
                {newsletterHistory.map((item) => (
                  <li key={`${item.action}-${item.created_at}`}>
                    {item.action === "subscribed" ? "Tilmeldt" : "Afmeldt"} via {sourceLabel(item.source)} · {formatDateTime(item.created_at)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
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
