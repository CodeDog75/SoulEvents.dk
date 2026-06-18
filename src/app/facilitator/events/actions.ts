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
const allowedFormats = ["physical", "online"] as const;

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

async function replaceEventRelations(
  supabase: any,
  eventId: string,
  input: {
    categoryIds: string[];
    imageAlts: string[];
    imagePaths: string[];
    mainCategoryIds: string[];
    subcategoryIds: string[];
    tagIds: string[];
  },
) {
  await Promise.all([
    supabase.from("event_categories").delete().eq("event_id", eventId),
    supabase.from("event_main_categories").delete().eq("event_id", eventId),
    supabase.from("event_subcategories").delete().eq("event_id", eventId),
    supabase.from("event_tags").delete().eq("event_id", eventId),
    supabase.from("event_images").delete().eq("event_id", eventId),
  ]);

  if (input.mainCategoryIds.length > 0) {
    await supabase.from("event_main_categories").insert(
      input.mainCategoryIds.map((mainCategoryId) => ({
        event_id: eventId,
        main_category_id: mainCategoryId,
      })),
    );
  }

  if (input.subcategoryIds.length > 0) {
    await supabase.from("event_subcategories").insert(
      input.subcategoryIds.map((subcategoryId) => ({
        event_id: eventId,
        subcategory_id: subcategoryId,
      })),
    );
  }

  if (input.tagIds.length > 0) {
    await supabase.from("event_tags").insert(
      input.tagIds.map((tagId) => ({
        event_id: eventId,
        tag_id: tagId,
      })),
    );
  }

  if (input.categoryIds.length > 0) {
    await supabase.from("event_categories").insert(
      input.categoryIds.map((categoryId) => ({
        event_id: eventId,
        category_id: categoryId,
      })),
    );
  }

  const imageRows = normalizeImageRows(input.imagePaths, input.imageAlts);

  if (imageRows.length > 0) {
    await supabase.from("event_images").insert(
      imageRows.map((row) => ({
        event_id: eventId,
        ...row,
      })),
    );
  }
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
    eventsRedirect("Arrangørprofilen mangler.");
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

  const status = getString(formData, "status") as EventStatus;
  const existingEventId = getOptionalString(formData, "event_id");
  const isDraft = status === "draft";
  const rawTitle = getString(formData, "title");
  const title = rawTitle || (isDraft ? "Kladde uden titel" : "");
  const slugBase = createSlug(title || "kladde");
  const eventDescription =
    getString(formData, "event_description") ||
    getString(formData, "long_description") ||
    getString(formData, "short_description");
  const shortDescription = eventDescription.slice(0, 220);
  const longDescription = eventDescription;
  const coverImagePath = getOptionalString(formData, "cover_image_path");
  const startsAt = toDateTime(getString(formData, "start_date"), getString(formData, "start_time"));
  const endsAt = toDateTime(getString(formData, "end_date"), getString(formData, "end_time"));
  const addressLine = getOptionalString(formData, "address_line");
  const postalCode = getOptionalString(formData, "postal_code");
  const city = getOptionalString(formData, "city");
  const country = getOptionalString(formData, "country") || "Danmark";
  let regionId = getOptionalString(formData, "region_id");
  const priceCents = getPriceCents(formData);
  const rawCapacity = getInteger(formData, "capacity");
  const capacity = isDraft && rawCapacity <= 0 ? 1 : rawCapacity;
  const contactName = getOptionalString(formData, "contact_name");
  const contactEmail = getOptionalString(formData, "contact_email");
  const contactPhone = getOptionalString(formData, "contact_phone");
  const facebookUrl = getOptionalString(formData, "facebook_url");
  const instagramUrl = getOptionalString(formData, "instagram_url");
  const eventFormat = getString(formData, "event_format") || "physical";

  const isDanishPhysicalEvent = eventFormat === "physical" && country.trim().toLowerCase() === "danmark";

  // Danske fysiske events styres altid af postnummeret, så arrangøren ikke kan vælge et område, der ikke passer til adressen.
  if (isDanishPhysicalEvent) {
    regionId = null;
  }

  const onlineDescription = getOptionalString(formData, "online_description");
  const onlineUrlOrNote = getOptionalString(formData, "online_url_or_note");
  const practicalInformation = getOptionalString(formData, "practical_information");
  const categoryIds = getAllStrings(formData, "category_ids");
  const mainCategoryIds = getAllStrings(formData, "main_category_ids");
  const subcategoryIds = getAllStrings(formData, "subcategory_ids");
  const tagIds = getAllStrings(formData, "tag_ids");

  if (!allowedFormats.includes(eventFormat as "physical" | "online")) {
    eventsRedirect("Vælg om eventet er fysisk eller online.");
  }
  const imagePaths = getAllStrings(formData, "event_image_paths");
  const imageAlts = getAllStrings(formData, "event_alt_texts");

  if (!allowedStatuses.includes(status)) {
    eventsRedirect("Ugyldig eventstatus.");
  }

  if (!isDraft && (!rawTitle || !slugBase)) {
    eventsRedirect("Titel er påkrævet.");
  }

  if (rawTitle.length > 80) {
    eventsRedirect("Eventtitel må højst være 80 tegn.");
  }

  if (!isDraft && (!eventDescription || eventDescription.length < 20)) {
    eventsRedirect("Beskrivelse af event skal være mindst 20 tegn.");
  }

  if (eventDescription.length > 2000) {
    eventsRedirect("Beskrivelse af event må højst være 2000 tegn.");
  }

  if (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt)) {
    eventsRedirect("Sluttidspunkt skal være efter starttidspunkt.");
  }

  if (!isDraft && capacity <= 0) {
    eventsRedirect("Kapacitet skal være mindst 1.");
  }

  if (!isDraft && eventFormat === "physical" && (!addressLine || !postalCode || !city || !country)) {
    eventsRedirect("Adresse, postnummer, by og land skal udfyldes for fysiske events.");
  }

  if (!isDraft && eventFormat === "online" && !onlineUrlOrNote) {
    eventsRedirect("Tilføj et online-link eller skriv, at link sendes efter tilmelding.");
  }

  if (isDanishPhysicalEvent && !regionId) {
    const inferredSlug = inferRegionSlug({ city, postalCode });

    if (inferredSlug) {
      const { data: inferredRegion } = await supabase.from("regions").select("id").eq("slug", inferredSlug).maybeSingle();
      regionId = inferredRegion?.id ?? null;
    }
  }

  if (!isDraft && isDanishPhysicalEvent && !regionId) {
    eventsRedirect("Postnummeret kunne ikke kobles til et område. Tjek postnummeret.");
  }

  const hasAddressForGeocoding = Boolean(addressLine && postalCode && city);
  const coordinates =
    !isDanishPhysicalEvent || !hasAddressForGeocoding
      ? null
      : await geocodeDanishAddress({ addressLine, postalCode, city });

  if (existingEventId) {
    const { data: existingEvent } = await supabase
      .from("events")
      .select("id")
      .eq("id", existingEventId)
      .eq("facilitator_id", facilitatorProfile.id)
      .maybeSingle();

    if (!existingEvent) {
      eventsRedirect("Kladde kunne ikke findes.");
    }

    const { error: updateError } = await supabase
      .from("events")
      .update({
        status,
        title,
        short_description: shortDescription,
        long_description: longDescription,
        cover_image_path: coverImagePath,
        starts_at: startsAt,
        ends_at: endsAt,
        address_line: addressLine,
        postal_code: postalCode,
        city,
        country,
        region_id: isDanishPhysicalEvent ? regionId : null,
        latitude: coordinates?.latitude ?? null,
        longitude: coordinates?.longitude ?? null,
        price_cents: priceCents,
        capacity,
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        facebook_url: facebookUrl,
        instagram_url: instagramUrl,
        event_format: eventFormat,
        online_description: onlineDescription,
        online_url_or_note: onlineUrlOrNote,
        practical_information: practicalInformation,
      })
      .eq("id", existingEventId)
      .eq("facilitator_id", facilitatorProfile.id);

    if (updateError) {
      console.error("Event update error", updateError);
      const errorMessage = updateError.message ? ": " + updateError.message : "";
      eventsRedirect(isDraft ? "Kladde kunne ikke gemmes" + errorMessage : "Eventet kunne ikke opdateres" + errorMessage);
    }

    await replaceEventRelations(supabase, existingEventId, {
      categoryIds,
      imageAlts,
      imagePaths,
      mainCategoryIds,
      subcategoryIds,
      tagIds,
    });

    revalidatePath("/facilitator");
    revalidatePath("/facilitator/events");

    if (isDraft) {
      redirect("/facilitator/events?draft=" + existingEventId + "&message=" + encodeURIComponent("Kladde er opdateret."));
    }

    eventsRedirect("Eventet er sendt til godkendelse.");
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      facilitator_id: facilitatorProfile.id,
      status,
      title,
      slug: await createUniqueEventSlug(supabase, slugBase),
      short_description: shortDescription,
      long_description: longDescription,
      cover_image_path: coverImagePath,
      starts_at: startsAt,
      ends_at: endsAt,
      address_line: addressLine,
      postal_code: postalCode,
      city,
      country,
      region_id: isDanishPhysicalEvent ? regionId : null,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      price_cents: priceCents,
      capacity,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      facebook_url: facebookUrl,
      instagram_url: instagramUrl,
      event_format: eventFormat,
      online_description: onlineDescription,
      online_url_or_note: onlineUrlOrNote,
      practical_information: practicalInformation,
    })
    .select("id")
    .single();

  if (eventError || !event) {
    console.error("Event insert error", eventError);
    const errorMessage = eventError?.message ? ": " + eventError.message : "";
    eventsRedirect(
      isDraft
        ? "Kladde kunne ikke gemmes" + errorMessage
        : "Eventet kunne ikke oprettes" + errorMessage,
    );
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

  if (isDraft) {
    redirect("/facilitator/events?draft=" + event.id + "&message=" + encodeURIComponent("Kladde er gemt."));
  }

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


export async function copyEventAsDraftAction(formData: FormData) {
  const profile = await requireRole("facilitator");
  const sourceEventId = getString(formData, "event_id");

  if (!sourceEventId) {
    eventsRedirect("Eventet kunne ikke kopieres.");
  }

  const supabase = await createClient();
  const { data: facilitatorProfile } = await supabase
    .from("facilitator_profiles")
    .select("id")
    .eq("profile_id", profile.id)
    .single();

  if (!facilitatorProfile) {
    eventsRedirect("Arrangørprofilen mangler.");
  }

  const { data: sourceEvent, error: sourceError } = await supabase
    .from("events")
    .select("*, event_categories(category_id), event_main_categories(main_category_id), event_subcategories(subcategory_id), event_tags(tag_id), event_images(image_path, alt_text, sort_order)")
    .eq("id", sourceEventId)
    .eq("facilitator_id", facilitatorProfile.id)
    .maybeSingle();

  if (sourceError || !sourceEvent) {
    eventsRedirect("Eventet kunne ikke kopieres.");
  }

  const copyTitle = sourceEvent.title + " (kopi)";
  const { data: copiedEvent, error: copyError } = await supabase
    .from("events")
    .insert({
      facilitator_id: facilitatorProfile.id,
      status: "draft",
      title: copyTitle,
      slug: await createUniqueEventSlug(supabase, createSlug(copyTitle)),
      short_description: sourceEvent.short_description,
      long_description: sourceEvent.long_description,
      cover_image_path: sourceEvent.cover_image_path,
      starts_at: sourceEvent.starts_at,
      ends_at: sourceEvent.ends_at,
      address_line: sourceEvent.address_line,
      postal_code: sourceEvent.postal_code,
      city: sourceEvent.city,
      region_id: sourceEvent.region_id,
      latitude: sourceEvent.latitude,
      longitude: sourceEvent.longitude,
      price_cents: sourceEvent.price_cents,
      capacity: sourceEvent.capacity,
      contact_name: sourceEvent.contact_name,
      contact_email: sourceEvent.contact_email,
      contact_phone: sourceEvent.contact_phone,
      facebook_url: sourceEvent.facebook_url,
      instagram_url: sourceEvent.instagram_url,
      event_format: sourceEvent.event_format ?? "physical",
      online_description: sourceEvent.online_description,
      online_url_or_note: sourceEvent.online_url_or_note,
      practical_information: sourceEvent.practical_information,
    })
    .select("id")
    .single();

  if (copyError || !copiedEvent) {
    console.error("Event copy error", copyError);
    const errorMessage = copyError?.message ? ": " + copyError.message : "";
    eventsRedirect("Eventet kunne ikke kopieres" + errorMessage);
  }

  await replaceEventRelations(supabase, copiedEvent.id, {
    categoryIds: sourceEvent.event_categories?.map((row: { category_id: string }) => row.category_id) ?? [],
    imageAlts: sourceEvent.event_images?.map((row: { alt_text: string | null }) => row.alt_text ?? "") ?? [],
    imagePaths: sourceEvent.event_images?.map((row: { image_path: string }) => row.image_path) ?? [],
    mainCategoryIds: sourceEvent.event_main_categories?.map((row: { main_category_id: string }) => row.main_category_id) ?? [],
    subcategoryIds: sourceEvent.event_subcategories?.map((row: { subcategory_id: string }) => row.subcategory_id) ?? [],
    tagIds: sourceEvent.event_tags?.map((row: { tag_id: string }) => row.tag_id) ?? [],
  });

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/events");
  redirect("/facilitator/events?draft=" + copiedEvent.id + "&message=" + encodeURIComponent("Eventet er kopieret som ny kladde med nyt referencenummer."));
}


export async function deleteDraftEventAction(formData: FormData) {
  const profile = await requireRole("facilitator");
  const eventId = getString(formData, "event_id");

  if (!eventId) {
    eventsRedirect("Kladde kunne ikke slettes.");
  }

  const supabase = await createClient();
  const { data: facilitatorProfiles } = await supabase
    .from("facilitator_profiles")
    .select("id")
    .eq("profile_id", profile.id);

  const facilitatorIds = facilitatorProfiles?.map((row: { id: string }) => row.id) ?? [];

  if (facilitatorIds.length === 0) {
    eventsRedirect("Arrangørprofilen mangler.");
  }

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId)
    .eq("status", "draft")
    .in("facilitator_id", facilitatorIds);

  if (error) {
    console.error("Delete draft event error", error);
    eventsRedirect("Kladde kunne ikke slettes: " + error.message);
  }

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/events");
  redirect("/facilitator?message=" + encodeURIComponent("Kladde er slettet."));
}
