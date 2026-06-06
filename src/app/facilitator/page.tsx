import { AlertTriangle, ArrowRight, CalendarPlus, CircleUserRound, Inbox } from "lucide-react";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AuthMessage } from "@/components/auth/auth-message";
import { FacilitatorProfilePreview } from "@/components/facilitator/facilitator-profile-preview";
import { requireRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type FacilitatorPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function FacilitatorPage({ searchParams }: FacilitatorPageProps) {
  const [{ message }, profile] = await Promise.all([searchParams, requireRole("facilitator")]);
  const supabase = createAdminClient();
  const { data: facilitatorProfile } = await supabase
    .from("facilitator_profiles")
    .select(
      "status, company_name, profile_image_path, address_line, city, postal_code, short_description, facilitator_categories(category_id, categories(name, color_hex)), facilitator_images(image_path, alt_text, sort_order)",
    )
    .eq("profile_id", profile.id)
    .single();

  const status = facilitatorProfile?.status ?? "pending";
  const profileReady =
    Boolean(profile.full_name) &&
    Boolean(facilitatorProfile?.company_name) &&
    Boolean(facilitatorProfile?.short_description && facilitatorProfile.short_description.trim().length >= 20) &&
    Boolean(facilitatorProfile?.postal_code) &&
    Boolean(facilitatorProfile?.city) &&
    Boolean(facilitatorProfile?.facilitator_categories?.length);
  const profileImageUrl = facilitatorProfile?.profile_image_path
    ? supabase.storage.from("media").getPublicUrl(facilitatorProfile.profile_image_path).data.publicUrl
    : null;
  const profileName = facilitatorProfile?.company_name || profile.full_name || "Personlig profil";
  const categoryNames =
    facilitatorProfile?.facilitator_categories
      ?.map((row: { categories?: { name: string; color_hex?: string } | { name: string; color_hex?: string }[] | null }) =>
        Array.isArray(row.categories) ? row.categories[0] : row.categories,
      )
      .filter((category): category is { name: string; color_hex?: string } => Boolean(category)) ?? [];
  const moodImages =
    facilitatorProfile?.facilitator_images
      ?.slice()
      .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
      .map((image: { image_path: string; alt_text: string | null }) => ({
        altText: image.alt_text,
        imagePath: image.image_path,
        url: supabase.storage.from("media").getPublicUrl(image.image_path).data.publicUrl,
      })) ?? [];

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Facilitator</p>
            <h1 className="text-xl font-semibold text-midnight">Velkommen, {profile.full_name}</h1>
          </div>
          <SignOutButton />
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-5">
          <AuthMessage message={message} />
        </div>

        <section className="rounded-md border border-midnight/10 bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-terracotta">Profilstatus</p>
              <h2 className="mt-2 text-2xl font-semibold text-midnight">
                {status === "approved" ? "Godkendt" : "Profilgodkendelse"}
              </h2>
              {!profileReady ? (
                <div className="mt-2 max-w-3xl rounded-card border border-terracotta/25 bg-terracotta/10 p-4 text-sm leading-6 text-ink/70">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 size-5 text-terracotta" aria-hidden="true" />
                    <div>
                      <h3 className="font-semibold text-midnight">Din profil mangler nogle obligatoriske oplysninger</h3>
                      <p className="mt-2">
                        For at kunne oprette og offentliggøre events skal du først færdiggøre din profil.
                      </p>
                      <Link
                        className="mt-4 inline-flex h-11 items-center gap-2 rounded-button bg-olive px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-500"
                        href="/facilitator/profile"
                      >
                        Færdiggør profil
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </div>
              ) : status === "approved" ? (
                <div className="mt-2 max-w-3xl rounded-card bg-sage-50 p-4 text-sm leading-6 text-ink/70">
                  <h3 className="font-semibold text-midnight">🌿 Din profil er klar</h3>
                  <p className="mt-2">Du kan nu oprette dit første event.</p>
                  <Link
                    className="mt-4 inline-flex h-11 items-center gap-2 rounded-button bg-olive px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-500"
                    href="/facilitator/events"
                  >
                    Opret dit første event
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              ) : (
                <div className="mt-2 max-w-3xl space-y-3 text-sm leading-6 text-ink/65">
                  <p>En administrator skal godkende din profil, før den vises på SoulEvents.dk.</p>
                  <p>
                    Jo mere udfyldt din profil er, desto hurtigere kan vi behandle den. Det hjælper os med at
                    skabe et trygt og inspirerende fællesskab af facilitatorer og events for krop, sind og sjæl.
                  </p>
                  <div className="rounded-card bg-sage-50 p-4">
                    <h3 className="font-semibold text-midnight">🌿 Din profil er klar</h3>
                    <p className="mt-2">
                      Du kan nu oprette dit første event, mens vi gennemgår din profil.
                    </p>
                    <Link
                      className="mt-4 inline-flex h-11 items-center gap-2 rounded-button bg-olive px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-500"
                      href="/facilitator/events"
                    >
                      Opret dit første event
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
            <FacilitatorProfilePreview
              categories={categoryNames.map((category) => ({
                colorHex: category.color_hex,
                name: category.name,
              }))}
              city={facilitatorProfile?.city}
              introText="Dette er en forhåndsvisning af, hvordan deltagere vil se dig på SoulEvents og på dine events."
              moodImages={moodImages}
              profileImageUrl={profileImageUrl}
              profileName={profileName}
              title="Sådan præsenteres du på dine events"
              shortDescription={facilitatorProfile?.short_description}
            />
          </div>
        </section>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Link
            className="relative rounded-md border-2 border-sage-700 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
            href="/facilitator/profile"
          >
            <span className="absolute right-4 top-4 rounded-full bg-sage-50 px-3 py-1 text-xs font-semibold text-sage-700">
              Start her
            </span>
            <CircleUserRound className="size-9 text-sage-700" aria-hidden="true" />
            <h3 className="mt-4 font-semibold text-midnight">Profil</h3>
            <p className="mt-2 text-sm leading-6 text-ink/64">
              Rediger offentlig profil, lokation, billeder og kategorier.
            </p>
          </Link>
          <Link
            className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft transition hover:border-terracotta"
            href="/facilitator/events"
          >
            <CalendarPlus className="size-9 text-terracotta" aria-hidden="true" />
            <h3 className="mt-4 font-semibold text-midnight">Event</h3>
            <p className="mt-2 text-sm leading-6 text-ink/64">
              Opret dit første event og administrer priser og kapacitet.
            </p>
          </Link>
          <Link
            className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft transition hover:border-midnight"
            href="/facilitator/bookings"
          >
            <Inbox className="size-9 text-midnight" aria-hidden="true" />
            <h3 className="mt-4 font-semibold text-midnight">Tilmeldinger</h3>
            <p className="mt-2 text-sm leading-6 text-ink/64">Bekræft, markér udsolgt eller aflys tilmeldinger.</p>
          </Link>
        </div>
      </section>
    </main>
  );
}
