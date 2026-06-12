import Link from "next/link";
import { AlertTriangle, ArrowLeft, CalendarPlus } from "lucide-react";
import { AuthMessage } from "@/components/auth/auth-message";
import { EventForm } from "@/components/facilitator/events/event-form";
import { EventList } from "@/components/facilitator/events/event-list";
import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type FacilitatorEventsPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function FacilitatorEventsPage({ searchParams }: FacilitatorEventsPageProps) {
  const [{ message }, profile] = await Promise.all([searchParams, requireRole("facilitator")]);
  const supabase = await createClient();

  const [
    { data: facilitatorProfile },
    { data: regions },
    { data: categories },
    { data: mainCategories },
    { data: subcategories },
    { data: tags },
  ] = await Promise.all([
    supabase
      .from("facilitator_profiles")
      .select(
        "id, status, company_name, short_description, address_line, postal_code, city, region_id, facilitator_categories(category_id), profiles(email, phone)",
      )
      .eq("profile_id", profile.id)
      .single(),
    supabase.from("regions").select("id, name").order("sort_order"),
    supabase.from("categories").select("id, name").eq("is_active", true).order("sort_order"),
  ]);

  const { data: events } = facilitatorProfile
    ? await supabase
        .from("events")
        .select("id, title, status, starts_at, city, price_cents, capacity, event_categories(categories(name))")
        .eq("facilitator_id", facilitatorProfile.id)
        .order("starts_at", { ascending: true })
    : { data: [] };

  const contactProfile = Array.isArray(facilitatorProfile?.profiles)
    ? facilitatorProfile?.profiles[0]
    : facilitatorProfile?.profiles;
  const profileReady =
    Boolean(profile.full_name) &&
    Boolean(facilitatorProfile?.company_name) &&
    Boolean(facilitatorProfile?.short_description && facilitatorProfile.short_description.trim().length >= 20) &&
    Boolean(facilitatorProfile?.postal_code) &&
    Boolean(facilitatorProfile?.city) &&
    Boolean(facilitatorProfile?.facilitator_categories?.length);

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-terracotta text-white">
              <CalendarPlus className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Vært</p>
              <h1 className="text-xl font-semibold text-midnight">Begivenheder</h1>
            </div>
          </div>
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta"
            href="/facilitator"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Tilbage
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <AuthMessage message={message} />

        {!profileReady ? (
          <section className="rounded-md border border-terracotta/25 bg-terracotta/10 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 text-terracotta" aria-hidden="true" />
              <div>
                <h2 className="font-semibold text-midnight">Din profil mangler nogle obligatoriske oplysninger</h2>
                <p className="mt-1 text-sm leading-6 text-ink/65">
                  For at kunne oprette og offentliggøre events skal du først færdiggøre din profil.
                </p>
                <Link
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-button bg-olive px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-500"
                  href="/facilitator/profile"
                >
                  Færdiggør profil
                </Link>
              </div>
            </div>
          </section>
        ) : facilitatorProfile?.status !== "approved" ? (
          <section className="rounded-md border border-terracotta/25 bg-terracotta/10 p-5">
            <h2 className="font-semibold text-midnight">Profilen afventer godkendelse</h2>
            <p className="mt-1 text-sm leading-6 text-ink/65">
              Du kan oprette events som kladder, men de bør først sættes aktive, når administrator har godkendt profilen.
            </p>
          </section>
        ) : null}

        <EventList events={(events ?? []) as never} />

        {facilitatorProfile && profileReady && (
          <EventForm
            categories={categories ?? []}
            mainCategories={mainCategories ?? []}
            subcategories={subcategories ?? []}
            tags={tags ?? []}
            facilitator={{
              contactEmail: contactProfile?.email ?? profile.email,
              contactPhone: contactProfile?.phone ?? profile.phone,
              regionId: facilitatorProfile.region_id,
              addressLine: facilitatorProfile.address_line,
              postalCode: facilitatorProfile.postal_code,
              city: facilitatorProfile.city,
            }}
            regions={regions ?? []}
          />
        )}
      </section>
    </main>
  );
}
