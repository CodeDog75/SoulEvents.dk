import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { AuthMessage } from "@/components/auth/auth-message";
import { EventForm } from "@/components/facilitator/events/event-form";
import { requireRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AdminEventEditPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; returnTo?: string; step?: string }>;
};

type CategoryRelationRow = { category_id: string };
type MainCategoryRelationRow = { main_category_id: string };
type SubcategoryRelationRow = { subcategory_id: string };
type MainCategoryRow = { color_hex?: string | null; id: string; image_path?: string | null; name: string };
type SubcategoryRow = {
  id: string;
  name: string;
  subcategory_main_categories?: MainCategoryRelationRow[] | null;
};
type BookingRelationRow = { status?: string | null };
type CoOrganizerInvitationRow = {
  co_organizer_profile_id: string;
  id: string;
  status: "accepted" | "declined" | "pending";
  facilitator_profiles?:
    | {
        city?: string | null;
        company_name?: string | null;
        facilitator_categories?: Array<{ categories?: { name?: string | null } | { name?: string | null }[] | null }> | null;
        is_disabled?: boolean | null;
        is_paused?: boolean | null;
        profile_image_path?: string | null;
        profiles?: { full_name?: string | null } | { full_name?: string | null }[] | null;
        status?: string | null;
      }
    | Array<{
        city?: string | null;
        company_name?: string | null;
        facilitator_categories?: Array<{ categories?: { name?: string | null } | { name?: string | null }[] | null }> | null;
        is_disabled?: boolean | null;
        is_paused?: boolean | null;
        profile_image_path?: string | null;
        profiles?: { full_name?: string | null } | { full_name?: string | null }[] | null;
        status?: string | null;
      }>
    | null;
};

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function safeAdminReturnPath(value?: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return "/admin/events";
  }

  return value.startsWith("/admin") ? value : "/admin/events";
}

export default async function AdminEventEditPage({ params, searchParams }: AdminEventEditPageProps) {
  const [{ id }, { message, returnTo, step }] = await Promise.all([params, searchParams, requireRole("admin")]);
  const admin = createAdminClient();
  const returnHref = safeAdminReturnPath(returnTo);
  const initialStep = Math.min(Math.max(Number(step ?? "0") || 0, 0), 4);

  const [
    { data: event },
    { data: regions },
    { data: categories },
    { data: mainCategories },
    { data: subcategories },
    { data: tags },
  ] = await Promise.all([
    admin
      .from("events")
      .select(
        "*, event_categories(category_id), event_main_categories(main_category_id), event_subcategories(subcategory_id), event_tags(tag_id), event_images(image_path, alt_text, sort_order), bookings(status), facilitator_profiles!events_facilitator_id_fkey(id, profile_id, host_reference_id, company_name, address_line, postal_code, city, region_id, max_ticket_price_per_person, profiles!facilitator_profiles_profile_id_fkey(full_name, email, phone))",
      )
      .eq("id", id)
      .maybeSingle(),
    admin.from("regions").select("id, name, slug").order("sort_order"),
    admin.from("categories").select("id, name").eq("is_active", true).order("sort_order"),
    admin.from("main_categories").select("id, name, color_hex, image_path").eq("is_active", true).order("sort_order"),
    admin
      .from("subcategories")
      .select("id, name, subcategory_main_categories(main_category_id)")
      .eq("is_active", true)
      .order("sort_order"),
    admin.from("tags").select("id, name").eq("is_active", true).order("sort_order"),
  ]);

  if (!event) {
    notFound();
  }

  const facilitatorProfile = first(event.facilitator_profiles);
  const ownerProfile = first(facilitatorProfile?.profiles);

  if (!facilitatorProfile) {
    notFound();
  }

  const [{ data: facilitatorPaymentSettings }, { data: selectedDraftPaymentSettings }, { data: coOrganizerInvitations }] =
    await Promise.all([
      admin
        .from("facilitator_payment_settings")
        .select("*")
        .eq("facilitator_id", facilitatorProfile.id)
        .maybeSingle(),
      admin
        .from("event_payment_settings")
        .select("*")
        .eq("event_id", event.id)
        .eq("facilitator_id", facilitatorProfile.id)
        .maybeSingle(),
      admin
        .from("event_co_organizers")
        .select(
          "id, status, co_organizer_profile_id, facilitator_profiles!event_co_organizers_co_organizer_profile_id_fkey(city, company_name, status, is_paused, is_disabled, profile_image_path, profiles!facilitator_profiles_profile_id_fkey(full_name), facilitator_categories(categories(name)))",
        )
        .eq("event_id", event.id)
        .eq("primary_organizer_profile_id", facilitatorProfile.id)
        .in("status", ["pending", "accepted", "declined"]),
    ]);

  const ownerName = facilitatorProfile.company_name || ownerProfile?.full_name || "Arrangør";

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-3 overflow-x-hidden px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-[#7A5D91] text-white">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Administrator</p>
              <h1 className="text-lg font-semibold text-midnight sm:text-xl">Rediger event</h1>
            </div>
          </div>
          <Link
            className="inline-flex h-9 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-xs font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta sm:h-10 sm:text-sm"
            href={returnHref}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Tilbage til admin
          </Link>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl gap-5 overflow-x-hidden px-4 py-5 sm:gap-6 sm:px-6 sm:py-8 lg:px-8">
        <AuthMessage message={message} />
        <EventForm
          key={event.id}
          adminContext={{
            eventOwnerName: ownerName,
            facilitatorId: facilitatorProfile.id,
            returnHref,
            soulEventsId: facilitatorProfile.host_reference_id ?? null,
          }}
          categories={categories ?? []}
          draftEvent={{
            ...event,
            activeBookingCount:
              event.bookings?.filter((booking: BookingRelationRow) =>
                ["pending", "confirmed"].includes(booking.status ?? ""),
              ).length ?? 0,
            categoryIds: event.event_categories?.map((row: CategoryRelationRow) => row.category_id) ?? [],
            coverImageUrl: event.cover_image_path ? admin.storage.from("media").getPublicUrl(event.cover_image_path).data.publicUrl : null,
            eventImages:
              event.event_images
                ?.slice()
                .sort((a: { sort_order: number | null }, b: { sort_order: number | null }) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                .map((image: { alt_text: string | null; image_path: string; sort_order: number | null }) => ({
                  altText: image.alt_text ?? null,
                  imagePath: image.image_path,
                  imageUrl: image.image_path ? admin.storage.from("media").getPublicUrl(image.image_path).data.publicUrl : null,
                  sortOrder: image.sort_order ?? 0,
                })) ?? [],
            mainCategoryIds: event.event_main_categories?.map((row: MainCategoryRelationRow) => row.main_category_id) ?? [],
            payment_bank_account_name: selectedDraftPaymentSettings?.bank_account_name ?? null,
            payment_bank_account_number: selectedDraftPaymentSettings?.bank_account_number ?? null,
            payment_bank_registration_number: selectedDraftPaymentSettings?.bank_registration_number ?? null,
            payment_deadline_days: selectedDraftPaymentSettings?.deadline_days ?? null,
            payment_external_url: selectedDraftPaymentSettings?.external_url ?? null,
            payment_instructions: selectedDraftPaymentSettings?.instructions ?? null,
            payment_link_mode: selectedDraftPaymentSettings?.payment_link_mode ?? null,
            payment_method_source: selectedDraftPaymentSettings?.method_source ?? "facilitator",
            payment_mobilepay_number: selectedDraftPaymentSettings?.mobilepay_number ?? null,
            subcategoryIds: event.event_subcategories?.map((row: SubcategoryRelationRow) => row.subcategory_id) ?? [],
            tagIds: event.event_tags?.map((row: { tag_id: string }) => row.tag_id) ?? [],
            coOrganizerInvitations: ((coOrganizerInvitations ?? []) as CoOrganizerInvitationRow[]).map((invitation) => {
              const coOrganizerProfile = first(invitation.facilitator_profiles);
              const coOrganizerUser = first(coOrganizerProfile?.profiles);
              const isProfileActive =
                coOrganizerProfile?.status === "approved" &&
                !coOrganizerProfile.is_paused &&
                !coOrganizerProfile.is_disabled;

              return {
                categories:
                  coOrganizerProfile?.facilitator_categories
                    ?.map((row) => first(row.categories)?.name)
                    .filter((name): name is string => Boolean(name))
                    .slice(0, 3) ?? [],
                city: coOrganizerProfile?.city ?? null,
                id: invitation.id,
                imageUrl: coOrganizerProfile?.profile_image_path
                  ? admin.storage.from("media").getPublicUrl(coOrganizerProfile.profile_image_path).data.publicUrl
                  : null,
                name: coOrganizerProfile?.company_name || coOrganizerUser?.full_name || "Arrangør",
                profileIsActive: Boolean(isProfileActive),
                profileId: invitation.co_organizer_profile_id,
                status: invitation.status,
              };
            }),
          }}
          facilitator={{
            addressLine: facilitatorProfile.address_line,
            city: facilitatorProfile.city,
            contactEmail: ownerProfile?.email ?? "",
            contactPhone: ownerProfile?.phone ?? null,
            id: facilitatorProfile.id,
            maxTicketPricePerPerson: facilitatorProfile.max_ticket_price_per_person,
            paymentBankAccountName: facilitatorPaymentSettings?.bank_account_name ?? null,
            paymentBankAccountNumber: facilitatorPaymentSettings?.bank_account_number ?? null,
            paymentBankRegistrationNumber: facilitatorPaymentSettings?.bank_registration_number ?? null,
            paymentDeadlineDays: facilitatorPaymentSettings?.deadline_days ?? 14,
            paymentExternalUrl: facilitatorPaymentSettings?.external_url ?? null,
            paymentInstructions: facilitatorPaymentSettings?.instructions ?? null,
            paymentMobilepayNumber: facilitatorPaymentSettings?.mobilepay_number ?? null,
            postalCode: facilitatorProfile.postal_code,
            regionId: facilitatorProfile.region_id,
          }}
          initialStep={initialStep}
          mainCategories={(mainCategories ?? []).map((category: MainCategoryRow) => ({
            colorHex: category.color_hex,
            id: category.id,
            imageUrl: category.image_path ? admin.storage.from("media").getPublicUrl(category.image_path).data.publicUrl : null,
            name: category.name,
          }))}
          message={message}
          regions={regions ?? []}
          subcategories={(subcategories ?? []).map((subcategory: SubcategoryRow) => ({
            id: subcategory.id,
            mainCategoryIds: (subcategory.subcategory_main_categories ?? []).map((row) => row.main_category_id),
            name: subcategory.name,
          }))}
          tags={tags ?? []}
        />
      </section>
    </main>
  );
}
