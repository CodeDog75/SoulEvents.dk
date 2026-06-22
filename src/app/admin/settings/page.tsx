import Link from "next/link";
import { ArrowLeft, Save, SlidersHorizontal } from "lucide-react";
import { updateEventLimitSettingsAction } from "@/app/admin/settings/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AdminSettingsPageProps = {
  searchParams: Promise<{ message?: string }>;
};

const defaultSettings = {
  max_active_events_per_facilitator: "10",
  max_draft_events_per_facilitator: "5",
};

function settingValue(settings: Record<string, string>, key: keyof typeof defaultSettings) {
  return settings[key] ?? defaultSettings[key];
}

export default async function AdminSettingsPage({ searchParams }: AdminSettingsPageProps) {
  const [{ message }] = await Promise.all([searchParams, requireRole("admin")]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("site_settings")
    .select("key, value")
    .in("key", ["max_draft_events_per_facilitator", "max_active_events_per_facilitator"]);
  const settings = Object.fromEntries((data ?? []).map((item) => [item.key, item.value ?? ""])) as Record<string, string>;

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-sage-700 text-white">
              <SlidersHorizontal className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Administrator</p>
              <h1 className="text-xl font-semibold text-midnight">Platformindstillinger</h1>
            </div>
          </div>
          <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta" href="/admin">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Dashboard
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <AuthMessage message={message} />

        <form action={updateEventLimitSettingsAction} className="mt-5 overflow-hidden rounded-md border border-midnight/10 bg-white shadow-soft">
          <div className="border-b border-midnight/10 bg-[#FAF6EF] px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-sage-700">Eventgrænser</p>
            <h2 className="mt-1 text-lg font-semibold text-midnight">Begræns antal kladder og aktive events</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/64">
              Tallene gælder per arrangør. Kladdegrænsen stopper nye kladder, mens grænsen for aktive events stopper publicering eller godkendelse, når arrangøren har nået loftet.
            </p>
          </div>

          <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Maks. events-kladder per arrangør
              <input
                className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
                defaultValue={settingValue(settings, "max_draft_events_per_facilitator")}
                inputMode="numeric"
                max="100"
                min="1"
                name="max_draft_events_per_facilitator"
                required
                type="number"
              />
              <span className="text-xs leading-5 text-ink/55">Standard: 5 kladder.</span>
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Maks. aktive events per arrangør
              <input
                className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
                defaultValue={settingValue(settings, "max_active_events_per_facilitator")}
                inputMode="numeric"
                max="100"
                min="1"
                name="max_active_events_per_facilitator"
                required
                type="number"
              />
              <span className="text-xs leading-5 text-ink/55">Standard: 10 aktive events.</span>
            </label>
          </div>

          <div className="border-t border-midnight/10 bg-[#FAF6EF] px-5 py-4 sm:px-6">
            <button className="inline-flex h-10 items-center gap-2 rounded-md bg-midnight px-4 text-sm font-semibold text-white transition hover:bg-sage-700" type="submit">
              <Save className="size-4" aria-hidden="true" />
              Gem indstillinger
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
