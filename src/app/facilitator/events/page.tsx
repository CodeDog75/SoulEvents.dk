import Link from "next/link";
import { AlertTriangle, ArrowLeft, CalendarPlus, CheckCircle2 } from "lucide-react";
import { AuthMessage } from "@/components/auth/auth-message";
import { EventForm } from "@/components/facilitator/events/event-form";
import { requireRole } from "@/lib/auth/roles";
import { activeLimitMessage, draftLimitMessage, getFacilitatorEventLimitStatus } from "@/lib/events/event-limits";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type CategoryRelationRow = { category_id: string };
type MainCategoryRelationRow = { main_category_id: string };
type SubcategoryRelationRow = { subcategory_id: string };
type MainCategoryRow = { color_hex?: string | null; id: string; image_path?: string | null; name: string };
type SubcategoryRow = {
  id: string;
  name: string;
  subcategory_main_categories?: MainCategoryRelationRow[] | null;
};

function isEventImageMessage(message?: string) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return normalized.includes("billedet") || normalized.includes("eventbillede") || normalized.includes("forsidebillede");
}

type FacilitatorEventsPageProps = {
  searchParams: Promise<{
    draft?: string;
    event?: string;
    message?: string;
    step?: string;
    receipt?: "published" | "review";
  }>;
};

export default async function FacilitatorEventsPage({ searchParams }: FacilitatorEventsPageProps) {
  const [{ draft, event, message, step, receipt }, profile] = await Promise.all([searchParams, requireRole("facilitator")]);
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
    supabase.from("regions").select("id, name, slug").order("sort_order"),
    supabase.from("categories").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("main_categories").select("id, name, color_hex, image_path").eq("is_active", true).order("sort_order"),
    supabase
      .from("subcategories")
      .select("id, name, subcategory_main_categories(main_category_id)")
      .eq("is_active", true)
      .order("sort_order"),
    supabase.from("tags").select("id, name").eq("is_active", true).order("sort_order"),
  ]);


  const { data: selectedDraft } =
    draft && facilitatorProfile
      ? await supabase
          .from("events")
          .select("*, event_categories(category_id), event_main_categories(main_category_id), event_subcategories(subcategory_id), event_tags(tag_id), event_images(image_path, alt_text, sort_order)")
          .eq("id", draft)
          .eq("facilitator_id", facilitatorProfile.id)
          .in("status", ["draft", "active", "pending_review"])
          .maybeSingle()
      : { data: null };
  const limitStatus = facilitatorProfile
    ? await getFacilitatorEventLimitStatus(supabase, facilitatorProfile.id, { excludeEventId: selectedDraft?.id ?? null })
    : null;
  const hasReachedDraftLimit = !selectedDraft && Boolean(limitStatus && limitStatus.draftCount >= limitStatus.maxDraftEvents);
  const hasReachedActiveLimit = Boolean(limitStatus && limitStatus.activeCount >= limitStatus.maxActiveEvents);

  const contactProfile = Array.isArray(facilitatorProfile?.profiles)
    ? facilitatorProfile?.profiles[0]
    : facilitatorProfile?.profiles;
  const initialStep = Math.min(Math.max(Number(step ?? "0") || 0, 0), 4);
  const draftMessage = message && message.toLowerCase().includes("kladde") ? message : undefined;
  const profileReady =
    Boolean(profile.full_name) &&
    Boolean(facilitatorProfile?.company_name) &&
    Boolean(facilitatorProfile?.short_description && facilitatorProfile.short_description.trim().length >= 20) &&
    Boolean(facilitatorProfile?.postal_code) &&
    Boolean(facilitatorProfile?.city) &&
    Boolean(facilitatorProfile?.facilitator_categories?.length);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-3 overflow-x-hidden px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-terracotta text-white">
              <CalendarPlus className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Arrangør</p>
              <h1 className="text-lg font-semibold text-midnight sm:text-xl">Opret nyt event</h1>
            </div>
          </div>
          <Link
            className="inline-flex h-9 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-xs font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta sm:h-10 sm:text-sm"
            href="/facilitator"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Tilbage
          </Link>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl gap-5 overflow-x-hidden px-4 py-5 sm:gap-6 sm:px-6 sm:py-8 lg:px-8">
        <AuthMessage message={isEventImageMessage(message) || draftMessage ? undefined : message} />

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

        {receipt ? (
          <section className="rounded-card border border-[#D8CBE4] bg-white p-6 shadow-soft sm:p-8">
            <div className="flex max-w-3xl flex-col gap-5">
              <span className="grid size-12 place-items-center rounded-full bg-[#F4F0F7] text-[#7A5D91]">
                <CheckCircle2 className="size-6" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Kvittering</p>
                <h2 className="mt-2 font-serif text-3xl font-semibold text-midnight">
                  {receipt === "published" ? "Dit event er nu offentliggjort 🌿" : "Dit event er sendt til godkendelse 🌿"}
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-ink/70">
                  {receipt === "published"
                    ? "Dit event er synligt på SoulEvents og kan nu findes af andre deltagere."
                    : "Tak fordi du deler din oplevelse på SoulEvents. Vi gennemgår dit event hurtigst muligt. Når det er godkendt, bliver det synligt for andre brugere på platformen."}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                {receipt === "published" && event ? (
                  <Link className="inline-flex h-11 items-center justify-center rounded-button bg-[#7A5D91] px-5 text-sm font-semibold text-white shadow-soft" href={"/events/" + event}>
                    Se event
                  </Link>
                ) : null}
                <Link className="inline-flex h-11 items-center justify-center rounded-button border border-[#D8CBE4] bg-[#F4F0F7] px-5 text-sm font-semibold text-[#6E5A86]" href="/facilitator">
                  Tilbage til mine events
                </Link>
              </div>
            </div>
          </section>
        ) : hasReachedDraftLimit && limitStatus ? (
          <section className="rounded-card border border-[#D8CBE4] bg-white p-6 shadow-soft">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 text-[#7A5D91]" aria-hidden="true" />
              <div>
                <h2 className="font-semibold text-midnight">Grænsen for kladder er nået</h2>
                <p className="mt-1 text-sm leading-6 text-ink/65">{draftLimitMessage(limitStatus.maxDraftEvents)}</p>
                <Link
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-button bg-olive px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-500"
                  href="/facilitator#kladder"
                >
                  Gå til dine kladder
                </Link>
              </div>
            </div>
          </section>
        ) : facilitatorProfile && profileReady && (
          <EventForm
            activeLimitMessage={hasReachedActiveLimit && limitStatus ? activeLimitMessage(limitStatus.maxActiveEvents) : null}
            initialStep={initialStep}
            message={draftMessage}
            draftEvent={
              selectedDraft
                ? {
                    ...selectedDraft,
                    coverImageUrl: selectedDraft.cover_image_path ? supabase.storage.from("media").getPublicUrl(selectedDraft.cover_image_path).data.publicUrl : null,
                    categoryIds: selectedDraft.event_categories?.map((row: CategoryRelationRow) => row.category_id) ?? [],
                    mainCategoryIds: selectedDraft.event_main_categories?.map((row: MainCategoryRelationRow) => row.main_category_id) ?? [],
                    subcategoryIds: selectedDraft.event_subcategories?.map((row: SubcategoryRelationRow) => row.subcategory_id) ?? [],
                    tagIds: selectedDraft.event_tags?.map((row: { tag_id: string }) => row.tag_id) ?? [],
                  }
                : null
            }
            categories={categories ?? []}
            mainCategories={(mainCategories ?? []).map((category: MainCategoryRow) => ({
              id: category.id,
              name: category.name,
              colorHex: category.color_hex,
              imageUrl: category.image_path ? supabase.storage.from("media").getPublicUrl(category.image_path).data.publicUrl : null,
            }))}
            subcategories={(subcategories ?? []).map((subcategory: SubcategoryRow) => ({
              id: subcategory.id,
              name: subcategory.name,
              mainCategoryIds: (subcategory.subcategory_main_categories ?? []).map((row) => row.main_category_id),
            }))}
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
