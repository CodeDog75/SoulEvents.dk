/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleUserRound } from "lucide-react";
import { sendFacilitatorProfileToReviewAction } from "@/app/facilitator/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { ProfileForm } from "@/components/facilitator/profile-form";
import { requireProfile } from "@/lib/auth/roles";
import { resolveNameParts } from "@/lib/auth/names";
import { getBrandLogoSources, type LogoSettingClient } from "@/lib/brand-logo";
import { mapDesignSymbolRow } from "@/lib/design-symbols";
import { normalizeFacilitatorMoodImageSlots } from "@/lib/facilitators/mood-image-slots";
import { getFacilitatorOnboardingState } from "@/lib/facilitators/onboarding-state";
import { parseProfileChangeRequest } from "@/lib/facilitators/profile-change-request";
import { facilitatorWorkAreaSlugs } from "@/lib/facilitators/work-areas";
import { publicMediaUrl } from "@/lib/media/public-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type FacilitatorProfilePageProps = {
  searchParams: Promise<{
    errorSection?: string;
    message?: string;
    ready?: string;
    saved?: string;
  }>;
};

export default async function FacilitatorProfilePage({ searchParams }: FacilitatorProfilePageProps) {
  const [{ errorSection, message, ready, saved }, profile] = await Promise.all([searchParams, requireProfile()]);
  const supabase = await createClient();
  const admin = createAdminClient();
  const isSavedMessage = message?.startsWith("Ændringer gemt");

  const [
    { data: facilitatorProfile },
    { data: regions },
    { data: categories },
    { data: categoryRows },
    { count: publishedEventCount },
    { data: authUserData },
    logoSources,
  ] = await Promise.all([
    supabase.from("facilitator_profiles").select("*").eq("profile_id", profile.id).single(),
    supabase.from("regions").select("id, name, slug").order("sort_order"),
    supabase.from("categories").select("id, name, slug, description").in("slug", facilitatorWorkAreaSlugs).eq("is_active", true).order("sort_order"),
    supabase
      .from("facilitator_profiles")
      .select("id, facilitator_categories(category_id), facilitator_images(image_path, alt_text, sort_order)")
      .eq("profile_id", profile.id)
      .single(),
    supabase
      .from("events")
      .select("id, facilitator_profiles!inner(profile_id)", { count: "exact", head: true })
      .eq("facilitator_profiles.profile_id", profile.id)
      .in("status", ["active", "sold_out", "completed", "cancelled"]),
    admin.auth.admin.getUserById(profile.id),
    getBrandLogoSources(supabase as unknown as LogoSettingClient),
  ]);

  const selectedCategoryIds =
    categoryRows?.facilitator_categories?.map((row: { category_id: string }) => row.category_id) ?? [];
  const galleryImages = normalizeFacilitatorMoodImageSlots(
    categoryRows?.facilitator_images as Array<{ alt_text: string | null; image_path: string; sort_order: number }> | null | undefined,
  );
  if (!facilitatorProfile) {
    redirect("/auth/oauth-profile");
  }

  const [
    { data: paymentSettings },
    { data: latestChangeRequest },
    { data: designSymbolRows },
    { data: selectedProfileSymbolRows },
  ] = await Promise.all([
    supabase.from("facilitator_payment_settings").select("*").eq("facilitator_id", facilitatorProfile.id).maybeSingle(),
    admin
      .from("admin_audit_log")
      .select("reason")
      .eq("facilitator_id", facilitatorProfile.id)
      .eq("action", "facilitator_changes_requested")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("design_symbols")
      .select("id, name, slug, category, svg_path, original_svg_path, background_color, sort_order, is_active, created_at, updated_at")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    admin
      .from("facilitator_profile_symbols")
      .select("symbol_id, sort_order")
      .eq("facilitator_id", facilitatorProfile.id)
      .order("sort_order", { ascending: true }),
  ]);

  const backHref = profile.role === "admin" ? "/admin" : "/facilitator";
  const hasPublishedEventHistory = (publishedEventCount ?? 0) > 0;
  const eventCtaLabel = hasPublishedEventHistory ? "Opret nyt event" : "Opret dit første event";
  const authMetadata = authUserData.user?.user_metadata ?? {};
  const nameParts = resolveNameParts({
    firstName: typeof authMetadata.first_name === "string" ? authMetadata.first_name : null,
    fullName: profile.full_name,
    lastName: typeof authMetadata.last_name === "string" ? authMetadata.last_name : null,
  });
  const profileForForm = {
    ...profile,
    first_name: nameParts.firstName || null,
    full_name: nameParts.fullName || profile.full_name,
    last_name: nameParts.lastName || null,
  };
  const onboardingState = await getFacilitatorOnboardingState(supabase, {
    categoryIds: selectedCategoryIds,
    companyName: facilitatorProfile.company_name,
    fullName: profile.full_name,
    hasMoodImage: galleryImages.some((image) => Boolean(image?.image_path)),
    hasProfileImage: Boolean(facilitatorProfile.profile_image_path),
    isDisabled: facilitatorProfile.is_disabled,
    longDescription: facilitatorProfile.long_description,
    profileId: profile.id,
    shortDescription: facilitatorProfile.short_description,
    status: facilitatorProfile.status,
  });
  const isSubmittedForReview = onboardingState === "pending_review";
  const presentationMode = onboardingState === "approved" || onboardingState === "changes_requested" ? "editing" : "onboarding";
  const profileChangeRequest = parseProfileChangeRequest(latestChangeRequest?.reason);
  const designSymbols = (designSymbolRows ?? []).map((row) => {
    const symbol = mapDesignSymbolRow(row);
    return {
      ...symbol,
      publicUrl: publicMediaUrl(symbol.optimizedSvgPath),
    };
  });
  const selectedDesignSymbolIds = (selectedProfileSymbolRows ?? []).map((row) => row.symbol_id as string);
  const canSendForReview =
    Boolean(facilitatorProfile.profile_image_path) &&
    Boolean(facilitatorProfile.company_name) &&
    Boolean(profile.full_name) &&
    Boolean(facilitatorProfile.long_description || facilitatorProfile.short_description) &&
    selectedCategoryIds.length > 0;

  if (isSubmittedForReview) {
    return (
      <main className="min-h-screen bg-[#fbfaf7]">
        <header className="border-b border-midnight/10 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-md bg-sage-700 text-white">
                <CheckCircle2 className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Status: Afventer godkendelse</p>
                <h1 className="text-xl font-semibold text-midnight">Din profil er sendt til gennemgang</h1>
              </div>
            </div>
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta"
              href="/facilitator"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Dashboard
            </Link>
          </div>
        </header>

        <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-card border border-sage-700/20 bg-white p-6 shadow-soft sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-sage-700">Afventer SoulEvents</p>
            <h2 className="mt-3 text-2xl font-semibold text-midnight">Vi gennemgår din arrangørprofil.</h2>
            <p className="mt-3 text-sm leading-6 text-ink/70">
              Profilen er låst, mens vi gennemgår den, så indholdet ikke ændrer sig midt i godkendelsen. Du får besked,
              når profilen er godkendt, eller hvis vi har brug for ændringer.
            </p>
            <p className="mt-3 text-sm leading-6 text-ink/70">
              Du kan allerede nu oprette dit første event som kladde. Det kan først offentliggøres, når profilen er godkendt.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex h-11 items-center justify-center gap-2 rounded-button bg-olive px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-500"
                href="/facilitator/events"
              >
                {eventCtaLabel}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                className="inline-flex h-11 items-center justify-center rounded-button border border-midnight/15 bg-white px-5 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta"
                href="/facilitator"
              >
                Gå til dashboard
              </Link>
            </div>
          </div>
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
              <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Arrangør</p>
              <h1 className="text-xl font-semibold text-midnight">Rediger offentlig profil</h1>
              {facilitatorProfile?.host_reference_id && (
                <p className="mt-1 text-sm font-semibold text-ink/55">Arrangør-ID {facilitatorProfile.host_reference_id}</p>
              )}
            </div>
          </div>
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta"
            href={backHref}
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
              Vi gennemgår din profil hurtigst muligt og glæder os til at byde dig velkommen som arrangør.
            </p>
            <p className="mt-2">
              Mens du venter, kan du med fordel {hasPublishedEventHistory ? "oprette et nyt event" : "oprette dit første event"} og gøre det klar til offentliggørelse.
            </p>
            <div className="mt-5">
              <Link
                className="inline-flex h-11 items-center gap-2 rounded-button bg-olive px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-500"
                href="/facilitator/events"
              >
                {eventCtaLabel}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <p className="mt-4 text-sm text-ink/64">
              Når din profil er godkendt, kan dine events vises for brugerne på SoulEvents.dk.
            </p>
          </section>
        ) : null}

        {onboardingState === "changes_requested" ? (
          <section className="mb-5 rounded-[24px] border border-[#E8D6A8] bg-[#FFF8E8] p-5 text-sm leading-6 text-[#6E6475] shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8A6A2E]">Profil kræver ændringer</p>
            <h2 className="mt-2 text-lg font-semibold text-midnight">Ret punkterne og send profilen til ny godkendelse</h2>
            {profileChangeRequest?.fields.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {profileChangeRequest.fields.map((field) => (
                  <span className="rounded-full border border-[#E8D6A8] bg-white/75 px-3 py-1 text-xs font-semibold text-[#6F5A35]" key={field}>
                    {field}
                  </span>
                ))}
              </div>
            ) : null}
            {profileChangeRequest?.comment ? (
              <blockquote className="mt-4 rounded-[18px] border border-[#E8D6A8] bg-white/70 p-4 text-[#4F4537]">
                {profileChangeRequest.comment}
              </blockquote>
            ) : null}
            <form action={sendFacilitatorProfileToReviewAction} className="mt-5">
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-button bg-olive px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-500 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canSendForReview}
                type="submit"
              >
                Send til ny godkendelse
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
              {!canSendForReview ? (
                <p className="mt-2 text-xs font-semibold text-[#8A6A2E]">
                  Udfyld de nødvendige profiloplysninger, før profilen kan sendes igen.
                </p>
              ) : null}
            </form>
          </section>
        ) : null}

        <ProfileForm
          categories={categories ?? []}
          errorSection={errorSection ?? null}
          facilitatorProfile={{
            ...facilitatorProfile,
            payment_mobilepay_number: paymentSettings?.mobilepay_number ?? null,
            payment_bank_registration_number: paymentSettings?.bank_registration_number ?? null,
            payment_bank_account_number: paymentSettings?.bank_account_number ?? null,
            payment_bank_account_name: paymentSettings?.bank_account_name ?? null,
            payment_external_url: paymentSettings?.external_url ?? null,
            payment_instructions: paymentSettings?.instructions ?? null,
            payment_deadline_days: paymentSettings?.deadline_days ?? 14,
          }}
          feedbackMessage={message ?? null}
          galleryImages={galleryImages}
          designSymbols={designSymbols}
          logoSources={logoSources}
          presentationMode={presentationMode}
          profile={profileForForm}
          regions={regions ?? []}
          savedSection={saved ?? null}
          selectedCategoryIds={selectedCategoryIds}
          selectedDesignSymbolIds={selectedDesignSymbolIds}
        />
      </section>
    </main>
  );
}
