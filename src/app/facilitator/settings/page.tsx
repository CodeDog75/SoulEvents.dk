import { redirect } from "next/navigation";
import { CookieSettingsButton } from "@/components/cookie-settings-button";
import { LoginSecuritySection } from "@/components/facilitator/login-security-section";
import { FacilitatorPauseSection } from "@/components/facilitator/facilitator-dashboard-settings-sections";
import { getFacilitatorDashboardContext } from "@/lib/facilitator/dashboard-data";

export const dynamic = "force-dynamic";

type AuthProviderIdentity = {
  created_at?: string | null;
  last_sign_in_at?: string | null;
  provider?: string | null;
  updated_at?: string | null;
};

const knownOauthProviders = new Set(["facebook", "google"]);

function isKnownOauthProvider(provider: string | null | undefined) {
  return Boolean(provider && knownOauthProviders.has(provider));
}

function timeDistance(first: string | null | undefined, second: string | null | undefined) {
  if (!first || !second) return Number.POSITIVE_INFINITY;
  const firstTime = new Date(first).getTime();
  const secondTime = new Date(second).getTime();
  if (!Number.isFinite(firstTime) || !Number.isFinite(secondTime)) return Number.POSITIVE_INFINITY;
  return Math.abs(firstTime - secondTime);
}

function resolveCurrentOauthProvider(input: {
  appProvider?: string | null;
  appProviders?: string[] | null;
  identities?: AuthProviderIdentity[] | null;
  lastSignInAt?: string | null;
}) {
  const oauthIdentities = (input.identities ?? []).filter((identity) => isKnownOauthProvider(identity.provider));
  const uniqueOauthProviders = Array.from(new Set(oauthIdentities.map((identity) => identity.provider).filter(Boolean)));

  if (uniqueOauthProviders.length === 1) return uniqueOauthProviders[0] ?? null;

  if (uniqueOauthProviders.length > 1) {
    const rankedIdentities = oauthIdentities
      .map((identity) => ({
        provider: identity.provider,
        distance: Math.min(
          timeDistance(identity.updated_at, input.lastSignInAt),
          timeDistance(identity.last_sign_in_at, input.lastSignInAt),
          timeDistance(identity.created_at, input.lastSignInAt),
        ),
      }))
      .filter((identity): identity is { distance: number; provider: string } => Boolean(identity.provider) && Number.isFinite(identity.distance))
      .sort((firstIdentity, secondIdentity) => firstIdentity.distance - secondIdentity.distance);
    const [bestMatch, nextMatch] = rankedIdentities;
    if (bestMatch && bestMatch.distance <= 5 * 60 * 1000 && bestMatch.distance !== nextMatch?.distance) {
      return bestMatch.provider;
    }
  }

  if (isKnownOauthProvider(input.appProvider)) return input.appProvider ?? null;
  const appOauthProviders = (input.appProviders ?? []).filter(isKnownOauthProvider);
  return appOauthProviders.length === 1 ? appOauthProviders[0] ?? null : null;
}

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
  const passwordLoginAvailable = !authUserError && (authProviders.length === 0 || authProviders.includes("email"));
  const primaryOauthProvider = resolveCurrentOauthProvider({
    appProvider: authUserData.user?.app_metadata?.provider,
    appProviders: authUserData.user?.app_metadata?.providers,
    identities: authUserData.user?.identities,
    lastSignInAt: authUserData.user?.last_sign_in_at,
  });

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
          oauthProvider={primaryOauthProvider}
          passwordLoginAvailable={passwordLoginAvailable}
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
