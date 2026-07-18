import { Mail } from "lucide-react";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireProfile } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function FacilitatorDeactivatedPage() {
  const profile = await requireProfile({ allowDisabledFacilitator: true });

  if (profile.role !== "facilitator") {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  const { data: facilitator } = await admin
    .from("facilitator_profiles")
    .select("is_disabled")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!facilitator?.is_disabled) {
    redirect("/facilitator");
  }

  return (
    <main className="min-h-screen bg-[#fbfaf7] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-2xl items-center">
        <div className="w-full rounded-[28px] border border-midnight/10 bg-white p-6 text-center shadow-soft sm:p-8">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-[#F4F0F7] text-[#6E5A86]">
            <Mail className="size-5" aria-hidden="true" />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-sage-700">Arrangørprofil</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight text-midnight sm:text-4xl">
            Din arrangørprofil er deaktiveret
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-ink/70">
            Din arrangørprofil er ikke længere tilgængelig. Kontakt SoulEvents, hvis du mener, at der er sket en fejl.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              className="inline-flex h-11 items-center justify-center rounded-full bg-sage-700 px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-800"
              href="mailto:hej@soulevents.dk"
            >
              Kontakt SoulEvents
            </a>
            <SignOutButton />
          </div>
        </div>
      </section>
    </main>
  );
}
