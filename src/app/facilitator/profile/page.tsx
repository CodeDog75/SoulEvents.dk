import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleUserRound } from "lucide-react";
import { AuthMessage } from "@/components/auth/auth-message";
import { ProfileForm } from "@/components/facilitator/profile-form";
import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type FacilitatorProfilePageProps = {
  searchParams: Promise<{
    message?: string;
    ready?: string;
  }>;
};

export default async function FacilitatorProfilePage({ searchParams }: FacilitatorProfilePageProps) {
  const [{ message, ready }, profile] = await Promise.all([searchParams, requireRole("facilitator")]);
  const supabase = await createClient();
  const isSavedMessage = message?.startsWith("Ændringer gemt");

  const [
    { data: facilitatorProfile },
    { data: regions },
    { data: categories },
    { data: categoryRows },
  ] = await Promise.all([
    supabase.from("facilitator_profiles").select("*").eq("profile_id", profile.id).single(),
    supabase.from("regions").select("id, name").order("sort_order"),
    supabase.from("categories").select("id, name").eq("is_active", true).order("sort_order"),
    supabase
      .from("facilitator_profiles")
      .select("id, facilitator_categories(category_id), facilitator_images(image_path, alt_text, sort_order)")
      .eq("profile_id", profile.id)
      .single(),
  ]);

  const selectedCategoryIds =
    categoryRows?.facilitator_categories?.map((row: { category_id: string }) => row.category_id) ?? [];
  const galleryImages =
    categoryRows?.facilitator_images?.sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order,
    ) ?? [];

  if (!facilitatorProfile) {
    return (
      <main className="min-h-screen bg-[#fbfaf7] px-4 py-10">
        <section className="mx-auto max-w-3xl rounded-md border border-midnight/10 bg-white p-6 shadow-soft">
          <h1 className="text-xl font-semibold text-midnight">Facilitatorprofil mangler</h1>
          <p className="mt-2 text-sm leading-6 text-ink/65">
            Der blev ikke fundet en facilitatorprofil til din konto. Prøv at oprette profilen igen.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-sage-700 text-white">
              <CircleUserRound className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Facilitator</p>
              <h1 className="text-xl font-semibold text-midnight">Rediger offentlig profil</h1>
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

      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-5">
          <AuthMessage message={message} variant={isSavedMessage ? "success" : "notice"} />
        </div>

        {ready === "1" ? (
          <section className="mb-5 rounded-md border border-sage-700/25 bg-sage-50 p-5 text-sm leading-6 text-ink/72 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wide text-sage-700">Status: Afventer godkendelse</p>
            <h2 className="mt-2 text-lg font-semibold text-midnight">🌿 Din profil er nu klar til gennemgang</h2>
            <p className="mt-2">
              Tak for dine oplysninger. Din profil indeholder nu de nødvendige informationer for at kunne blive en del
              af SoulEvents.
            </p>
            <p className="mt-2">
              Vi gennemgår din profil hurtigst muligt og glæder os til at byde dig velkommen som facilitator.
            </p>
            <p className="mt-2">
              Mens du venter, kan du med fordel oprette dit første event og gøre det klar til offentliggørelse.
            </p>
            <div className="mt-5">
              <Link
                className="inline-flex h-11 items-center gap-2 rounded-button bg-olive px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-500"
                href="/facilitator/events"
              >
                Opret dit første event
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <p className="mt-4 text-sm text-ink/64">
              Når din profil er godkendt, kan dine events vises for brugerne på SoulEvents.dk.
            </p>
          </section>
        ) : null}

        <ProfileForm
          categories={categories ?? []}
          facilitatorProfile={facilitatorProfile}
          galleryImages={galleryImages}
          profile={profile}
          regions={regions ?? []}
          selectedCategoryIds={selectedCategoryIds}
        />
      </section>
    </main>
  );
}
