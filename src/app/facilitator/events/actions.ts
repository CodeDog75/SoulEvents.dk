"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import {
  formatEventUpdateDate,
  formatEventUpdateMoney,
  sendEventUpdateNotifications,
} from "@/lib/email/event-update-notification";
import { notifyFacilitatorEventReminderSubscribers } from "@/lib/email/facilitator-new-event-reminder";
import { activeLimitMessage, draftLimitMessage, getFacilitatorEventLimitStatus } from "@/lib/events/event-limits";
import { getDraftPublishReadiness } from "@/lib/events/draft-publish-readiness";
import { getAllStrings, getOptionalString, getString } from "@/lib/forms/form-data";
import { geocodeDanishAddress } from "@/lib/mapbox/geocode";
import { inferRegionSlug } from "@/lib/regions/infer-region";
import { createSlug } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventStatus } from "@/types/database";

const allowedStatuses: EventStatus[] = ["draft", "pending_review", "active", "rejected", "sold_out", "cancelled", "completed", "archived"];
const allowedFormats = ["physical", "online"] as const;
const onlineLinkLaterText = "Deltagerne modtager linket senere i invitationen";

const facilitatorProfileEventSelect = "id, status, company_name, city, postal_code, short_description, public_email, public_phone, facebook_url, instagram_url, max_ticket_price_per_person, facilitator_categories(category_id), profiles(email, phone)";
type AdminClient = ReturnType<typeof createAdminClient>;
type EventUpdateSnapshot = {
  address_line: string | null;
  city: string | null;
  country?: string | null;
  ends_at: string;
  event_format?: string | null;
  online_description?: string | null;
  online_url_or_note?: string | null;
  postal_code: string | null;
  price_cents: number;
  starts_at: string;
  status: EventStatus;
  title: string;
};

async function getAutoApproveEvents(supabase: AdminClient, facilitatorId: string) {
  const { data, error } = await supabase
    .from("facilitator_profiles")
    .select("auto_approve_events, status")
    .eq("id", facilitatorId)
    .maybeSingle();

  if (error) {
    return false;
  }

  return data?.status === "approved" && Boolean(data?.auto_approve_events);
}

function eventsRedirect(message: string): never {
  redirect(`/facilitator/events?message=${encodeURIComponent(message)}`);
}

function facilitatorOverviewRedirect(message: string): never {
  redirect(`/facilitator?message=${encodeURIComponent(message)}`);
}

function publicEventUrl(eventId: string) {
  const appUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.soulevents.dk").trim().replace(/\/$/, "");
  return appUrl + "/events/" + eventId;
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

  if (!/^\d{1,5}$/.test(raw)) {
    eventsRedirect("Pris skal være et tal på højst 5 cifre.");
  }

  return Number(raw) * 100;
}

function formatTicketPriceLimit(limit: number) {
  return new Intl.NumberFormat("da-DK").format(limit) + " kr.";
}

function ticketPriceLimitMessage(limit: number) {
  return (
    "Din konto er godkendt til events med en billetpris på op til " +
    formatTicketPriceLimit(limit) +
    " pr. deltager. Ønsker du at annoncere dyrere events eller retreats, er du velkommen til at kontakte SoulEvents for en individuel aftale."
  );
}


function isValidUrl(value: string) {
  if (value.trim() === onlineLinkLaterText) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function formatLocation(input: {
  addressLine: string | null;
  city: string | null;
  country?: string | null;
  postalCode: string | null;
}) {
  const cityLine = [input.postalCode, input.city].filter(Boolean).join(" ");
  return [input.addressLine, cityLine, input.country].filter(Boolean).join(", ") || "Ikke angivet";
}

function formatOnlineAccess(input: {
  eventFormat?: string | null;
  onlineDescription?: string | null;
  onlineUrlOrNote?: string | null;
}) {
  if (input.eventFormat !== "online") {
    return "Fysisk event";
  }

  return [input.onlineUrlOrNote, input.onlineDescription].filter(Boolean).join(" - ") || "Online-adgang sendes senere";
}

function addEventUpdateField(
  fields: Array<{ label: string; nextValue: string; previousValue: string }>,
  label: string,
  previousValue: string,
  nextValue: string,
) {
  if (previousValue !== nextValue) {
    fields.push({ label, previousValue, nextValue });
  }
}

function getEventUpdateFields(previousEvent: EventUpdateSnapshot, nextEvent: EventUpdateSnapshot) {
  const fields: Array<{ label: string; nextValue: string; previousValue: string }> = [];

  addEventUpdateField(fields, "Titel", previousEvent.title, nextEvent.title);
  addEventUpdateField(fields, "Starttidspunkt", formatEventUpdateDate(previousEvent.starts_at), formatEventUpdateDate(nextEvent.starts_at));
  addEventUpdateField(fields, "Sluttidspunkt", formatEventUpdateDate(previousEvent.ends_at), formatEventUpdateDate(nextEvent.ends_at));
  addEventUpdateField(fields, "Pris", formatEventUpdateMoney(previousEvent.price_cents), formatEventUpdateMoney(nextEvent.price_cents));
  addEventUpdateField(
    fields,
    "Sted",
    formatLocation({
      addressLine: previousEvent.address_line,
      city: previousEvent.city,
      country: previousEvent.country,
      postalCode: previousEvent.postal_code,
    }),
    formatLocation({
      addressLine: nextEvent.address_line,
      city: nextEvent.city,
      country: nextEvent.country,
      postalCode: nextEvent.postal_code,
    }),
  );
  addEventUpdateField(
    fields,
    "Online-adgang",
    formatOnlineAccess({
      eventFormat: previousEvent.event_format,
      onlineDescription: previousEvent.online_description,
      onlineUrlOrNote: previousEvent.online_url_or_note,
    }),
    formatOnlineAccess({
      eventFormat: nextEvent.event_format,
      onlineDescription: nextEvent.online_description,
      onlineUrlOrNote: nextEvent.online_url_or_note,
    }),
  );

  return fields;
}

async function uploadEventCoverImage(formData: FormData, currentImagePath: string | null) {
  const file = formData.get("event_cover_file");

  if (!(file instanceof File) || file.size === 0) {
    return currentImagePath;
  }

  const allowedTypes = new Map([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
  ]);
  const extension = allowedTypes.get(file.type);

  if (!extension) {
    eventsRedirect("Billedet skal være JPG, PNG eller WebP. HEIC skal konverteres i browseren før upload.");
  }

  if (file.size > 10 * 1024 * 1024) {
    eventsRedirect("Billedet må højst være 10 MB.");
  }

  const imagePath = "events/cover/" + crypto.randomUUID() + "." + extension;
  const adminClient = createAdminClient();
  const { error } = await adminClient.storage.from("media").upload(imagePath, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    eventsRedirect("Billedet kunne ikke uploades. Tjek at media-bucket findes i Supabase.");
  }

  return imagePath;
}

function toDateTime(date: string, time: string) {
  if (!date || !time) {
    return "";
  }

  return new Date(`${date}T${time}:00`).toISOString();
}

async function replaceEventRelations(
  supabase: AdminClient,
  eventId: string,
  input: {
    categoryIds: string[];
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
}

async function createUniqueEventSlug(supabase: AdminClient, baseSlug: string) {
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
  const supabase = createAdminClient();
  const { data: initialFacilitatorProfile, error: facilitatorLookupError } = await supabase
    .from("facilitator_profiles")
    .select(facilitatorProfileEventSelect)
    .eq("profile_id", profile.id)
    .maybeSingle();
  let facilitatorProfile = initialFacilitatorProfile;

  if (facilitatorLookupError) {
    eventsRedirect("Arrangørprofilen kunne ikke hentes. Tjek at Supabase-migrationerne er kørt.");
  }

  if (!facilitatorProfile) {
    const { data: repairedProfile, error: repairError } = await supabase
      .from("facilitator_profiles")
      .insert({ profile_id: profile.id, status: "pending" })
      .select(facilitatorProfileEventSelect)
      .single();

    if (repairError || !repairedProfile) {
      const { data: refetchedProfile } = await supabase
        .from("facilitator_profiles")
        .select(facilitatorProfileEventSelect)
        .eq("profile_id", profile.id)
        .maybeSingle();

      if (!refetchedProfile) {
        eventsRedirect(
          "Arrangørprofilen kunne ikke gøres klar. Prøv at logge ud og ind igen." +
            (repairError?.message ? " Teknisk besked: " + repairError.message : "")
        );
      }

      facilitatorProfile = refetchedProfile;
    } else {
      facilitatorProfile = repairedProfile;
    }
  }

  const requestedStatus = getString(formData, "status") as EventStatus;
  const notifyParticipants = getString(formData, "notify_participants") === "yes";
  const participantUpdateMessage = getOptionalString(formData, "participant_update_message");
  const existingEventId = getOptionalString(formData, "event_id");
  const currentStep = getString(formData, "current_step") || "0";
  const safeStep = ["0", "1", "2", "3", "4"].includes(currentStep) ? currentStep : "0";

  if (!allowedStatuses.includes(requestedStatus)) {
    eventsRedirect("Ugyldig eventstatus.");
  }

  if (participantUpdateMessage && participantUpdateMessage.length > 500) {
    eventsRedirect("Beskeden til deltagerne må højst være 500 tegn.");
  }

  let existingEventStatus: EventStatus | null = null;
  let previousEventSnapshot: EventUpdateSnapshot | null = null;

  if (existingEventId) {
    const { data: existingEvent } = await supabase
      .from("events")
      .select("id, status, title, starts_at, ends_at, address_line, postal_code, city, country, price_cents, event_format, online_description, online_url_or_note")
      .eq("id", existingEventId)
      .eq("facilitator_id", facilitatorProfile.id)
      .maybeSingle();

    if (!existingEvent) {
      eventsRedirect("Eventet kunne ikke findes.");
    }

    existingEventStatus = existingEvent.status as EventStatus;
    previousEventSnapshot = existingEvent as EventUpdateSnapshot;
  }

  const autoApproveEvents = await getAutoApproveEvents(supabase, facilitatorProfile.id);
  const preservedPublishedStatus =
    existingEventStatus && ["active", "sold_out"].includes(existingEventStatus) ? existingEventStatus : null;
  const shouldPreservePublishedStatus =
    Boolean(preservedPublishedStatus) && requestedStatus !== "draft";
  let status: EventStatus = requestedStatus === "pending_review" && autoApproveEvents ? "active" : requestedStatus;

  if (shouldPreservePublishedStatus && preservedPublishedStatus) {
    status = preservedPublishedStatus;
  }

  const isDraft = status === "draft";
  const wasAutoApproved = !shouldPreservePublishedStatus && requestedStatus === "pending_review" && status === "active";

  const facilitatorCategoryIds =
    facilitatorProfile.facilitator_categories?.map((row: { category_id: string }) => row.category_id) ?? [];

  if (
    !isDraft &&
    !isProfileReady({
      categoryIds: facilitatorCategoryIds,
      city: facilitatorProfile.city,
      companyName: facilitatorProfile.company_name,
      fullName: profile.full_name,
      postalCode: facilitatorProfile.postal_code,
      shortDescription: facilitatorProfile.short_description,
    })
  ) {
    eventsRedirect("Færdiggør din profil, før du sender eventet til godkendelse.");
  }

  if (!allowedStatuses.includes(status)) {
    eventsRedirect("Ugyldig eventstatus.");
  }

  if (!existingEventId) {
    const limitStatus = await getFacilitatorEventLimitStatus(supabase, facilitatorProfile.id);

    if (isDraft && limitStatus.draftCount >= limitStatus.maxDraftEvents) {
      eventsRedirect(draftLimitMessage(limitStatus.maxDraftEvents));
    }

    if (status === "active" && limitStatus.activeCount >= limitStatus.maxActiveEvents) {
      eventsRedirect(activeLimitMessage(limitStatus.maxActiveEvents));
    }
  } else if (status === "active" && !shouldPreservePublishedStatus) {
    const limitStatus = await getFacilitatorEventLimitStatus(supabase, facilitatorProfile.id, {
      excludeEventId: existingEventId,
    });

    if (limitStatus.activeCount >= limitStatus.maxActiveEvents) {
      eventsRedirect(activeLimitMessage(limitStatus.maxActiveEvents));
    }
  }

  const rawTitle = getString(formData, "title");
  const title = rawTitle || (isDraft ? "Kladde uden titel" : "");
  const slugBase = createSlug(title || "kladde");
  const eventDescription =
    getString(formData, "event_description") ||
    getString(formData, "long_description") ||
    getString(formData, "short_description");
  const shortDescription = eventDescription.slice(0, 220);
  const longDescription = eventDescription;
  const coverImagePath = await uploadEventCoverImage(formData, getOptionalString(formData, "current_cover_image_path"));
  const startsAt = toDateTime(getString(formData, "start_date"), getString(formData, "start_time"));
  const endsAt = toDateTime(getString(formData, "end_date"), getString(formData, "end_time"));
  const addressLine = getOptionalString(formData, "address_line");
  const postalCode = getOptionalString(formData, "postal_code");
  const city = getOptionalString(formData, "city");
  const country = getOptionalString(formData, "country") || "Danmark";
  let regionId = getOptionalString(formData, "region_id");
  const priceCents = getPriceCents(formData);
  const capacityText = getString(formData, "capacity");
  const rawCapacity = getInteger(formData, "capacity");
  const capacity = isDraft && rawCapacity <= 0 ? 1 : rawCapacity;
  const relatedProfile = Array.isArray(facilitatorProfile.profiles)
    ? facilitatorProfile.profiles[0]
    : facilitatorProfile.profiles;
  const contactName = facilitatorProfile.company_name || profile.full_name || null;
  const contactEmail = facilitatorProfile.public_email || relatedProfile?.email || null;
  const contactPhone = facilitatorProfile.public_phone || relatedProfile?.phone || null;
  const facebookUrl = facilitatorProfile.facebook_url || null;
  const instagramUrl = facilitatorProfile.instagram_url || null;
  const eventFormat = getString(formData, "event_format") || "physical";
  const maxTicketPricePerPerson =
    typeof facilitatorProfile.max_ticket_price_per_person === "number"
      ? facilitatorProfile.max_ticket_price_per_person
      : null;

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

  const lengthChecks: Array<[string | null, number, string]> = [
    [coverImagePath, 300, "Eventbillede"],
    [addressLine, 120, "Adresse"],
    [postalCode, 20, "Postnummer"],
    [city, 80, "By"],
    [country, 80, "Land"],
    [contactName, 80, "Kontaktperson"],
    [contactEmail, 160, "E-mail"],
    [contactPhone, 20, "Telefonnummer"],
    [facebookUrl, 300, "Facebook-link"],
    [instagramUrl, 300, "Instagram-link"],
    [onlineDescription, 500, "Online-beskrivelse"],
    [onlineUrlOrNote, 500, "Online-link eller tekst"],
    [practicalInformation, 800, "Praktiske oplysninger"],
  ];

  for (const [value, maxLength, label] of lengthChecks) {
    if (value && value.length > maxLength) {
      eventsRedirect(label + " må højst være " + maxLength + " tegn.");
    }
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

  if (capacityText && !/^\d{1,3}$/.test(capacityText)) {
    eventsRedirect("Antal deltagere skal være et tal på højst 3 cifre.");
  }

  if (!isDraft && capacity <= 0) {
    eventsRedirect("Kapacitet skal være mindst 1.");
  }

  if (!isDraft && maxTicketPricePerPerson !== null && priceCents > maxTicketPricePerPerson * 100) {
    eventsRedirect(ticketPriceLimitMessage(maxTicketPricePerPerson));
  }

  if (capacity > 500) {
    eventsRedirect("Maks. antal deltagere er 500.");
  }

  if (mainCategoryIds.length > 3 || categoryIds.length > 3 || tagIds.length > 4) {
    eventsRedirect("Du kan vælge op til 3 kategorier og op til 4 tags.");
  }

  if (!isDraft && mainCategoryIds.length < 1) {
    eventsRedirect("Vælg mindst én hovedkategori til eventet.");
  }

  if (!isDraft && eventFormat === "physical" && (!addressLine || !postalCode || !city || !country)) {
    eventsRedirect("Adresse, postnummer, by og land skal udfyldes for fysiske events.");
  }

  if (!isDraft && isDanishPhysicalEvent && postalCode && !/^\d{4}$/.test(postalCode)) {
    eventsRedirect("Danske events skal have et postnummer på 4 cifre.");
  }

  if (!isDraft && eventFormat === "online" && !onlineUrlOrNote) {
    eventsRedirect("Tilføj et gyldigt online-link.");
  }

  if (!isDraft && eventFormat === "online" && onlineUrlOrNote && !isValidUrl(onlineUrlOrNote)) {
    eventsRedirect("Online-link skal være et gyldigt link, fx https://zoom.us/...");
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
    const nextEventSnapshot: EventUpdateSnapshot = {
      address_line: addressLine,
      city,
      country,
      ends_at: endsAt,
      event_format: eventFormat,
      online_description: onlineDescription,
      online_url_or_note: onlineUrlOrNote,
      postal_code: postalCode,
      price_cents: priceCents,
      starts_at: startsAt,
      status,
      title,
    };
    let participantNotificationFailed = false;
    let participantNotificationResult: { failed: number; sent: number; total: number } | null = null;
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
      mainCategoryIds,
      subcategoryIds,
      tagIds,
    });

    if (previousEventSnapshot && shouldPreservePublishedStatus) {
      const changedFields = getEventUpdateFields(previousEventSnapshot, nextEventSnapshot);

      if (previousEventSnapshot.title !== title || previousEventSnapshot.starts_at !== startsAt) {
        await supabase
          .from("bookings")
          .update({
            event_starts_at_snapshot: startsAt,
            event_title_snapshot: title,
          })
          .eq("event_id", existingEventId)
          .in("status", ["pending", "confirmed"]);
      }

      if (notifyParticipants) {
        try {
          const { data: participants } = await supabase
            .from("bookings")
            .select("id, participant_email, participant_name, seats, status")
            .eq("event_id", existingEventId)
            .in("status", ["pending", "confirmed"]);

          const recipients = (participants ?? []).map((participant) => ({
            bookingId: participant.id,
            email: participant.participant_email,
            name: participant.participant_name,
            seats: participant.seats,
            status: participant.status,
          }));

          const mailResult = await sendEventUpdateNotifications({
            eventId: existingEventId,
            eventStartsAt: startsAt,
            eventTitle: title,
            eventUrl: publicEventUrl(existingEventId),
            facilitatorName: contactName || "Arrangør",
            fields: changedFields,
            location: formatLocation({
              addressLine,
              city,
              country,
              postalCode,
            }),
            personalMessage: participantUpdateMessage,
            recipients,
          });
          participantNotificationResult = mailResult;

          const { error: logError } = await supabase.from("event_update_notification_logs").insert({
            actor_profile_id: profile.id,
            event_id: existingEventId,
            facilitator_id: facilitatorProfile.id,
            recipient_count: mailResult.sent,
          });

          if (logError) {
            console.error("Event update notification log error", logError);
          }

          if (mailResult.failed > 0) {
            participantNotificationFailed = true;
            console.error("Event update notification delivery failed", {
              eventId: existingEventId,
              failed: mailResult.failed,
              sent: mailResult.sent,
              total: mailResult.total,
            });
          }
        } catch (error) {
          participantNotificationFailed = true;
          console.error("Event update notification error", error);
        }
      }
    }

    revalidatePath("/facilitator");
    revalidatePath("/facilitator/events");

    if (isDraft) {
      redirect("/facilitator/events?draft=" + existingEventId + "&step=" + safeStep + "&message=" + encodeURIComponent("Kladde er opdateret og gemt."));
    }

    if (shouldPreservePublishedStatus) {
      const message = participantNotificationFailed
        ? "Eventet er opdateret, men beskeden kunne ikke sendes til alle deltagere."
        : notifyParticipants
          ? participantNotificationResult && participantNotificationResult.total > 0
            ? participantNotificationResult.sent === participantNotificationResult.total
              ? "Eventet er opdateret, og deltagerne har fået besked."
              : "Eventet er opdateret. Beskeden blev sendt til " + participantNotificationResult.sent + " af " + participantNotificationResult.total + " deltagere."
            : "Eventet er opdateret, og der var ingen aktive deltagere at sende besked til."
          : "Eventet er opdateret uden at sende besked.";
      redirect("/facilitator/events?draft=" + existingEventId + "&step=" + safeStep + "&message=" + encodeURIComponent(message));
    }

    if (wasAutoApproved) {
      await supabase.from("admin_audit_log").insert({
        actor_profile_id: profile.id,
        facilitator_id: facilitatorProfile.id,
        event_id: existingEventId,
        action: "event_auto_approved",
        new_value: "active",
        reason: "auto_approve_events",
      });
      await notifyFacilitatorEventReminderSubscribers(existingEventId);
      redirect("/facilitator/events?receipt=published&event=" + existingEventId);
    }

    redirect("/facilitator/events?receipt=review");
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

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/events");

  if (isDraft) {
    redirect("/facilitator/events?draft=" + event.id + "&step=" + safeStep + "&message=" + encodeURIComponent("Kladde er gemt."));
  }

  if (wasAutoApproved) {
    await supabase.from("admin_audit_log").insert({
      actor_profile_id: profile.id,
      facilitator_id: facilitatorProfile.id,
      event_id: event.id,
      action: "event_auto_approved",
      new_value: "active",
      reason: "auto_approve_events",
    });
    await notifyFacilitatorEventReminderSubscribers(event.id);
    redirect("/facilitator/events?receipt=published&event=" + event.id);
  }

  redirect("/facilitator/events?receipt=review");
}

export async function updateEventStatusAction(formData: FormData) {
  const profile = await requireRole("facilitator");
  const eventId = getString(formData, "event_id");
  const status = getString(formData, "status") as EventStatus;

  if (!eventId || !allowedStatuses.includes(status)) {
    eventsRedirect("Ugyldig eventhandling.");
  }

  const supabase = createAdminClient();
  const { data: facilitatorProfiles } = await supabase
    .from("facilitator_profiles")
    .select("id, company_name, city, postal_code, short_description, max_ticket_price_per_person, facilitator_categories(category_id)")
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

  if (status === "active") {
    const facilitatorIds = (facilitatorProfiles ?? []).map((facilitatorProfile) => facilitatorProfile.id);
    const { data: event } = await supabase
      .from("events")
      .select("id, facilitator_id, price_cents")
      .eq("id", eventId)
      .in("facilitator_id", facilitatorIds)
      .maybeSingle();
    const facilitatorProfile = (facilitatorProfiles ?? []).find((currentProfile) => currentProfile.id === event?.facilitator_id);
    const maxTicketPricePerPerson =
      typeof facilitatorProfile?.max_ticket_price_per_person === "number"
        ? facilitatorProfile.max_ticket_price_per_person
        : null;

    if (!event || !facilitatorProfile) {
      eventsRedirect("Eventet kunne ikke findes.");
    }

    if (maxTicketPricePerPerson !== null && event.price_cents > maxTicketPricePerPerson * 100) {
      eventsRedirect(ticketPriceLimitMessage(maxTicketPricePerPerson));
    }

    const facilitatorId = facilitatorProfile.id;
    const limitStatus = facilitatorId
      ? await getFacilitatorEventLimitStatus(supabase, facilitatorId, { excludeEventId: eventId })
      : null;

    if (limitStatus && limitStatus.activeCount >= limitStatus.maxActiveEvents) {
      eventsRedirect(activeLimitMessage(limitStatus.maxActiveEvents));
    }
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
    facilitatorOverviewRedirect("Eventstatus kunne ikke opdateres.");
  }

  if (status === "active") {
    await notifyFacilitatorEventReminderSubscribers(eventId);
  }

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/events");
  facilitatorOverviewRedirect(status === "cancelled" ? "Eventet er aflyst." : "Eventstatus er opdateret.");
}

export async function publishDraftEventAction(formData: FormData) {
  const profile = await requireRole("facilitator");
  const eventId = getString(formData, "event_id");

  if (!eventId) {
    facilitatorOverviewRedirect("Eventet kunne ikke offentliggøres.");
  }

  const supabase = createAdminClient();
  const { data: facilitatorProfile } = await supabase
    .from("facilitator_profiles")
    .select("id, status, max_ticket_price_per_person")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!facilitatorProfile) {
    facilitatorOverviewRedirect("Arrangørprofilen mangler.");
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, status, title, long_description, starts_at, ends_at, address_line, postal_code, city, country, price_cents, capacity, cover_image_path, event_format, online_url_or_note, event_main_categories(main_category_id), event_tags(tag_id)")
    .eq("id", eventId)
    .eq("facilitator_id", facilitatorProfile.id)
    .eq("status", "draft")
    .maybeSingle();

  if (!event) {
    facilitatorOverviewRedirect("Kladdeeventet kunne ikke findes.");
  }

  const readiness = getDraftPublishReadiness({
    event,
    facilitatorStatus: facilitatorProfile.status,
    maxTicketPricePerPerson: facilitatorProfile.max_ticket_price_per_person,
  });

  if (!readiness.canPublish) {
    facilitatorOverviewRedirect("Kladdeeventet mangler oplysninger før offentliggørelse.");
  }

  const autoApproveEvents = await getAutoApproveEvents(supabase, facilitatorProfile.id);
  const nextStatus: EventStatus = autoApproveEvents ? "active" : "pending_review";

  if (autoApproveEvents) {
    const limitStatus = await getFacilitatorEventLimitStatus(supabase, facilitatorProfile.id, {
      excludeEventId: event.id,
    });

    if (limitStatus.activeCount >= limitStatus.maxActiveEvents) {
      facilitatorOverviewRedirect(activeLimitMessage(limitStatus.maxActiveEvents));
    }
  }

  const { data: updatedEvent, error } = await supabase
    .from("events")
    .update({ status: nextStatus })
    .eq("id", event.id)
    .eq("facilitator_id", facilitatorProfile.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();

  if (error || !updatedEvent) {
    facilitatorOverviewRedirect("Eventet kunne ikke offentliggøres.");
  }

  if (autoApproveEvents) {
    await supabase.from("admin_audit_logs").insert({
      actor_profile_id: profile.id,
      facilitator_id: facilitatorProfile.id,
      event_id: event.id,
      action: "event_auto_approved",
      new_value: "active",
      reason: "draft_publish",
    });

    await notifyFacilitatorEventReminderSubscribers(event.id);
  }

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/events");
  facilitatorOverviewRedirect(autoApproveEvents ? "Eventet er offentliggjort." : "Eventet er sendt til godkendelse.");
}


export async function copyEventAsDraftAction(formData: FormData) {
  const profile = await requireRole("facilitator");
  const sourceEventId = getString(formData, "event_id");

  if (!sourceEventId) {
    eventsRedirect("Eventet kunne ikke kopieres.");
  }

  const supabase = createAdminClient();
  const { data: facilitatorProfile } = await supabase
    .from("facilitator_profiles")
    .select("id")
    .eq("profile_id", profile.id)
    .single();

  if (!facilitatorProfile) {
    eventsRedirect("Arrangørprofilen mangler.");
  }

  const limitStatus = await getFacilitatorEventLimitStatus(supabase, facilitatorProfile.id);

  if (limitStatus.draftCount >= limitStatus.maxDraftEvents) {
    eventsRedirect(draftLimitMessage(limitStatus.maxDraftEvents));
  }

  const { data: sourceEvent, error: sourceError } = await supabase
    .from("events")
    .select("*, event_categories(category_id), event_main_categories(main_category_id), event_subcategories(subcategory_id), event_tags(tag_id)")
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

  const supabase = createAdminClient();
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
