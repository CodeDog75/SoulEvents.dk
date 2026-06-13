"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { notifyFacilitatorEventReminderSubscribers } from "@/lib/email/facilitator-new-event-reminder";
import { getAllStrings, getOptionalString, getString } from "@/lib/forms/form-data";
import { geocodeDanishAddress } from "@/lib/mapbox/geocode";
import { inferRegionSlug } from "@/lib/regions/infer-region";
import { createSlug } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import type { EventStatus } from "@/types/database";

const allowedStatuses: EventStatus[] = ["draft", "pending_review", "active", "rejected", "sold_out", "cancelled", "completed", "archived"];
const allowedFormats = ["physical", "online", "hybrid"] as const;

function eventsRedirect(message: string): never {
  redirect(`/facilitator/events?message=${encodeURIComponent(message)}`);
}

function getInteger(formData: FormData, key: string, fallback = 0) {
  const raw = getString(formData, key);
  const numberValue = Number(raw);
  return Number.isInteger(numberValue) ? numberValue : fallback;
}

function getPriceCents(formData: FormData) {
  const raw = getString(formData, "price");
  if (!raw) {
    return 0;
  }

  const numberValue = Number(raw.replace(",", "."));
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    eventsRedirect("Pris skal være 0 eller højere.");
  }

  return Math.round(numberValue * 100);
}

function toDateTime(date: string, time: string) {
  if (!date || !time) {
    return "";
  }

  return new Date(`${date}T${time}:00`).toISOString();
}

function normalizeImageRows(paths: string[], alts: string[]) {
  return paths.slice(0, 3).map((imagePath, index) => ({
    image_path: imagePath,
    alt_text: alts[index] || null,
    sort_order: index + 1,
  }));
}

async function createUniqueEventSlug(supabase: any, baseSlug: string) {
  const cleanBaseSlug = baseSlug || "event";
  let candidate = cleanBaseSlug;

  for (let suffix = 2; suffix < 100; suffix += 1) {
    const { data: existingEvent } = await supabase.from("events").select("id").eq("slug", candidate).maybeSingle();

    if (!existingEvent) {
      return candidate;
    }

    candidate = cleanBaseSlug + "-" + suffix;
  }

  return cleanBaseSlug + "-" + crypto.randomUUID().slice(0, 8);
}

function isProfileReady(input: {
  categoryIds: string[];
  city: string | null;
  companyName: string | null;
  fullName: string | null;
  postalCode: string | null;
  shortDescription: string | null;
}) {
  return (
    Boolean(input.fullName) &&
    Boolean(input.companyName) &&
    Boolean(input.shortDescription && input.shortDescription.trim().length >= 20) &&
    Boolean(input.postalCode) &&
    Boolean(input.city) &&
    input.categoryIds.length > 0
  );
}

export async function createEventAction(formData: FormData) {
  const profile = await requireRole("facilitator");
  const supabase = await createClient();

  const { data: facilitatorProfile } = await supabase
    .from("facilitator_profiles")
    .select("id, status, company_name, city, postal_code, short_description, facilitator_categories(category_id)")
    .eq("profile_id", profile.id)
    .single();

  if (!facilitatorProfile) {
    eventsRedirect("Værtsprofilen mangler.");
  }

  const facilitatorCategoryIds =
    facilitatorProfile.facilitator_categories?.map((row: { category_id: string }) => row.category_id) ?? [];

  if (
    !isProfileReady({
      categoryIds: facilitatorCategoryIds,
      city: facilitatorProfile.city,
      companyName: facilitatorProfile.company_name,
      fullName: profile.full_name,
      postalCode: facilitatorProfile.postal_code,
      shortDescription: facilitatorProfile.short_description,
    })
  ) {
    eventsRedirect("Færdiggør din profil, før du opretter events.");
  }

  const title = getString(formData, "title");
  const slug = createSlug(title);
  const status = getString(formData, "status") as EventStatus;
  const shortDescription = getString(formData, "short_description");
  const longDescription = getString(formData, "long_description");
  const coverImagePath = getOptionalString(formData, "cover_image_path");
  const startsAt = toDateTime(getString(formData, "start_date"), getString(formData, "start_time"));
  const endsAt = toDateTime(getString(formData, "end_date"), getString(formData, "end_time"));
  const addressLine = getOptionalString(formData, "address_line");
  const postalCode = getOptionalString(formData, "postal_code");
  const city = getOptionalString(formData, "city");
  let regionId = getOptionalString(formData, "region_id");
  const priceCents = getPriceCents(formData);
  const capacity = getInteger(formData, "capacity");
  const contactEmail = getOptionalString(formData, "contact_email");
  const contactPhone = getOptionalString(formData, "contact_phone");
  const facebookUrl = getOptionalString(formData, "facebook_url");
  const instagramUrl = getOptionalString(formData, "instagram_url");
  const eventFormat = getString(formData, "event_format") || "physical";
  const onlineDescription = getOptionalString(formData, "online_description");
  const onlineUrlOrNote = getOptionalString(formData, "online_url_or_note");
  const categoryIds = getAllStrings(formData, "category_ids");
  const mainCategoryIds = getAllStrings(formData, "main_category_ids");
  const subcategoryIds = getAllStrings(formData, "subcategory_ids");
  const tagIds = getAllStrings(formData, "tag_ids");
  const imagePaths = getAllStrings(formData, "event_image_paths");
  const imageAlts = getAllStrings(formData, "event_alt_texts");

  if (!title || !slug) {
    eventsRedirect("Titel er påkrævet.");
  }

  if (!allowedStatuses.includes(status)) {
    eventsRedirect("Ugyldig eventstatus.");
  }

  if (!shortDescription || shortDescription.length < 20) {
    eventsRedirect("Kort beskrivelse skal være mindst 20 tegn.");
  }

  if (!longDescription || longDescription.length < 60) {
    eventsRedirect("Lang beskrivelse skal være mindst 60 tegn.");
  }

  if (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt)) {
    eventsRedirect("Sluttidspunkt skal være efter starttidspunkt.");
  }

  if (capacity <= 0) {
    eventsRedirect("Kapacitet skal være mindst 1.");
  }

  if (!regionId) {
    const inferredSlug = inferRegionSlug({ city, postalCode });

    if (inferredSlug) {
      const { data: inferredRegion } = await supabase.from("regions").select("id").eq("slug", inferredSlug).maybeSingle();
      regionId = inferredRegion?.id ?? null;
    }
  }

  const coordinates =
    eventFormat === "online" ? null : await geocodeDanishAddress({ addressLine, postalCode, city });

  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      facilitator_id: facilitatorProfile.id,
      status,
      title,
      slug,
      short_description: shortDescription,
      long_description: longDescription,
      cover_image_path: coverImagePath,
      starts_at: startsAt,
      ends_at: endsAt,
      address_line: addressLine,
      postal_code: postalCode,
      city,
      region_id: regionId,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      price_cents: priceCents,
      capacity,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      facebook_url: facebookUrl,
      instagram_url: instagramUrl,
    })
    .select("id")
    .single();

  if (eventError || !event) {
    eventsRedirect("Eventet kunne ikke oprettes. Prøv igen.");
  }

  if (mainCategoryIds.length > 0) {
    await supabase.from("event_main_categories").insert(
      mainCategoryIds.map((mainCategoryId) => ({
        event_id: event.id,
        main_category_id: mainCategoryId,
      })),
    );
  }

  if (subcategoryIds.length > 0) {
    await supabase.from("event_subcategories").insert(
      subcategoryIds.map((subcategoryId) => ({
        event_id: event.id,
        subcategory_id: subcategoryId,
      })),
    );
  }

  if (tagIds.length > 0) {
    await supabase.from("event_tags").insert(
      tagIds.map((tagId) => ({
        event_id: event.id,
        tag_id: tagId,
      })),
    );
  }

  if (categoryIds.length > 0) {
    const { error: categoryError } = await supabase.from("event_categories").insert(
      categoryIds.map((categoryId) => ({
        event_id: event.id,
        category_id: categoryId,
      })),
    );

    if (categoryError) {
      eventsRedirect("Eventet blev oprettet, men kategorierne kunne ikke gemmes.");
    }
  }

  const imageRows = normalizeImageRows(imagePaths, imageAlts);

  if (imageRows.length > 0) {
    const { error: imageError } = await supabase.from("event_images").insert(
      imageRows.map((row) => ({
        event_id: event.id,
        ...row,
      })),
    );

    if (imageError) {
      eventsRedirect("Eventet blev oprettet, men billederne kunne ikke gemmes.");
    }
  }

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/events");
  eventsRedirect("Eventet er oprettet.");
}

export async function updateEventStatusAction(formData: FormData) {
  const profile = await requireRole("facilitator");
  const eventId = getString(formData, "event_id");
  const status = getString(formData, "status") as EventStatus;

  if (!eventId || !allowedStatuses.includes(status)) {
    eventsRedirect("Ugyldig eventhandling.");
  }

  const supabase = await createClient();
  const { data: facilitatorProfiles } = await supabase
    .from("facilitator_profiles")
    .select("id, company_name, city, postal_code, short_description, facilitator_categories(category_id)")
    .eq("profile_id", profile.id);
  const profileReady = (facilitatorProfiles ?? []).some((facilitatorProfile) => {
    const categoryIds =
      facilitatorProfile.facilitator_categories?.map((row: { category_id: string }) => row.category_id) ?? [];

    return isProfileReady({
      categoryIds,
      city: facilitatorProfile.city,
      companyName: facilitatorProfile.company_name,
      fullName: profile.full_name,
      postalCode: facilitatorProfile.postal_code,
      shortDescription: facilitatorProfile.short_description,
    });
  });

  if (status === "active" && !profileReady) {
    eventsRedirect("Færdiggør din profil, før du offentliggør events.");
  }

  const { error } = await supabase
    .from("events")
    .update({ status })
    .eq("id", eventId)
    .in(
      "facilitator_id",
      (
        await supabase.from("facilitator_profiles").select("id").eq("profile_id", profile.id)
      ).data?.map((row: { id: string }) => row.id) ?? [],
    );

  if (error) {
    eventsRedirect("Eventstatus kunne ikke opdateres.");
  }

  revalidatePath("/facilitator/events");
  eventsRedirect("Eventstatus er opdateret.");
}
