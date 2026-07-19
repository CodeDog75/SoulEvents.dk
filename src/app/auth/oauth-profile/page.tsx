import { redirect } from "next/navigation";
import { getPostAuthRedirect } from "@/lib/auth/post-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function maskEmail(value: string | null | undefined) {
  if (!value || !value.includes("@")) return "mailadresse mangler";
  const [localPart, domain] = value.split("@");
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${localPart.length > 2 ? "***" : "*"}@${domain}`;
}

function providerLabel(provider: string | null | undefined) {
  if (provider === "email") return "e-mail og adgangskode";
  if (provider === "facebook") return "Facebook";
  if (provider === "google") return "Google";
  if (provider === "apple") return "Apple";
  return "denne loginmetode";
}

async function continueAndCreateProfileAction() {
  "use server";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?message=Log ind igen for at oprette en arrangørprofil.");
  }

  const result = await getPostAuthRedirect({
    createFacilitatorIfMissing: true,
    createProfileIfMissing: true,
    user,
  });

  if (result.type === "disabled") {
    redirect(result.path);
  }

  if (result.type === "redirect") {
    try {
      const admin = createAdminClient();
      await admin.from("admin_audit_log").insert({
        action: "facilitator_profile_creation_started",
        actor_profile_id: result.profile.id,
        reason: "User explicitly chose to create a facilitator profile after login.",
      });
    } catch (auditError) {
      console.warn("[auth:welcome] facilitator creation audit log failed", {
        message: auditError instanceof Error ? auditError.message : "Unknown audit error",
      });
    }
  }

  redirect("/facilitator/welcome");
}

async function signOutToLoginAction() {
  "use server";

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}

async function continueAsGuestAction() {
  "use server";

  redirect("/");
}

export default async function OAuthProfileNotFoundPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const provider = user.app_metadata?.provider || user.identities?.find((identity) => identity.provider !== "email")?.provider || "email";
  const providerName = providerLabel(provider);

  return (
    <main className="min-h-screen bg-[#fbfaf7] px-4 py-10">
      <section className="mx-auto grid max-w-2xl gap-6 rounded-[28px] border border-[#E5DDEA] bg-white p-6 shadow-soft sm:p-8">
        <div className="grid gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#7A5D91]">Velkommen</p>
          <h1 className="font-serif text-3xl font-semibold leading-tight text-[#2F2437]">Velkommen til SoulEvents</h1>
          <p className="text-sm leading-6 text-[#4B5645]/78">
            Du er nu logget ind med {providerName} som <span className="font-semibold">{maskEmail(user.email)}</span>.
            Vil du oprette en gratis arrangørprofil og begynde at dele events på SoulEvents?
          </p>
        </div>

        <div className="rounded-[20px] border border-[#D8CBE4] bg-[#F7F2FB] p-4 text-sm leading-6 text-[#4E4058]" id="existing-profile-help">
          <p className="font-semibold text-[#2F2437]">Har du allerede en SoulEvents-profil?</p>
          <p className="mt-1">
            Log ind med den oprindelige loginmetode først. Derefter kan du tilknytte Google eller Facebook under
            Login og sikkerhed, så alt bliver samlet på den samme profil.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <form action={continueAndCreateProfileAction}>
            <button
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#2F2437] px-5 text-center text-sm font-semibold text-white transition hover:bg-[#4B5645]"
              type="submit"
            >
              Ja, opret arrangørprofil
            </button>
          </form>
          <form action={continueAsGuestAction}>
            <button
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-[#D8CBE4] bg-white px-5 text-center text-sm font-semibold text-[#7A5D91] transition hover:border-[#7A5D91]"
              type="submit"
            >
              Nej tak, gå til SoulEvents
            </button>
          </form>
          <form action={signOutToLoginAction}>
            <button
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-[#D8CBE4] bg-[#FAF7F2] px-5 text-center text-sm font-semibold text-[#4B5645] transition hover:border-[#7A5D91]"
              type="submit"
            >
              Log ind med en anden konto
            </button>
          </form>
          <a
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-[#D8CBE4] bg-white px-5 text-center text-sm font-semibold text-[#7A5D91] transition hover:border-[#7A5D91]"
            href="#existing-profile-help"
          >
            Jeg har allerede en SoulEvents-profil
          </a>
        </div>
      </section>
    </main>
  );
}
