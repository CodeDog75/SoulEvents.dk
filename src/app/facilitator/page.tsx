import { AlertTriangle, ArrowRight, CalendarPlus, CheckCircle2, CircleUserRound, Clock3, Inbox } from "lucide-react";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AuthMessage } from "@/components/auth/auth-message";
import { EventList } from "@/components/facilitator/events/event-list";
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

type CategoryRelation = {
  categories?: { name: string; color_hex?: string } | { name: string; color_hex?: string }[] | null;
};

type MoodImage = {
  image_path: string;
  alt_text: string | null;
  sort_order: number;
};

export default async function FacilitatorPage({ searchParams }: FacilitatorPageProps) {
  const [{ message }, profile] = await Promise.all([searchParams, requireRole("facilitator")]);
  const supabase = createAdminClient();
  const { data: facilitatorProfile } = await supabase
    .from("facilitator_profiles")
    .select(
      "id, status, host_reference_id, company_name, profile_image_path, address_line, city, postal_code, short_description, facilitator_categories(category_id, categories(name, color_hex)), facilitator_tags(tag_id), facilitator_images(image_path, alt_text, sort_order)",
    )
    .eq("profile_id", profile.id)
    .single();

  const status = facilitatorProfile?.status ?? "pending";
  const hostReferenceId = facilitatorProfile?.host_reference_id ?? null;
  const hasTopics =
    Boolean(facilitatorProfile?.facilitator_categories?.length) ||
    Boolean(facilitatorProfile?.facilitator_tags?.length);
  const profileReady =
    Boolean(profile.full_name) &&
    Boolean(facilitatorProfile?.company_name) &&
    Boolean(facilitatorProfile?.short_description && facilitatorProfile.short_description.trim().length >= 20) &&
    Boolean(facilitatorProfile?.postal_code) &&
    Boolean(facilitatorProfile?.city) &&
    hasTopics;
  const profileImageUrl = facilitatorProfile?.profile_image_path
    ? supabase.storage.from("media").getPublicUrl(facilitatorProfile.profile_image_path).data.publicUrl
    : null;
  const profileName = facilitatorProfile?.company_name || profile.full_name || "Personlig profil";
  const categoryNames =
    facilitatorProfile?.facilitator_categories
      ?.map((row: CategoryRelation) => (Array.isArray(row.categories) ? row.categories[0] : row.categories))
      .filter((category): category is { name: string; color_hex?: string } => Boolean(category)) ?? [];
  const { data: events } = facilitatorProfile
    ? await supabase
        .from("events")
        .select("id, title, status, starts_at, city, price_cents, capacity, event_reference_id, event_categories(categories(name))")
        .eq("facilitator_id", facilitatorProfile.id)
        .order("updated_at", { ascending: false })
    : { data: [] };

  const moodImages =
    facilitatorProfile?.facilitator_images
      ?.slice()
      .sort((a: MoodImage, b: MoodImage) => a.sort_order - b.sort_order)
      .map((image: MoodImage) => ({
        altText: image.alt_text,
        imagePath: image.image_path,
        url: supabase.storage.from("media").getPublicUrl(image.image_path).data.publicUrl,
      })) ?? [];

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Arrangør</p>
            <h1 className="text-xl font-semibold text-midnight">Velkommen, {profile.full_name}</h1>
            {hostReferenceId ? (
              <p className="mt-1 text-sm font-semibold text-ink/55">Medlemsnummer {hostReferenceId}</p>
            ) : null}
          </div>
          <SignOutButton />
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-5">
          <AuthMessage message={message} />
        </div>

        <section className="rounded-md border border-midnight/10 bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-terracotta">Profilstatus</p>
              <h2 className="mt-2 text-2xl font-semibold text-midnight">
                {status === "approved" ? "Din profil er godkendt" : profileReady ? "Din profil er sendt til godkendelse" : "Profilgodkendelse"}
              </h2>

              {!profileReady ? (
                <div className="mt-4 rounded-card border border-red-300 bg-red-100 p-5 text-sm leading-6 text-red-950 shadow-soft">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-700" aria-hidden="true" />
                    <div>
                      <h3 className="font-semibold">Din profil mangler nogle obligatoriske oplysninger</h3>
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
                <div className="mt-4 rounded-card border border-sage-700/25 bg-sage-50 p-5 text-sm leading-6 text-ink/70 shadow-soft">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-sage-700" aria-hidden="true" />
                    <div>
                      <h3 className="font-semibold text-midnight">Du er klar som arrangør på SoulEvents.dk</h3>
                      <p className="mt-2">Din profil er godkendt, og du kan oprette og administrere events.</p>
                      {hostReferenceId ? (
                        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink/55">
                          Medlemsnummer {hostReferenceId}
                        </p>
                      ) : null}
                      <Link
                        className="mt-4 inline-flex h-11 items-center gap-2 rounded-button bg-olive px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-500"
                        href="/facilitator/events"
                      >
                        Opret nyt event
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-card border border-sage-700/25 bg-sage-50 p-5 text-sm leading-6 text-ink/70 shadow-soft">
                  <div className="flex items-start gap-3">
                    <Clock3 className="mt-0.5 size-5 shrink-0 text-sage-700" aria-hidden="true" />
                    <div>
                      <h3 className="font-semibold text-midnight">Din profil er klar og sendt til godkendelse</h3>
                      <p className="mt-2">
                        Tak. Du har udfyldt de obligatoriske oplysninger, og profilen afventer nu godkendelse fra
                        SoulEvents.dk.
                      </p>
                      <p className="mt-2">
                        Du kan stadig rette din profil eller oprette events, mens vi gennemgår den.
                      </p>
                      {hostReferenceId ? (
                        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink/55">
                          Medlemsnummer {hostReferenceId}
                        </p>
                      ) : null}
                      <Link
                        className="mt-4 inline-flex h-11 items-center gap-2 rounded-button bg-olive px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-500"
                        href="/facilitator/events"
                      >
                        Opret nyt event
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    </div>
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
              introText="Dette er en forhåndsvisning af, hvordan deltagere vil se dig på SoulEvents.dk og på dine events."
              moodImages={moodImages}
              profileImageUrl={profileImageUrl}
              profileName={profileName}
              title="Sådan præsenteres du på dine events"
              shortDescription={facilitatorProfile?.short_description}
            />
          </div>
        </section>
        <section className="mt-6 grid gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Mine events</p>
              <h2 className="mt-1 text-2xl font-semibold text-midnight">Dit overblik</h2>
            </div>
            <Link
              className="inline-flex h-11 items-center justify-center gap-2 rounded-button bg-[#7A4EAB] px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-[#6A3D98]"
              href="/facilitator/events"
            >
              <CalendarPlus className="size-4" aria-hidden="true" />
              Opret nyt event
            </Link>
          </div>
          <EventList events={(events ?? []) as never} />
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
              Opret nyt event og administrer priser og kapacitet.
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
