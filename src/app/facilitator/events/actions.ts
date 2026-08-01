"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile, requireRole } from "@/lib/auth/roles";
import {
  formatEventUpdateDate,
  formatEventUpdateMoney,
  sendEventUpdateNotifications,
} from "@/lib/email/event-update-notification";
import { sendCoOrganizerInvitationEmail, sendCoOrganizerRemovedEmail, sendCoOrganizerStatusEmail } from "@/lib/email/co-organizer-invitation";
import { notifyFacilitatorEventReminderSubscribers } from "@/lib/email/facilitator-new-event-reminder";
import { formattedMaxEventDescriptionLength, maxEventDescriptionLength } from "@/lib/events/event-content-limits";
import { activeLimitMessage, draftLimitMessage, getFacilitatorEventLimitStatus } from "@/lib/events/event-limits";
import { getAvailableEventSeats } from "@/lib/events/capacity";
import { getDraftPublishReadiness } from "@/lib/events/draft-publish-readiness";
import { getUserFacingEventStatus } from "@/lib/events/user-facing-status";
import { getFacilitatorOnboardingStateForProfile } from "@/lib/facilitators/onboarding-state";
import { getFacilitatorPublicEligibility } from "@/lib/facilitators/public-eligibility";
import { getFacilitatorProfileReadiness } from "@/lib/facilitators/profile-readiness";
import { getAllStrings, getOptionalString, getString } from "@/lib/forms/form-data";
import { getMissingRequiredLegalAcceptances, organizerAcceptanceTypes, recordLegalAcceptances } from "@/lib/legal/documents";
import { geocodeDanishAddress } from "@/lib/mapbox/geocode";
import { hasStandardPaymentMethod, paymentSettingsToInstructionsRecord, type PaymentMethodSource } from "@/lib/payment-instructions";
import { inferRegionSlug } from "@/lib/regions/infer-region";
import { createSlug, publicEventPath } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventRegistrationMode, EventStatus } from "@/types/database";

const allowedStatuses: EventStatus[] = ["draft", "pending_review", "active", "rejected", "sold_out", "cancelled", "completed", "archived"];
const activeCoOrganizerStatuses = ["pending", "accepted"] as const;
const allowedFormats = ["physical", "online"] as const;
const onlineLinkLaterText = "Deltagerne modtager linket senere i invitationen";
const missingCoverPublishMessage = "Tilføj et coverbillede, før eventet kan offentliggøres.";
const danishTimeZone = "Europe/Copenhagen";
const maxEventGalleryImages = 3;
type ActiveCoOrganizerStatus = (typeof activeCoOrganizerStatuses)[number];

const facilitatorProfileEventSelect =
  "id, profile_id, host_reference_id, status, is_paused, is_disabled, company_name, city, postal_code, short_description, public_email, public_phone, facebook_url, instagram_url, max_ticket_price_per_person, facilitator_categories(category_id), profiles!facilitator_profiles_profile_id_fkey(id, full_name, email, phone)";
type AdminClient = ReturnType<typeof createAdminClient>;
type PaymentLinkMode = "external_registration" | "payment_only";
type EventUpdateSnapshot = {
  address_line: string | null;
  capacity?: number | null;
  city: string | null;
  country?: string | null;
  ends_at: string;
  event_format?: string | null;
  online_description?: string | null;
  online_url_or_note?: string | null;
  postal_code: string | null;
  price_cents: number;
  registration_mode?: EventRegistrationMode;
  starts_at: string;
  status: EventStatus;
  title: string;
};

function eventsRedirect(message: string): never {
  redirect(`/facilitator/events?message=${encodeURIComponent(message)}`);
}

function adminEventEditRedirect(message: string, eventId?: string | null, returnTo?: string | null): never {
  const params = new URLSearchParams();
  params.set("message", message);
  if (returnTo) {
    params.set("returnTo", returnTo);
  }
  redirect(`/admin/events/${eventId ?? ""}/edit?${params.toString()}`);
}

function adminEventEditSuccessRedirect(message: string, returnTo?: string | null): never {
  redirect((returnTo && returnTo.startsWith("/admin") ? returnTo : "/admin/events") + (returnTo?.includes("?") ? "&" : "?") + "message=" + encodeURIComponent(message));
}

function eventFormRedirect(message: string, input: { eventId?: string | null; step?: string | null } = {}): never {
  const params = new URLSearchParams();
  if (input.eventId) {
    params.set("draft", input.eventId);
  }
  if (input.step) {
    params.set("step", input.step);
  }
  params.set("message", message);
  redirect("/facilitator/events?" + params.toString());
}

function facilitatorOverviewRedirect(message: string): never {
  redirect(`/facilitator?message=${encodeURIComponent(message)}`);
}

function publicEventUrl(eventId: string, eventSlug?: string | null) {
  const appUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.soulevents.dk").trim().replace(/\/$/, "");
  return appUrl + publicEventPath(eventSlug || eventId);
}

function appUrl(path = "") {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.soulevents.dk").trim().replace(/\/$/, "");
  return base + path;
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

function normalizeTextForComparison(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
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

function normalizePaymentMethodSource(value: string): PaymentMethodSource {
  return value === "custom" || value === "none" ? value : "facilitator";
}

function normalizeRegistrationMode(value: string): EventRegistrationMode {
  return value === "direct" ? "direct" : "approval_required";
}

function normalizePaymentLinkMode(value: string): PaymentLinkMode {
  return value === "external_registration" ? "external_registration" : "payment_only";
}

function getPaymentDeadlineDays(formData: FormData) {
  const rawValue = getOptionalString(formData, "payment_deadline_days");

  if (!rawValue) {
    return null;
  }

  const deadlineDays = Number(rawValue);
  return Number.isInteger(deadlineDays) && deadlineDays >= 0 && deadlineDays <= 60 ? deadlineDays : Number.NaN;
}

async function upsertEventPaymentSettings(
  supabase: AdminClient,
  input: {
    bankAccountName: string | null;
    bankAccountNumber: string | null;
    bankRegistrationNumber: string | null;
    deadlineDays: number | null;
    eventId: string;
    externalUrl: string | null;
    facilitatorId: string;
    instructions: string | null;
    paymentLinkMode: PaymentLinkMode;
    methodSource: PaymentMethodSource;
    mobilepayNumber: string | null;
  },
) {
  return supabase.from("event_payment_settings").upsert(
    {
      event_id: input.eventId,
      facilitator_id: input.facilitatorId,
      method_source: input.methodSource,
      payment_link_mode: input.paymentLinkMode,
      mobilepay_number: input.mobilepayNumber,
      bank_registration_number: input.bankRegistrationNumber,
      bank_account_number: input.bankAccountNumber,
      bank_account_name: input.bankAccountName,
      external_url: input.externalUrl,
      instructions: input.instructions,
      deadline_days: input.deadlineDays,
    },
    { onConflict: "event_id" },
  );
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

function eventImageExtension(file: File) {
  const allowedTypes = new Map([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
  ]);
  return allowedTypes.get(file.type) ?? null;
}

async function uploadEventGalleryImage(adminClient: AdminClient, eventId: string, file: File) {
  const extension = eventImageExtension(file);

  if (!extension) {
    throw new Error("Stemningsbilleder skal være JPG, PNG eller WebP. HEIC skal konverteres i browseren før upload.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Stemningsbilleder må højst være 10 MB pr. billede.");
  }

  const imagePath = "events/gallery/" + eventId + "/" + crypto.randomUUID() + "." + extension;
  const { error } = await adminClient.storage.from("media").upload(imagePath, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    console.error("Event gallery image upload error", error);
    throw new Error("Stemningsbilledet kunne ikke uploades.");
  }

  return imagePath;
}

async function removeEventGalleryStorageFiles(adminClient: AdminClient, imagePaths: string[]) {
  const uniquePaths = [...new Set(imagePaths.filter(Boolean))];

  if (uniquePaths.length === 0) {
    return;
  }

  const { error } = await adminClient.storage.from("media").remove(uniquePaths);

  if (error) {
    console.error("Event gallery image cleanup error", error);
  }
}

function imageContentTypeFromPath(imagePath: string) {
  const extension = imagePath.split(".").pop()?.toLowerCase();

  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

async function copyEventGalleryImages(adminClient: AdminClient, input: { sourceEventId: string; targetEventId: string }) {
  const { data: sourceImages, error: sourceImagesError } = await adminClient
    .from("event_images")
    .select("image_path, alt_text, sort_order")
    .eq("event_id", input.sourceEventId)
    .order("sort_order", { ascending: true })
    .limit(maxEventGalleryImages);

  if (sourceImagesError) {
    console.error("Event gallery image copy select error", sourceImagesError);
    return;
  }

  const copiedRows: Array<{ alt_text: string | null; event_id: string; image_path: string; sort_order: number }> = [];
  const uploadedPaths: string[] = [];

  for (const image of sourceImages ?? []) {
    if (!image.image_path) {
      continue;
    }

    const { data: fileData, error: downloadError } = await adminClient.storage.from("media").download(image.image_path);

    if (downloadError || !fileData) {
      console.error("Event gallery image copy download error", downloadError);
      continue;
    }

    const extension = image.image_path.split(".").pop()?.toLowerCase() || "jpg";
    const imagePath = "events/gallery/" + input.targetEventId + "/" + crypto.randomUUID() + "." + extension;
    const { error: uploadError } = await adminClient.storage.from("media").upload(imagePath, fileData, {
      cacheControl: "3600",
      contentType: imageContentTypeFromPath(image.image_path),
      upsert: false,
    });

    if (uploadError) {
      console.error("Event gallery image copy upload error", uploadError);
      continue;
    }

    uploadedPaths.push(imagePath);
    copiedRows.push({
      alt_text: image.alt_text ?? null,
      event_id: input.targetEventId,
      image_path: imagePath,
      sort_order: copiedRows.length,
    });
  }

  if (copiedRows.length === 0) {
    return;
  }

  const { error: insertError } = await adminClient.from("event_images").insert(copiedRows);

  if (insertError) {
    console.error("Event gallery image copy insert error", insertError);
    await removeEventGalleryStorageFiles(adminClient, uploadedPaths);
  }
}

async function syncEventGalleryImages(adminClient: AdminClient, formData: FormData, input: { eventId: string; title: string }) {
  const requestedCount = Number(getOptionalString(formData, "event_gallery_image_count") ?? 0);

  if (!Number.isFinite(requestedCount) || requestedCount < 0 || requestedCount > maxEventGalleryImages) {
    throw new Error("Du kan højst tilføje tre stemningsbilleder.");
  }

  const { data: existingRows, error: existingError } = await adminClient
    .from("event_images")
    .select("id, image_path, sort_order")
    .eq("event_id", input.eventId);

  if (existingError) {
    console.error("Event gallery image select error", existingError);
    throw new Error("Stemningsbillederne kunne ikke hentes.");
  }

  const existingImagesByPath = new Map((existingRows ?? []).filter((row) => row.image_path).map((row) => [row.image_path, row]));
  const existingPaths = new Set(existingImagesByPath.keys());
  const finalRows: Array<{ alt_text: string; event_id: string; id?: string; image_path: string; sort_order: number }> = [];
  const uploadedPaths: string[] = [];

  for (let index = 0; index < maxEventGalleryImages; index += 1) {
    const existingPath = getOptionalString(formData, `event_gallery_existing_image_${index}`);
    const file = formData.get(`event_gallery_file_${index}`);

    if (file instanceof File && file.size > 0) {
      const imagePath = await uploadEventGalleryImage(adminClient, input.eventId, file);
      uploadedPaths.push(imagePath);
      finalRows.push({
        alt_text: "Stemningsbillede fra " + input.title,
        event_id: input.eventId,
        image_path: imagePath,
        sort_order: finalRows.length,
      });
      continue;
    }

    if (existingPath && existingImagesByPath.has(existingPath)) {
      const existingImage = existingImagesByPath.get(existingPath);
      finalRows.push({
        alt_text: "Stemningsbillede fra " + input.title,
        event_id: input.eventId,
        id: existingImage?.id,
        image_path: existingPath,
        sort_order: finalRows.length,
      });
    }
  }

  if (finalRows.length > maxEventGalleryImages) {
    await removeEventGalleryStorageFiles(adminClient, uploadedPaths);
    throw new Error("Du kan højst tilføje tre stemningsbilleder.");
  }

  const finalPaths = new Set(finalRows.map((row) => row.image_path));
  const removedPaths = [...existingPaths].filter((imagePath) => !finalPaths.has(imagePath));
  const newRows = finalRows.filter((row) => !row.id).map(({ id: _id, ...row }) => row);
  const existingRowsToUpdate = finalRows.filter((row) => row.id);

  for (const row of existingRowsToUpdate) {
    const { error: updateError } = await adminClient
      .from("event_images")
      .update({
        alt_text: row.alt_text,
        sort_order: row.sort_order,
      })
      .eq("id", row.id)
      .eq("event_id", input.eventId);

    if (updateError) {
      await removeEventGalleryStorageFiles(adminClient, uploadedPaths);
      console.error("Event gallery image update error", updateError);
      throw new Error("Stemningsbillederne kunne ikke opdateres.");
    }
  }

  if (newRows.length > 0) {
    const { error: insertError } = await adminClient.from("event_images").insert(newRows);

    if (insertError) {
      await removeEventGalleryStorageFiles(adminClient, uploadedPaths);
      console.error("Event gallery image insert error", insertError);
      throw new Error("Stemningsbillederne kunne ikke gemmes.");
    }
  }

  if (removedPaths.length > 0) {
    const { error: deleteError } = await adminClient
      .from("event_images")
      .delete()
      .eq("event_id", input.eventId)
      .in("image_path", removedPaths);

    if (deleteError) {
      console.error("Event gallery image delete error", deleteError);
      throw new Error("Stemningsbillederne blev gemt, men slettede billeder kunne ikke fjernes fra listen.");
    }
  }

  await removeEventGalleryStorageFiles(adminClient, removedPaths);
}

function hasSubmittedEventCoverImage(formData: FormData) {
  const file = formData.get("event_cover_file");
  return file instanceof File && file.size > 0;
}

function toDateTime(date: string, time: string) {
  const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = time.match(/^(\d{2}):(\d{2})$/);

  if (!dateMatch || !timeMatch) {
    return "";
  }

  return utcFromDanishLocalTime({
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
    month: Number(dateMatch[2]),
    second: 0,
    year: Number(dateMatch[1]),
  }).toISOString();
}

function defaultDraftDateTimes(now = new Date()) {
  const todayParts = getDanishDateTimeParts(now);
  const targetDate = addDanishCalendarDays(todayParts, 1);
  const startsAt = utcFromDanishLocalTime({
    ...targetDate,
    hour: 19,
    minute: 0,
    second: 0,
  });
  const endsAt = utcFromDanishLocalTime({
    ...targetDate,
    hour: 21,
    minute: 0,
    second: 0,
  });

  return {
    endsAt: endsAt.toISOString(),
    startsAt: startsAt.toISOString(),
  };
}

function endDateTimeAfterStart(startsAt: string) {
  return new Date(new Date(startsAt).getTime() + 2 * 60 * 60 * 1000).toISOString();
}

function getDanishDateTimeParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: danishTimeZone,
    year: "numeric",
  }).formatToParts(value);
  const partValue = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    day: partValue("day"),
    hour: partValue("hour"),
    minute: partValue("minute"),
    month: partValue("month"),
    second: partValue("second"),
    year: partValue("year"),
  };
}

function utcFromDanishLocalTime(input: {
  day: number;
  hour: number;
  minute: number;
  month: number;
  second: number;
  year: number;
}) {
  const utcGuess = new Date(Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute, input.second));
  const guessParts = getDanishDateTimeParts(utcGuess);
  const guessedLocalAsUtc = Date.UTC(
    guessParts.year,
    guessParts.month - 1,
    guessParts.day,
    guessParts.hour,
    guessParts.minute,
    guessParts.second,
  );
  const targetLocalAsUtc = Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute, input.second);
  const offset = guessedLocalAsUtc - utcGuess.getTime();

  return new Date(targetLocalAsUtc - offset);
}

function addDanishCalendarDays(
  input: {
    day: number;
    month: number;
    year: number;
  },
  days: number,
) {
  const date = new Date(Date.UTC(input.year, input.month - 1, input.day + days));

  return {
    day: date.getUTCDate(),
    month: date.getUTCMonth() + 1,
    year: date.getUTCFullYear(),
  };
}

function daysBetweenDanishDates(
  start: {
    day: number;
    month: number;
    year: number;
  },
  end: {
    day: number;
    month: number;
    year: number;
  },
) {
  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);

  return Math.max(0, Math.round((endUtc - startUtc) / 86_400_000));
}

function copiedEventDateTimes(sourceStartsAt: string, sourceEndsAt: string) {
  const sourceStart = new Date(sourceStartsAt);
  const sourceEnd = new Date(sourceEndsAt);
  const sourceStartParts = getDanishDateTimeParts(sourceStart);
  const sourceEndParts = getDanishDateTimeParts(sourceEnd);
  const todayParts = getDanishDateTimeParts(new Date());
  const targetStartDate = addDanishCalendarDays(todayParts, 7);
  const endDateOffset = daysBetweenDanishDates(sourceStartParts, sourceEndParts);
  const targetEndDate = addDanishCalendarDays(targetStartDate, endDateOffset);
  const startsAt = utcFromDanishLocalTime({
    ...targetStartDate,
    hour: sourceStartParts.hour,
    minute: sourceStartParts.minute,
    second: sourceStartParts.second,
  });
  let endsAt = utcFromDanishLocalTime({
    ...targetEndDate,
    hour: sourceEndParts.hour,
    minute: sourceEndParts.minute,
    second: sourceEndParts.second,
  });

  if (endsAt <= startsAt) {
    endsAt = new Date(startsAt.getTime() + Math.max(sourceEnd.getTime() - sourceStart.getTime(), 60 * 60 * 1000));
  }

  return {
    endsAt: endsAt.toISOString(),
    startsAt: startsAt.toISOString(),
  };
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

type CoOrganizerCandidateRow = {
  categoryIds?: string[];
  city: string | null;
  company_name: string | null;
  facilitator_categories?: Array<{
    category_id?: string | null;
    categories?: { name: string | null } | { name: string | null }[] | null;
  }> | null;
  host_reference_id?: string | null;
  id: string;
  is_disabled?: boolean | null;
  is_paused?: boolean | null;
  postal_code?: string | null;
  profile_id?: string | null;
  profile_image_path: string | null;
  profiles?: { email?: string | null; full_name?: string | null } | { email?: string | null; full_name?: string | null }[] | null;
  status?: string | null;
  short_description?: string | null;
  specialties: string | null;
};

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function coOrganizerDisplayName(row: { company_name?: string | null; profiles?: { full_name?: string | null } | { full_name?: string | null }[] | null }) {
  const profile = firstRelation(row.profiles);
  return row.company_name || profile?.full_name || "Arrangør";
}

function coOrganizerInvitationUrl(token: string) {
  return appUrl("/facilitator/co-organizer-invitations/" + token);
}

function coOrganizerCategoryIds(row: {
  categoryIds?: string[];
  facilitator_categories?: Array<{ category_id?: string | null }> | null;
}) {
  return row.categoryIds ?? row.facilitator_categories?.map((relation) => relation.category_id).filter((id): id is string => Boolean(id)) ?? [];
}

function coOrganizerPublicEligibility(row: CoOrganizerCandidateRow) {
  const profile = firstRelation(row.profiles);
  const eligibility = getFacilitatorPublicEligibility({
    categoryIds: coOrganizerCategoryIds(row),
    city: row.city,
    companyName: row.company_name,
    fullName: profile?.full_name,
    hostReferenceId: row.host_reference_id,
    isDisabled: row.is_disabled,
    isPaused: row.is_paused,
    postalCode: row.postal_code,
    profileImagePath: row.profile_image_path,
    shortDescription: row.short_description,
    status: row.status,
  });
  const missing = eligibility.missing.filter((key) => key !== "short_description");

  return {
    isEligible: missing.length === 0,
    missing,
  };
}

function isEligibleCoOrganizer(row: CoOrganizerCandidateRow) {
  return coOrganizerPublicEligibility(row).isEligible;
}

async function createCoOrganizerInvitations(
  supabase: AdminClient,
  input: {
    eventId: string;
    eventStartsAt: string;
    eventTitle: string;
    invitedByUserId: string;
    primaryOrganizerName: string;
    primaryOrganizerProfileId: string;
    requestedProfileIds: string[];
  },
) {
  const requestedProfileIds = Array.from(new Set(input.requestedProfileIds.filter(Boolean)));

  if (requestedProfileIds.length === 0) {
    return;
  }

  if (requestedProfileIds.includes(input.primaryOrganizerProfileId)) {
    eventFormRedirect("Du kan ikke invitere dig selv som medarrangør.", { eventId: input.eventId });
  }

  const { data: existingRows } = await supabase
    .from("event_co_organizers")
    .select("co_organizer_profile_id, status")
    .eq("event_id", input.eventId)
    .in("status", [...activeCoOrganizerStatuses]);
  const existingProfileIds = new Set((existingRows ?? []).map((row) => row.co_organizer_profile_id));
  const newProfileIds = requestedProfileIds.filter((profileId) => !existingProfileIds.has(profileId));

  if (existingProfileIds.size + newProfileIds.length > 2) {
    eventFormRedirect("Du kan højst invitere to medarrangører til et event.", { eventId: input.eventId });
  }

  if (newProfileIds.length === 0) {
    return;
  }

  const { data: candidates, error: candidateError } = await supabase
    .from("facilitator_profiles")
    .select("id, profile_id, status, is_paused, is_disabled, host_reference_id, company_name, profile_image_path, short_description, city, postal_code, facilitator_categories(category_id), profiles!facilitator_profiles_profile_id_fkey(email, full_name)")
    .in("id", newProfileIds)
    .eq("status", "approved")
    .eq("is_paused", false)
    .eq("is_disabled", false);

  if (candidateError) {
    console.error("Co-organizer candidate lookup failed", {
      eventId: input.eventId,
      message: candidateError.message,
    });
    eventFormRedirect("Medarrangører kunne ikke valideres lige nu.", { eventId: input.eventId });
  }

  const eligibleCandidates = [];
  for (const candidate of (candidates ?? []) as CoOrganizerCandidateRow[]) {
    if (isEligibleCoOrganizer(candidate)) {
      eligibleCandidates.push(candidate);
    } else {
      console.error("Co-organizer candidate rejected by public eligibility", {
        candidateId: candidate.id,
        missing: coOrganizerPublicEligibility(candidate).missing,
      });
    }
  }

  const candidateMap = new Map(eligibleCandidates.map((candidate) => [candidate.id, candidate]));
  const invalidProfileIds = newProfileIds.filter((profileId) => !candidateMap.has(profileId));

  if (invalidProfileIds.length > 0) {
    eventFormRedirect("Denne arrangørprofil kan ikke længere inviteres. Profilen er muligvis sat på pause, deaktiveret eller ikke fuldt oprettet.", { eventId: input.eventId });
  }

  const missingRecipientProfileIds = newProfileIds.filter((profileId) => {
    const candidate = candidateMap.get(profileId);
    const candidateProfile = firstRelation(candidate?.profiles);
    return !candidateProfile?.email;
  });

  if (missingRecipientProfileIds.length > 0) {
    console.error("Co-organizer invitation recipient email missing", {
      eventId: input.eventId,
      profileIds: missingRecipientProfileIds,
    });
    eventFormRedirect("Medarrangørinvitationen kunne ikke sendes, fordi modtagerens e-mail mangler.", { eventId: input.eventId });
  }

  const { data: insertedRows, error: insertError } = await supabase
    .from("event_co_organizers")
    .insert(
      newProfileIds.map((profileId) => ({
        co_organizer_profile_id: profileId,
        event_id: input.eventId,
        invited_by_user_id: input.invitedByUserId,
        primary_organizer_profile_id: input.primaryOrganizerProfileId,
        status: "pending",
      })),
    )
    .select("id, co_organizer_profile_id, response_token");

  if (insertError) {
    console.error("Co-organizer invitation insert failed", {
      eventId: input.eventId,
      message: insertError.message,
    });
    eventFormRedirect("Medarrangørinvitationen kunne ikke gemmes.", { eventId: input.eventId });
  }

  const failedInvitationIds: string[] = [];

  for (const row of insertedRows ?? []) {
    const candidate = candidateMap.get(row.co_organizer_profile_id);
    const candidateProfile = firstRelation(candidate?.profiles);
    const recipientEmail = candidateProfile?.email;

    if (!candidate || !recipientEmail) {
      console.error("Co-organizer invitation mail skipped after insert", {
        eventId: input.eventId,
        invitationId: row.id,
        missingCandidate: !candidate,
        missingRecipientEmail: !recipientEmail,
      });
      failedInvitationIds.push(row.id);
      continue;
    }

    const mailSent = await sendCoOrganizerInvitationEmail({
      eventId: input.eventId,
      eventStartsAt: input.eventStartsAt,
      eventTitle: input.eventTitle,
      invitationUrl: coOrganizerInvitationUrl(row.response_token),
      primaryOrganizerName: input.primaryOrganizerName,
      recipientEmail,
      recipientName: coOrganizerDisplayName(candidate),
    });

    if (!mailSent) {
      console.error("Co-organizer invitation mail failed", {
        eventId: input.eventId,
        invitationId: row.id,
      });
      failedInvitationIds.push(row.id);
    }
  }

  if (failedInvitationIds.length > 0) {
    const { error: cancelFailedInvitationsError } = await supabase
      .from("event_co_organizers")
      .update({
        cancelled_at: new Date().toISOString(),
        status: "cancelled",
      })
      .in("id", failedInvitationIds);

    if (cancelFailedInvitationsError) {
      console.error("Failed co-organizer invitations could not be cancelled", {
        eventId: input.eventId,
        invitationIds: failedInvitationIds,
        message: cancelFailedInvitationsError.message,
      });
    }

    eventFormRedirect("Eventet blev gemt, men medarrangørinvitationen kunne ikke sendes. Prøv at invitere medarrangøren igen.", { eventId: input.eventId });
  }
}

async function validateActiveCoOrganizersForPublication(
  supabase: AdminClient,
  input: {
    eventId: string;
    primaryOrganizerProfileId: string;
  },
) {
  const { data: coOrganizerRows, error } = await supabase
    .from("event_co_organizers")
    .select(
      "id, status, co_organizer_profile_id, facilitator_profiles!event_co_organizers_co_organizer_profile_id_fkey(id, profile_id, status, is_paused, is_disabled, host_reference_id, company_name, profile_image_path, short_description, city, postal_code, facilitator_categories(category_id), profiles!facilitator_profiles_profile_id_fkey(full_name))",
    )
    .eq("event_id", input.eventId)
    .eq("primary_organizer_profile_id", input.primaryOrganizerProfileId)
    .in("status", [...activeCoOrganizerStatuses]);

  if (error) {
    console.error("Co-organizer publication validation failed", {
      eventId: input.eventId,
      message: error.message,
    });
    eventFormRedirect("Medarrangørerne kunne ikke valideres lige nu.", { eventId: input.eventId, step: "0" });
  }

  const invalidRows: Array<{ co_organizer_profile_id: string }> = [];

  for (const row of coOrganizerRows ?? []) {
    const coOrganizerProfile = firstRelation(row.facilitator_profiles);
    if (!coOrganizerProfile || !isEligibleCoOrganizer(coOrganizerProfile as CoOrganizerCandidateRow)) {
      invalidRows.push(row);
    }
  }

  if (invalidRows.length > 0) {
    console.error("Inactive co-organizer blocked event publication", {
      eventId: input.eventId,
      invalidCoOrganizerProfileIds: invalidRows.map((row) => row.co_organizer_profile_id),
    });
    eventFormRedirect("Denne arrangørprofil kan ikke længere inviteres. Profilen er muligvis sat på pause, deaktiveret eller ikke fuldt oprettet.", {
      eventId: input.eventId,
      step: "0",
    });
  }
}

async function validateRequestedCoOrganizerProfileIds(
  supabase: AdminClient,
  input: {
    eventId?: string | null;
    primaryOrganizerProfileId: string;
    requestedProfileIds: string[];
  },
) {
  const requestedProfileIds = Array.from(new Set(input.requestedProfileIds.filter(Boolean)));

  if (requestedProfileIds.length === 0) {
    return;
  }

  if (requestedProfileIds.includes(input.primaryOrganizerProfileId)) {
    eventFormRedirect("Du kan ikke invitere dig selv som medarrangør.", { eventId: input.eventId, step: "0" });
  }

  const { data: candidates, error } = await supabase
    .from("facilitator_profiles")
    .select("id, profile_id, status, is_paused, is_disabled, host_reference_id, company_name, profile_image_path, short_description, city, postal_code, facilitator_categories(category_id), profiles!facilitator_profiles_profile_id_fkey(full_name)")
    .in("id", requestedProfileIds);

  if (error) {
    console.error("Requested co-organizer validation failed", {
      eventId: input.eventId ?? null,
      message: error.message,
    });
    eventFormRedirect("Medarrangørerne kunne ikke valideres lige nu.", { eventId: input.eventId, step: "0" });
  }

  const validProfileIds = new Set<string>();
  for (const candidate of (candidates ?? []) as CoOrganizerCandidateRow[]) {
    if (isEligibleCoOrganizer(candidate)) {
      validProfileIds.add(candidate.id);
    }
  }
  const invalidProfileIds = requestedProfileIds.filter((profileId) => !validProfileIds.has(profileId));

  if (invalidProfileIds.length > 0) {
    console.error("Inactive requested co-organizer blocked event publication", {
      eventId: input.eventId ?? null,
      invalidCoOrganizerProfileIds: invalidProfileIds,
    });
    eventFormRedirect("Denne arrangørprofil kan ikke længere inviteres. Profilen er muligvis sat på pause, deaktiveret eller ikke fuldt oprettet.", { eventId: input.eventId, step: "0" });
  }
}

async function notifySubscribersWithoutBlockingPublication(eventId: string) {
  try {
    await notifyFacilitatorEventReminderSubscribers(eventId);
  } catch (error) {
    console.error("Facilitator event reminder notification failed after publication", {
      eventId,
      message: error instanceof Error ? error.message : "Ukendt fejl.",
    });
  }
}

export async function searchCoOrganizerCandidatesAction(query: string, eventId?: string | null) {
  const profile = await requireRole("facilitator");
  const supabase = createAdminClient();
  const normalizedQuery = query.trim();

  if (normalizedQuery.length < 2) {
    return [];
  }

  const { data: facilitatorProfile } = await supabase
    .from("facilitator_profiles")
    .select("id")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!facilitatorProfile) {
    return [];
  }

  const excludedProfileIds = new Set<string>([facilitatorProfile.id]);
  let existingCoOrganizerMatches: Array<{
    categories: string[];
    city: string | null;
    id: string;
    imageUrl: string | null;
    name: string;
    profileId: string;
    profileIsActive: boolean;
    status: ActiveCoOrganizerStatus;
  }> = [];

  if (eventId) {
    const { data: existingRows } = await supabase
      .from("event_co_organizers")
      .select(
        "id, status, co_organizer_profile_id, facilitator_profiles!event_co_organizers_co_organizer_profile_id_fkey(id, status, is_paused, is_disabled, company_name, profile_image_path, city, facilitator_categories(categories(name)), profiles!facilitator_profiles_profile_id_fkey(full_name))",
      )
      .eq("event_id", eventId)
      .in("status", [...activeCoOrganizerStatuses]);
    for (const row of existingRows ?? []) {
      excludedProfileIds.add(row.co_organizer_profile_id);
    }

    existingCoOrganizerMatches = ((existingRows ?? []) as any[])
      .map((row) => {
        const coOrganizerProfile = firstRelation(row.facilitator_profiles);
        const coOrganizerUser = firstRelation(coOrganizerProfile?.profiles);
        const categories =
          coOrganizerProfile?.facilitator_categories
            ?.map((categoryRow: any) => firstRelation(categoryRow.categories)?.name)
            .filter((name: string | null | undefined): name is string => Boolean(name)) ?? [];
        const profileIsActive =
          coOrganizerProfile?.status === "approved" &&
          !coOrganizerProfile.is_paused &&
          !coOrganizerProfile.is_disabled;
        const name = coOrganizerProfile?.company_name || coOrganizerUser?.full_name || "Arrangør";
        const haystack = [name, coOrganizerProfile?.city, ...categories].filter(Boolean).join(" ").toLowerCase();

        if (!haystack.includes(normalizedQuery.toLowerCase())) {
          return null;
        }

        return {
          categories: categories.slice(0, 3),
          city: coOrganizerProfile?.city ?? null,
          id: row.id,
          imageUrl: coOrganizerProfile?.profile_image_path
            ? supabase.storage.from("media").getPublicUrl(coOrganizerProfile.profile_image_path).data.publicUrl
            : null,
          name,
          profileId: row.co_organizer_profile_id,
          profileIsActive,
          status: row.status,
        };
      })
      .filter(
        (
          match,
        ): match is {
          categories: string[];
          city: string | null;
          id: string;
          imageUrl: string | null;
          name: string;
          profileId: string;
          profileIsActive: boolean;
          status: ActiveCoOrganizerStatus;
        } => Boolean(match),
      );
  }

  const { data, error } = await supabase
    .from("facilitator_profiles")
    .select(
      "id, profile_id, host_reference_id, status, is_paused, is_disabled, company_name, profile_image_path, short_description, city, postal_code, specialties, facilitator_categories(category_id, categories(name)), profiles!facilitator_profiles_profile_id_fkey(full_name)",
    )
    .eq("status", "approved")
    .eq("is_paused", false)
    .eq("is_disabled", false)
    .limit(100);

  if (error) {
    console.error("Co-organizer search failed", { message: error.message });
    return { candidates: [], existingMatches: existingCoOrganizerMatches };
  }

  const normalizedNeedle = normalizedQuery.toLowerCase();

  const matchedCandidates = ((data ?? []) as CoOrganizerCandidateRow[])
    .filter((candidate) => {
      if (excludedProfileIds.has(candidate.id)) {
        return false;
      }

      if (!coOrganizerPublicEligibility(candidate).isEligible) {
        return false;
      }

      const profile = firstRelation(candidate.profiles);
      const categories =
        candidate.facilitator_categories
          ?.map((row) => firstRelation(row.categories)?.name)
          .filter((name): name is string => Boolean(name)) ?? [];
      const haystack = [
        candidate.company_name,
        candidate.city,
        candidate.specialties,
        profile?.full_name,
        ...categories,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedNeedle);
    });

  const candidates = matchedCandidates
    .slice(0, 8)
    .map((candidate) => {
      const profileImageUrl = candidate.profile_image_path
        ? supabase.storage.from("media").getPublicUrl(candidate.profile_image_path).data.publicUrl
        : null;
      const categories =
        candidate.facilitator_categories
          ?.map((row) => firstRelation(row.categories)?.name)
          .filter((name): name is string => Boolean(name))
          .slice(0, 3) ?? [];

      return {
        categories,
        city: candidate.city,
        id: candidate.id,
        imageUrl: profileImageUrl,
        name: coOrganizerDisplayName(candidate),
        specialties: candidate.specialties,
      };
    });

  return {
    candidates,
    existingMatches: existingCoOrganizerMatches,
  };
}

async function createUniqueEventSlug(supabase: AdminClient, baseSlug: string) {
  const cleanBaseSlug = baseSlug || "event";
  let candidate = cleanBaseSlug;

  for (let suffix = 2; suffix < 100; suffix += 1) {
    const [{ data: existingEvent }, { data: existingSlugAlias }] = await Promise.all([
      supabase.from("events").select("id").eq("slug", candidate).maybeSingle(),
      supabase.from("event_slug_history").select("event_id").eq("slug", candidate).maybeSingle(),
    ]);

    if (!existingEvent && !existingSlugAlias) {
      return candidate;
    }

    candidate = cleanBaseSlug + "-" + suffix;
  }

  return cleanBaseSlug + "-" + crypto.randomUUID().slice(0, 8);
}

async function createUniqueEventSlugForEvent(supabase: AdminClient, baseSlug: string, eventId: string) {
  const cleanBaseSlug = baseSlug || "event";
  let candidate = cleanBaseSlug;

  for (let suffix = 2; suffix < 100; suffix += 1) {
    const [{ data: existingEvent }, { data: existingSlugAlias }] = await Promise.all([
      supabase.from("events").select("id").eq("slug", candidate).neq("id", eventId).maybeSingle(),
      supabase.from("event_slug_history").select("event_id").eq("slug", candidate).neq("event_id", eventId).maybeSingle(),
    ]);

    if (!existingEvent && !existingSlugAlias) {
      return candidate;
    }

    candidate = cleanBaseSlug + "-" + suffix;
  }

  return cleanBaseSlug + "-" + crypto.randomUUID().slice(0, 8);
}

function hasEventBeenPublic(status: EventStatus | null, publishedAt: string | null) {
  return Boolean(publishedAt) || ["active", "sold_out", "cancelled", "completed", "archived"].includes(status ?? "");
}

function isProfileReady(input: {
  categoryIds: string[];
  city: string | null;
  companyName: string | null;
  fullName: string | null;
  postalCode: string | null;
  shortDescription: string | null;
}) {
  return getFacilitatorProfileReadiness(input).isComplete;
}

export async function createEventAction(formData: FormData) {
  const supabase = createAdminClient();
  const isAdminEventEdit = getString(formData, "admin_event_edit") === "yes";
  const adminReturnTo = getOptionalString(formData, "admin_return_to");
  const existingEventId = getOptionalString(formData, "event_id");
  const actorProfile = isAdminEventEdit ? await requireRole("admin") : await requireProfile();
  const redirectWithMessage = (message: string): never => {
    if (isAdminEventEdit) {
      adminEventEditRedirect(message, existingEventId, adminReturnTo);
    }

    eventsRedirect(message);
  };

  if (!isAdminEventEdit && actorProfile.role !== "facilitator") {
    redirect("/dashboard");
  }

  if (isAdminEventEdit && !existingEventId) {
    adminEventEditRedirect("Eventet kunne ikke genkendes.", existingEventId, adminReturnTo);
  }

  let initialFacilitatorProfile = null;
  let facilitatorLookupError = null;
  let profile = actorProfile;

  if (isAdminEventEdit && existingEventId) {
    const { data: eventForAdmin, error: adminEventLookupError } = await supabase
      .from("events")
      .select(
        "id, facilitator_id, facilitator_profiles!events_facilitator_id_fkey(" +
          facilitatorProfileEventSelect +
          ")",
      )
      .eq("id", existingEventId)
      .maybeSingle();

    if (adminEventLookupError || !eventForAdmin) {
      adminEventEditRedirect("Eventet kunne ikke findes.", existingEventId, adminReturnTo);
    }

    const adminEventRow = eventForAdmin as any;
    const adminFacilitatorProfile = Array.isArray(adminEventRow.facilitator_profiles)
      ? adminEventRow.facilitator_profiles[0]
      : adminEventRow.facilitator_profiles;
    initialFacilitatorProfile = adminFacilitatorProfile ?? null;
    const ownerProfile = Array.isArray(adminFacilitatorProfile?.profiles)
      ? adminFacilitatorProfile?.profiles[0]
      : adminFacilitatorProfile?.profiles;

    profile = {
      ...actorProfile,
      full_name: ownerProfile?.full_name ?? adminFacilitatorProfile?.company_name ?? actorProfile.full_name,
      id: adminFacilitatorProfile?.profile_id ?? actorProfile.id,
      phone: ownerProfile?.phone ?? null,
    };
  } else {
    const result = await supabase
      .from("facilitator_profiles")
      .select(facilitatorProfileEventSelect)
      .eq("profile_id", actorProfile.id)
      .maybeSingle();
    initialFacilitatorProfile = result.data;
    facilitatorLookupError = result.error;
  }

  let facilitatorProfile = initialFacilitatorProfile;

  if (facilitatorLookupError) {
    redirectWithMessage("Arrangørprofilen kunne ikke hentes. Tjek at Supabase-migrationerne er kørt.");
  }

  if (!facilitatorProfile) {
    if (isAdminEventEdit) {
      adminEventEditRedirect("Arrangørprofilen kunne ikke hentes.", existingEventId, adminReturnTo);
    }
    redirect("/auth/oauth-profile");
  }

  const { data: facilitatorPaymentSettings } = await supabase
    .from("facilitator_payment_settings")
    .select("*")
    .eq("facilitator_id", facilitatorProfile.id)
    .maybeSingle();

  const onboardingState = isAdminEventEdit
    ? "approved"
    : await getFacilitatorOnboardingStateForProfile(supabase, {
        fullName: profile.full_name,
        profileId: profile.id,
      });

  if (onboardingState === "onboarding" || onboardingState === "changes_requested") {
    redirectWithMessage("Færdiggør og indsend din arrangørprofil, før du opretter events.");
  }

  const requestedStatusValues = getAllStrings(formData, "status");
  const requestedStatus = (requestedStatusValues.includes("draft")
    ? "draft"
    : requestedStatusValues[0] || getString(formData, "status")) as EventStatus;
  const notifyParticipants = !isAdminEventEdit && getString(formData, "notify_participants") === "yes";
  const participantUpdateMessage = getOptionalString(formData, "participant_update_message");
  const currentStep = getString(formData, "current_step") || "0";
  const safeStep = ["0", "1", "2", "3", "4"].includes(currentStep) ? currentStep : "0";
  const requestedCoOrganizerProfileIds = getAllStrings(formData, "co_organizer_profile_ids");

  if (!allowedStatuses.includes(requestedStatus)) {
    redirectWithMessage("Ugyldig eventstatus.");
  }

  if (participantUpdateMessage && participantUpdateMessage.length > 500) {
    redirectWithMessage("Beskeden til deltagerne må højst være 500 tegn.");
  }

  let existingEventStatus: EventStatus | null = null;
  let existingEventSlug: string | null = null;
  let existingEventTitle: string | null = null;
  let existingEventPublishedAt: string | null = null;
  let existingEventCoverImagePath: string | null = null;
  let existingEventRegistrationMode: EventRegistrationMode | null = null;
  let previousEventSnapshot: EventUpdateSnapshot | null = null;

  if (existingEventId) {
    let existingEventQuery = supabase
      .from("events")
      .select("id, slug, status, published_at, cover_image_path, title, starts_at, ends_at, address_line, postal_code, city, country, price_cents, capacity, registration_mode, event_format, online_description, online_url_or_note")
      .eq("id", existingEventId);

    if (!isAdminEventEdit) {
      existingEventQuery = existingEventQuery.eq("facilitator_id", facilitatorProfile.id);
    }

    const { data: existingEvent } = await existingEventQuery.maybeSingle();

    if (!existingEvent) {
      if (isAdminEventEdit) {
        adminEventEditRedirect("Eventet kunne ikke findes.", existingEventId, adminReturnTo);
      }
      redirectWithMessage("Eventet kunne ikke findes.");
    }

    const foundExistingEvent = existingEvent!;
    existingEventStatus = foundExistingEvent.status as EventStatus;
    existingEventSlug = foundExistingEvent.slug ?? null;
    existingEventTitle = foundExistingEvent.title ?? null;
    existingEventPublishedAt = foundExistingEvent.published_at ?? null;
    existingEventCoverImagePath = foundExistingEvent.cover_image_path ?? null;
    existingEventRegistrationMode = normalizeRegistrationMode(foundExistingEvent.registration_mode ?? "");
    previousEventSnapshot = foundExistingEvent as EventUpdateSnapshot;
  }

  const preservedPublishedStatus =
    existingEventStatus && ["active", "sold_out"].includes(existingEventStatus) ? existingEventStatus : null;
  const shouldPreservePublishedStatus =
    Boolean(preservedPublishedStatus) && requestedStatus !== "draft";
  let status: EventStatus = requestedStatus === "pending_review" ? "active" : requestedStatus;

  if (shouldPreservePublishedStatus && preservedPublishedStatus) {
    status = preservedPublishedStatus;
  }

  const isDraft = status === "draft";
  const wasPublishedDirectly = !shouldPreservePublishedStatus && ["active", "pending_review"].includes(requestedStatus) && status === "active";

  const facilitatorCategoryIds =
    facilitatorProfile.facilitator_categories?.map((row: { category_id: string }) => row.category_id) ?? [];

  if (!isDraft && (facilitatorProfile.status !== "approved" || facilitatorProfile.is_paused || facilitatorProfile.is_disabled)) {
    redirectWithMessage(
      "Din arrangørprofil skal være aktiv og godkendt, før eventet kan offentliggøres. Gem eventet som kladde indtil da.",
    );
  }

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
      redirectWithMessage("Færdiggør din profil, før du offentliggør eventet.");
  }

  if (!allowedStatuses.includes(status)) {
    redirectWithMessage("Ugyldig eventstatus.");
  }

  if (!existingEventId && !isAdminEventEdit) {
    const limitStatus = await getFacilitatorEventLimitStatus(supabase, facilitatorProfile.id);

    if (isDraft && limitStatus.draftCount >= limitStatus.maxDraftEvents) {
      redirectWithMessage(draftLimitMessage(limitStatus.maxDraftEvents));
    }

    if (status === "active" && limitStatus.activeCount >= limitStatus.maxActiveEvents) {
      redirectWithMessage(activeLimitMessage(limitStatus.maxActiveEvents));
    }
  } else if (status === "active" && !shouldPreservePublishedStatus && !isAdminEventEdit) {
    const limitStatus = await getFacilitatorEventLimitStatus(supabase, facilitatorProfile.id, {
      excludeEventId: existingEventId,
    });

    if (limitStatus.activeCount >= limitStatus.maxActiveEvents) {
      redirectWithMessage(activeLimitMessage(limitStatus.maxActiveEvents));
    }
  }

  const rawTitle = getString(formData, "title");
  const title = rawTitle || (isDraft ? "Kladde uden titel" : "");
  const slugBase = createSlug(title || "kladde");
  const titleChangedForExistingEvent =
    Boolean(existingEventId) && normalizeTextForComparison(existingEventTitle) !== normalizeTextForComparison(title);
  const hasExistingEventBeenPublic = Boolean(existingEventId) && hasEventBeenPublic(existingEventStatus, existingEventPublishedAt);
  const nextEventSlug =
    existingEventId && titleChangedForExistingEvent && slugBase
      ? await createUniqueEventSlugForEvent(supabase, slugBase, existingEventId)
      : existingEventSlug;
  const eventDescription =
    getString(formData, "event_description") ||
    getString(formData, "long_description") ||
    getString(formData, "short_description");
  const shortDescription = eventDescription.slice(0, 220);
  const longDescription = eventDescription;
  const currentCoverImagePath = getOptionalString(formData, "current_cover_image_path") ?? existingEventCoverImagePath;
  const submittedStartsAt = toDateTime(getString(formData, "start_date"), getString(formData, "start_time"));
  const submittedEndsAt = toDateTime(getString(formData, "end_date"), getString(formData, "end_time"));
  const draftDateTimes = isDraft ? defaultDraftDateTimes() : null;
  const startsAt = submittedStartsAt || draftDateTimes?.startsAt || "";
  let endsAt = submittedEndsAt || (submittedStartsAt ? endDateTimeAfterStart(submittedStartsAt) : draftDateTimes?.endsAt) || "";
  const addressLine = getOptionalString(formData, "address_line");
  const postalCode = getOptionalString(formData, "postal_code");
  const city = getOptionalString(formData, "city");
  const country = getOptionalString(formData, "country") || "Danmark";
  let regionId = getOptionalString(formData, "region_id");
  const priceCents = getPriceCents(formData);
  const registrationMode = priceCents > 0 ? normalizeRegistrationMode(getString(formData, "registration_mode")) : "direct";
  const paymentMethodSource = priceCents > 0 ? normalizePaymentMethodSource(getString(formData, "payment_method_source")) : "none";
  const paymentLinkMode: PaymentLinkMode =
    priceCents > 0 && paymentMethodSource === "custom" ? normalizePaymentLinkMode(getString(formData, "payment_link_mode")) : "payment_only";
  const paymentMobilepayNumber = null;
  const paymentBankRegistrationNumber = null;
  const paymentBankAccountNumber = null;
  const paymentBankAccountName = null;
  const paymentExternalUrl = priceCents > 0 && paymentMethodSource === "custom" ? getOptionalString(formData, "payment_external_url") : null;
  const paymentInstructions =
    priceCents > 0 && !(paymentMethodSource === "custom" && paymentLinkMode === "external_registration")
      ? getOptionalString(formData, "payment_instructions")
      : null;
  const paymentDeadlineDays =
    priceCents > 0 && !(paymentMethodSource === "custom" && paymentLinkMode === "external_registration")
      ? getPaymentDeadlineDays(formData)
      : null;
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

  if (existingEventId && existingEventRegistrationMode && registrationMode !== existingEventRegistrationMode) {
    const { count: activeBookingCount } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("event_id", existingEventId)
      .in("status", ["pending", "confirmed"]);

    if ((activeBookingCount ?? 0) > 0) {
      redirectWithMessage("Tilmeldingsmodellen kan ikke ændres, når eventet allerede har reservationer eller tilmeldinger.");
    }
  }

  if (!allowedFormats.includes(eventFormat as "physical" | "online")) {
    redirectWithMessage("Vælg om eventet er fysisk eller online.");
  }

  const lengthChecks: Array<[string | null, number, string]> = [
    [currentCoverImagePath, 300, "Eventbillede"],
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
    [practicalInformation, 1500, "Praktiske oplysninger"],
    [paymentMobilepayNumber, 40, "MobilePay"],
    [paymentBankRegistrationNumber, 20, "Bank reg.nr."],
    [paymentBankAccountNumber, 40, "Bank kontonr."],
    [paymentBankAccountName, 120, "Kontonavn"],
    [paymentExternalUrl, 300, "Betalingslink"],
    [paymentInstructions, 800, "Betalingsinstruktioner"],
  ];

  for (const [value, maxLength, label] of lengthChecks) {
    if (value && value.length > maxLength) {
      redirectWithMessage(label + " må højst være " + maxLength + " tegn.");
    }
  }


  if (!isDraft && (!rawTitle || !slugBase)) {
    redirectWithMessage("Titel er påkrævet.");
  }

  if (rawTitle.length > 80) {
    redirectWithMessage("Eventtitel må højst være 80 tegn.");
  }

  if (!isDraft && (!eventDescription || eventDescription.length < 20)) {
    redirectWithMessage("Beskrivelse af event skal være mindst 20 tegn.");
  }

  if (eventDescription.length > maxEventDescriptionLength) {
    redirectWithMessage("Beskrivelse af event må højst være " + formattedMaxEventDescriptionLength + " tegn.");
  }

  if ((status === "active" || status === "sold_out") && !currentCoverImagePath && !hasSubmittedEventCoverImage(formData)) {
    redirectWithMessage(missingCoverPublishMessage);
  }

  if (isDraft && startsAt && (!endsAt || new Date(endsAt) <= new Date(startsAt))) {
    endsAt = endDateTimeAfterStart(startsAt);
  }

  if (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt)) {
    redirectWithMessage("Sluttidspunkt skal være efter starttidspunkt.");
  }

  if (capacityText && !/^\d{1,3}$/.test(capacityText)) {
    redirectWithMessage("Antal deltagere skal være et tal på højst 3 cifre.");
  }

  if (!isDraft && capacity <= 0) {
    redirectWithMessage("Kapacitet skal være mindst 1.");
  }

  if (capacity > 500) {
    redirectWithMessage("Maks. antal deltagere er 500.");
  }

  if (existingEventId && capacity > 0) {
    const availableSeats = await getAvailableEventSeats(supabase, existingEventId, capacity);

    if (availableSeats === 0) {
      const availableWithLargeCapacity = await getAvailableEventSeats(supabase, existingEventId, 500);
      const reservedSeats = Math.max(500 - availableWithLargeCapacity, 0);

      if (reservedSeats > capacity) {
        const message =
          "Kapaciteten kan ikke sættes lavere end de allerede reserverede eller manuelt registrerede pladser.";
        if (isAdminEventEdit) {
          adminEventEditRedirect(message, existingEventId, adminReturnTo);
        }
        redirectWithMessage(message);
      }
    }
  }

  if (paymentDeadlineDays !== null && Number.isNaN(paymentDeadlineDays)) {
    redirectWithMessage("Betalingsfrist skal være mellem 0 og 60 dage.");
  }

  if (paymentExternalUrl && !isValidUrl(paymentExternalUrl)) {
    redirectWithMessage("Betalingslink skal være et gyldigt link, fx https://...");
  }

  if (!isDraft && priceCents > 0 && paymentMethodSource === "custom" && !paymentExternalUrl) {
    redirectWithMessage("Betalingslink er påkrævet, når du bruger et unikt betalingslink til eventet.");
  }

  if (!isDraft && priceCents > 0 && paymentMethodSource === "custom" && paymentLinkMode === "external_registration" && registrationMode !== "direct") {
    redirectWithMessage("Ekstern tilmelding og betaling kan kun bruges sammen med direkte tilmelding.");
  }

  if (
    !isDraft &&
    priceCents > 0 &&
    paymentMethodSource === "facilitator" &&
    !hasStandardPaymentMethod(paymentSettingsToInstructionsRecord(facilitatorPaymentSettings))
  ) {
    redirectWithMessage("Du har endnu ikke gemt standardbetalingsoplysninger. Opsæt betalingsoplysninger, eller vælg et unikt betalingslink til dette event.");
  }

  if (mainCategoryIds.length > 3 || categoryIds.length > 3 || tagIds.length > 4) {
    redirectWithMessage("Du kan vælge op til 3 kategorier og op til 4 tags.");
  }

  if (!isDraft && mainCategoryIds.length < 1) {
    redirectWithMessage("Vælg mindst én hovedkategori til eventet.");
  }

  if (!isDraft && eventFormat === "physical" && (!addressLine || !postalCode || !city || !country)) {
    redirectWithMessage("Adresse, postnummer, by og land skal udfyldes for fysiske events.");
  }

  if (!isDraft && isDanishPhysicalEvent && postalCode && !/^\d{4}$/.test(postalCode)) {
    redirectWithMessage("Danske events skal have et postnummer på 4 cifre.");
  }

  if (!isDraft && eventFormat === "online" && !onlineUrlOrNote) {
    redirectWithMessage("Tilføj et gyldigt online-link.");
  }

  if (!isDraft && eventFormat === "online" && onlineUrlOrNote && !isValidUrl(onlineUrlOrNote)) {
    redirectWithMessage("Online-link skal være et gyldigt link, fx https://zoom.us/...");
  }

  if (!isDraft && !isAdminEventEdit) {
    const missingAcceptances = await getMissingRequiredLegalAcceptances(supabase, profile.id, organizerAcceptanceTypes);
    const acceptedOrganizerTerms = formData.get("accepted_organizer_terms") === "yes";

    if (missingAcceptances.length > 0 && !acceptedOrganizerTerms) {
      eventFormRedirect("Før eventet kan offentliggøres, skal du acceptere de gældende arrangørvilkår og retningslinjer nedenfor.", {
        eventId: existingEventId,
        step: "4",
      });
    }

    if (missingAcceptances.length > 0) {
      try {
        await recordLegalAcceptances(supabase, {
          action: "event_publication",
          documentTypes: organizerAcceptanceTypes,
          profileId: profile.id,
        });
      } catch {
        eventFormRedirect("Accepten af vilkår kunne ikke gemmes. Prøv igen.", {
          eventId: existingEventId,
          step: "4",
        });
      }
    }
  }

  if (isDanishPhysicalEvent && !regionId) {
    const inferredSlug = inferRegionSlug({ city, postalCode });

    if (inferredSlug) {
      const { data: inferredRegion } = await supabase.from("regions").select("id").eq("slug", inferredSlug).maybeSingle();
      regionId = inferredRegion?.id ?? null;
    }
  }

  if (!isDraft && isDanishPhysicalEvent && !regionId) {
    redirectWithMessage("Postnummeret kunne ikke kobles til et område. Tjek postnummeret.");
  }

  if (!isDraft) {
    await validateRequestedCoOrganizerProfileIds(supabase, {
      eventId: existingEventId,
      primaryOrganizerProfileId: facilitatorProfile.id,
      requestedProfileIds: requestedCoOrganizerProfileIds,
    });

    if (existingEventId) {
      await validateActiveCoOrganizersForPublication(supabase, {
        eventId: existingEventId,
        primaryOrganizerProfileId: facilitatorProfile.id,
      });
    }
  }

  const hasAddressForGeocoding = Boolean(addressLine && postalCode && city);
  const coordinates =
    !isDanishPhysicalEvent || !hasAddressForGeocoding
      ? null
      : await geocodeDanishAddress({ addressLine, postalCode, city });
  const coverImagePath = await uploadEventCoverImage(formData, currentCoverImagePath);

  if (existingEventId) {
    const nextEventSnapshot: EventUpdateSnapshot = {
      address_line: addressLine,
      capacity,
      city,
      country,
      ends_at: endsAt,
      event_format: eventFormat,
      online_description: onlineDescription,
      online_url_or_note: onlineUrlOrNote,
      postal_code: postalCode,
      price_cents: priceCents,
      registration_mode: registrationMode,
      starts_at: startsAt,
      status,
      title,
    };
    const adminChangedFields = previousEventSnapshot
      ? getEventUpdateFields(previousEventSnapshot, nextEventSnapshot).map((field) => field.label)
      : [];

    if (previousEventSnapshot && previousEventSnapshot.status !== status) {
      adminChangedFields.push("Status");
    }

    if (previousEventSnapshot && previousEventSnapshot.capacity !== capacity) {
      adminChangedFields.push("Kapacitet");
    }

    const publishedAt =
      status === "active" || status === "sold_out"
        ? existingEventPublishedAt ?? new Date().toISOString()
        : null;
    let participantNotificationFailed = false;
    let participantNotificationResult: { failed: number; sent: number; total: number } | null = null;
    const { error: updateError } = await supabase
      .from("events")
      .update({
        status,
        published_at: publishedAt,
        title,
        slug: nextEventSlug ?? existingEventSlug,
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
        registration_mode: registrationMode,
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
      redirectWithMessage(isDraft ? "Kladde kunne ikke gemmes" + errorMessage : "Eventet kunne ikke opdateres" + errorMessage);
    }

    if (hasExistingEventBeenPublic && existingEventSlug && nextEventSlug && existingEventSlug !== nextEventSlug) {
      const { error: slugHistoryError } = await supabase.from("event_slug_history").upsert(
        {
          event_id: existingEventId,
          slug: existingEventSlug,
        },
        { onConflict: "slug" },
      );

      if (slugHistoryError) {
        console.error("Event slug history insert error", slugHistoryError);
        redirectWithMessage("Eventets URL-historik kunne ikke gemmes.");
      }
    }

    if (nextEventSlug) {
      const { error: currentSlugAliasError } = await supabase
        .from("event_slug_history")
        .delete()
        .eq("event_id", existingEventId)
        .eq("slug", nextEventSlug);

      if (currentSlugAliasError) {
        console.error("Event current slug alias cleanup error", currentSlugAliasError);
        redirectWithMessage("Eventets URL-historik kunne ikke opdateres.");
      }
    }

    const { error: paymentSettingsError } = await upsertEventPaymentSettings(supabase, {
      eventId: existingEventId,
      facilitatorId: facilitatorProfile.id,
      methodSource: paymentMethodSource,
      mobilepayNumber: paymentMobilepayNumber,
      bankRegistrationNumber: paymentBankRegistrationNumber,
      bankAccountNumber: paymentBankAccountNumber,
      bankAccountName: paymentBankAccountName,
      externalUrl: paymentExternalUrl,
      instructions: paymentInstructions,
      paymentLinkMode,
      deadlineDays: paymentDeadlineDays,
    });

    if (paymentSettingsError) {
      console.error("Event payment settings update error", paymentSettingsError);
      redirectWithMessage("Eventet blev gemt, men betalingsoplysningerne kunne ikke gemmes.");
    }

    try {
      await syncEventGalleryImages(supabase, formData, { eventId: existingEventId, title });
    } catch (error) {
      redirectWithMessage(error instanceof Error ? error.message : "Eventet blev gemt, men stemningsbillederne kunne ikke gemmes.");
    }

    await replaceEventRelations(supabase, existingEventId, {
      categoryIds,
      mainCategoryIds,
      subcategoryIds,
      tagIds,
    });
    await createCoOrganizerInvitations(supabase, {
      eventId: existingEventId,
      eventStartsAt: startsAt,
      eventTitle: title,
      invitedByUserId: profile.id,
      primaryOrganizerName: facilitatorProfile.company_name || profile.full_name || "Arrangør",
      primaryOrganizerProfileId: facilitatorProfile.id,
      requestedProfileIds: requestedCoOrganizerProfileIds,
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
            eventUrl: publicEventUrl(existingEventId, nextEventSlug ?? existingEventSlug),
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
    if (existingEventSlug) {
      revalidatePath(publicEventPath(existingEventSlug));
    }
    if (nextEventSlug) {
      revalidatePath(publicEventPath(nextEventSlug));
    }

    if (isAdminEventEdit) {
      const supportNote = getOptionalString(formData, "admin_support_note");
      const noteVisibleToFacilitator = getString(formData, "admin_note_visible_to_facilitator") === "yes";
      const changedFields = Array.from(new Set(adminChangedFields));
      const safeChangedFields = changedFields.length > 0 ? changedFields : ["Eventoplysninger"];
      const adminMessage =
        "SoulEvents-support har opdateret dit event “" +
        title +
        "”. " +
        (noteVisibleToFacilitator && supportNote ? "\n\nNote fra support: " + supportNote : "");

      const [{ error: adminEventLogError }, { error: adminAuditLogError }, { error: adminMessageError }] =
        await Promise.all([
          supabase.from("admin_event_change_log").insert({
            admin_profile_id: actorProfile.id,
            changed_fields: safeChangedFields,
            event_id: existingEventId,
            facilitator_id: facilitatorProfile.id,
            note_visible_to_facilitator: noteVisibleToFacilitator,
            support_note: supportNote,
          }),
          supabase.from("admin_audit_log").insert({
            action: "event_updated_by_admin",
            actor_profile_id: actorProfile.id,
            event_id: existingEventId,
            facilitator_id: facilitatorProfile.id,
            new_value: safeChangedFields.join(", "),
            reason: supportNote ?? "admin_support_edit",
          }),
          supabase.from("facilitator_admin_messages").insert({
            facilitator_id: facilitatorProfile.id,
            message: adminMessage.slice(0, 500),
            profile_id: facilitatorProfile.profile_id,
            status: "unread",
            subject: "SoulEvents har opdateret dit event",
            type: "admin_reply",
          }),
        ]);

      if (adminEventLogError) {
        console.error("Admin event change log insert error", adminEventLogError);
        adminEventEditRedirect("Eventet blev gemt, men audit-loggen kunne ikke oprettes.", existingEventId, adminReturnTo);
      }

      if (adminAuditLogError) {
        console.error("Admin audit log insert error", adminAuditLogError);
      }

      if (adminMessageError) {
        console.error("Admin event message insert error", adminMessageError);
      }

      revalidatePath("/admin/events");
      revalidatePath(`/admin/events/${existingEventId}/edit`);
      revalidatePath("/facilitator");
      revalidatePath("/facilitator/events");
      adminEventEditSuccessRedirect("Eventet er opdateret som administrator.", adminReturnTo);
    }

    if (isDraft) {
      redirect("/facilitator?tab=drafts&message=" + encodeURIComponent("Eventet er gemt som kladde") + "#mine-events");
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

    if (wasPublishedDirectly) {
      await supabase.from("admin_audit_log").insert({
        actor_profile_id: profile.id,
        facilitator_id: facilitatorProfile.id,
        event_id: existingEventId,
        action: "event_published_by_facilitator",
        new_value: "active",
        reason: "direct_publish",
      });
      await notifySubscribersWithoutBlockingPublication(existingEventId);
      redirect("/facilitator/events?receipt=published&event=" + existingEventId);
    }

    redirect("/facilitator/events?receipt=review");
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      facilitator_id: facilitatorProfile.id,
      status,
      published_at: status === "active" ? new Date().toISOString() : null,
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
      registration_mode: registrationMode,
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
    .select("id, slug")
    .single();

  if (eventError || !event) {
    console.error("Event insert error", eventError);
    const errorMessage = eventError?.message ? ": " + eventError.message : "";
    redirectWithMessage(
      isDraft
        ? "Kladde kunne ikke gemmes" + errorMessage
        : "Eventet kunne ikke oprettes" + errorMessage,
    );
  }
  const createdEvent = event!;

  const { error: paymentSettingsError } = await upsertEventPaymentSettings(supabase, {
    eventId: createdEvent.id,
    facilitatorId: facilitatorProfile.id,
    methodSource: paymentMethodSource,
    mobilepayNumber: paymentMobilepayNumber,
    bankRegistrationNumber: paymentBankRegistrationNumber,
    bankAccountNumber: paymentBankAccountNumber,
    bankAccountName: paymentBankAccountName,
    externalUrl: paymentExternalUrl,
    instructions: paymentInstructions,
    paymentLinkMode,
    deadlineDays: paymentDeadlineDays,
  });

  if (paymentSettingsError) {
    console.error("Event payment settings insert error", paymentSettingsError);
    redirectWithMessage("Eventet blev oprettet, men betalingsoplysningerne kunne ikke gemmes.");
  }

  try {
    await syncEventGalleryImages(supabase, formData, { eventId: createdEvent.id, title });
  } catch (error) {
    redirectWithMessage(error instanceof Error ? error.message : "Eventet blev oprettet, men stemningsbillederne kunne ikke gemmes.");
  }

  if (mainCategoryIds.length > 0) {
    await supabase.from("event_main_categories").insert(
      mainCategoryIds.map((mainCategoryId) => ({
        event_id: createdEvent.id,
        main_category_id: mainCategoryId,
      })),
    );
  }

  if (subcategoryIds.length > 0) {
    await supabase.from("event_subcategories").insert(
      subcategoryIds.map((subcategoryId) => ({
        event_id: createdEvent.id,
        subcategory_id: subcategoryId,
      })),
    );
  }

  if (tagIds.length > 0) {
    await supabase.from("event_tags").insert(
      tagIds.map((tagId) => ({
        event_id: createdEvent.id,
        tag_id: tagId,
      })),
    );
  }

  if (categoryIds.length > 0) {
    const { error: categoryError } = await supabase.from("event_categories").insert(
      categoryIds.map((categoryId) => ({
        event_id: createdEvent.id,
        category_id: categoryId,
      })),
    );

    if (categoryError) {
      redirectWithMessage("Eventet blev oprettet, men kategorierne kunne ikke gemmes.");
    }
  }

  await createCoOrganizerInvitations(supabase, {
    eventId: createdEvent.id,
    eventStartsAt: startsAt,
    eventTitle: title,
    invitedByUserId: profile.id,
    primaryOrganizerName: facilitatorProfile.company_name || profile.full_name || "Arrangør",
    primaryOrganizerProfileId: facilitatorProfile.id,
    requestedProfileIds: requestedCoOrganizerProfileIds,
  });

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/events");

  if (isDraft) {
    redirect("/facilitator?tab=drafts&message=" + encodeURIComponent("Eventet er gemt som kladde") + "#mine-events");
  }

  if (wasPublishedDirectly) {
    await supabase.from("admin_audit_log").insert({
      actor_profile_id: profile.id,
      facilitator_id: facilitatorProfile.id,
      event_id: createdEvent.id,
      action: "event_published_by_facilitator",
      new_value: "active",
      reason: "direct_publish",
    });
    await notifySubscribersWithoutBlockingPublication(createdEvent.id);
    redirect("/facilitator/events?receipt=published&event=" + createdEvent.id);
  }

  redirect("/facilitator/events?receipt=review");
}

export async function updateEventStatusAction(formData: FormData) {
  const profile = await requireRole("facilitator");
  const eventId = getString(formData, "event_id");
  const requestedStatus = getString(formData, "status") as EventStatus;
  const status: EventStatus = requestedStatus === "pending_review" ? "active" : requestedStatus;

  if (!eventId || !allowedStatuses.includes(requestedStatus) || !allowedStatuses.includes(status)) {
    eventsRedirect("Ugyldig eventhandling.");
  }

  if (status === "cancelled" && formData.get("confirm_cancel_event") !== "yes") {
    eventsRedirect("Bekræft aflysningen, før eventet aflyses.");
  }

  const supabase = createAdminClient();
  const { data: facilitatorProfiles } = await supabase
    .from("facilitator_profiles")
    .select("id, status, is_paused, is_disabled, company_name, city, postal_code, short_description, max_ticket_price_per_person, facilitator_categories(category_id)")
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

  const hasApprovedProfile = (facilitatorProfiles ?? []).some(
    (facilitatorProfile) => facilitatorProfile.status === "approved" && !facilitatorProfile.is_paused && !facilitatorProfile.is_disabled,
  );

  const requiresApprovedProfile = ["active", "pending_review", "sold_out"].includes(status);

  if (requiresApprovedProfile && !hasApprovedProfile) {
    eventsRedirect("Din arrangørprofil skal være aktiv og godkendt, før events kan offentliggøres.");
  }

  if (requiresApprovedProfile && !profileReady) {
    eventsRedirect("Færdiggør din profil, før du offentliggør events.");
  }

  if (status === "active" || status === "sold_out") {
    const facilitatorIds = (facilitatorProfiles ?? []).map((facilitatorProfile) => facilitatorProfile.id);
    const { data: event } = await supabase
      .from("events")
      .select("id, facilitator_id, published_at, cover_image_path")
      .eq("id", eventId)
      .in("facilitator_id", facilitatorIds)
      .maybeSingle();
    const facilitatorProfile = (facilitatorProfiles ?? []).find((currentProfile) => currentProfile.id === event?.facilitator_id);

    if (!event || !facilitatorProfile) {
      eventsRedirect("Eventet kunne ikke findes.");
    }

    if (!event.cover_image_path) {
      eventsRedirect(missingCoverPublishMessage);
    }

    const facilitatorId = facilitatorProfile.id;
    const limitStatus = facilitatorId
      ? await getFacilitatorEventLimitStatus(supabase, facilitatorId, { excludeEventId: eventId })
      : null;

    if (limitStatus && limitStatus.activeCount >= limitStatus.maxActiveEvents) {
      eventsRedirect(activeLimitMessage(limitStatus.maxActiveEvents));
    }

    await validateActiveCoOrganizersForPublication(supabase, {
      eventId,
      primaryOrganizerProfileId: facilitatorProfile.id,
    });
  }

  const updatePayload: { published_at?: string | null; status: EventStatus } = { status };
  if (status === "active" || status === "sold_out") {
    const { data: currentEvent } = await supabase.from("events").select("published_at").eq("id", eventId).maybeSingle();
    updatePayload.published_at = currentEvent?.published_at ?? new Date().toISOString();
  }

  const { error } = await supabase
    .from("events")
    .update(updatePayload)
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

  if (status === "active" || status === "sold_out") {
    await notifySubscribersWithoutBlockingPublication(eventId);
  }

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/events");
  facilitatorOverviewRedirect(status === "cancelled" ? "Eventet er aflyst." : "Eventstatus er opdateret.");
}

function canArchiveEventFromDashboard(event: { id?: string | null }) {
  return Boolean(event.id);
}

type DashboardVisibilityActionResult = {
  message: string;
  ok: boolean;
};

function dashboardVisibilityResult(ok: boolean, message: string): DashboardVisibilityActionResult {
  return { message, ok };
}

function isMissingDashboardVisibilityColumn(error: { code?: string; message?: string } | null) {
  return error?.code === "42703" || Boolean(error?.message?.includes("dashboard_hidden_at"));
}

export async function hideEventFromDashboardAction(formData: FormData): Promise<DashboardVisibilityActionResult> {
  const profile = await requireRole("facilitator");
  const eventId = getString(formData, "event_id");

  if (!eventId) {
    return dashboardVisibilityResult(false, "Eventet kunne ikke findes.");
  }

  const supabase = createAdminClient();
  const { data: facilitatorProfile } = await supabase
    .from("facilitator_profiles")
    .select("id")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!facilitatorProfile) {
    return dashboardVisibilityResult(false, "Arrangørprofilen mangler.");
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, facilitator_id, status, starts_at, ends_at")
    .eq("id", eventId)
    .eq("facilitator_id", facilitatorProfile.id)
    .maybeSingle();

  if (eventError || !event) {
    if (eventError) {
      console.error("[facilitator-events] Dashboard event visibility lookup failed", {
        code: eventError.code,
        details: eventError.details,
        eventId,
        hint: eventError.hint,
        message: eventError.message,
      });
    }
    return dashboardVisibilityResult(false, "Eventet kunne ikke findes.");
  }

  if (!canArchiveEventFromDashboard(event)) {
    return dashboardVisibilityResult(false, "Eventet kunne ikke arkiveres.");
  }

  const { data, error } = await supabase
    .from("events")
    .update({ dashboard_hidden_at: new Date().toISOString() })
    .eq("id", event.id)
    .eq("facilitator_id", facilitatorProfile.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[facilitator-events] Dashboard event hide failed", {
      code: error.code,
      details: error.details,
      eventId: event.id,
      hint: error.hint,
      message: error.message,
    });
    if (isMissingDashboardVisibilityColumn(error)) {
      return dashboardVisibilityResult(false, "Databasen mangler den nyeste dashboard-opdatering. Kør migrationen, og prøv igen.");
    }
    return dashboardVisibilityResult(false, "Eventet kunne ikke arkiveres. Prøv igen.");
  }

  if (!data) {
    return dashboardVisibilityResult(false, "Eventet kunne ikke arkiveres. Prøv igen.");
  }

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/events");
  return dashboardVisibilityResult(true, "Eventet er arkiveret.");
}

export async function restoreEventToDashboardAction(formData: FormData): Promise<DashboardVisibilityActionResult> {
  const profile = await requireRole("facilitator");
  const eventId = getString(formData, "event_id");

  if (!eventId) {
    return dashboardVisibilityResult(false, "Eventet kunne ikke findes.");
  }

  const supabase = createAdminClient();
  const { data: facilitatorProfile } = await supabase
    .from("facilitator_profiles")
    .select("id")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!facilitatorProfile) {
    return dashboardVisibilityResult(false, "Arrangørprofilen mangler.");
  }

  const { data, error } = await supabase
    .from("events")
    .update({ dashboard_hidden_at: null })
    .eq("id", eventId)
    .eq("facilitator_id", facilitatorProfile.id)
    .not("dashboard_hidden_at", "is", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[facilitator-events] Dashboard event restore failed", {
      code: error.code,
      details: error.details,
      eventId,
      hint: error.hint,
      message: error.message,
    });
    if (isMissingDashboardVisibilityColumn(error)) {
      return dashboardVisibilityResult(false, "Databasen mangler den nyeste dashboard-opdatering. Kør migrationen, og prøv igen.");
    }
    return dashboardVisibilityResult(false, "Eventet kunne ikke gendannes fra arkiv. Prøv igen.");
  }

  if (!data) {
    return dashboardVisibilityResult(false, "Eventet findes ikke blandt dine arkiverede events.");
  }

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/events");
  return dashboardVisibilityResult(true, "Eventet er gendannet fra arkiv.");
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
    .select("id, status, is_paused, is_disabled, max_ticket_price_per_person")
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
  });

  if (!readiness.canPublish) {
    facilitatorOverviewRedirect("Kladdeeventet mangler oplysninger før offentliggørelse.");
  }

  if (facilitatorProfile.is_paused || facilitatorProfile.is_disabled) {
    facilitatorOverviewRedirect("Din arrangørprofil skal være aktiv, før eventet kan offentliggøres.");
  }

  const nextStatus: EventStatus = "active";
  const missingAcceptances = await getMissingRequiredLegalAcceptances(supabase, profile.id, organizerAcceptanceTypes);

  if (missingAcceptances.length > 0) {
    eventFormRedirect("Før eventet kan offentliggøres, skal du acceptere de gældende arrangørvilkår og retningslinjer nedenfor.", {
      eventId: event.id,
      step: "4",
    });
  }

  const limitStatus = await getFacilitatorEventLimitStatus(supabase, facilitatorProfile.id, {
    excludeEventId: event.id,
  });

  if (limitStatus.activeCount >= limitStatus.maxActiveEvents) {
    facilitatorOverviewRedirect(activeLimitMessage(limitStatus.maxActiveEvents));
  }

  await validateActiveCoOrganizersForPublication(supabase, {
    eventId: event.id,
    primaryOrganizerProfileId: facilitatorProfile.id,
  });

  const { data: updatedEvent, error } = await supabase
    .from("events")
    .update({ published_at: new Date().toISOString(), status: nextStatus })
    .eq("id", event.id)
    .eq("facilitator_id", facilitatorProfile.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();

  if (error || !updatedEvent) {
    facilitatorOverviewRedirect("Eventet kunne ikke offentliggøres.");
  }

  await supabase.from("admin_audit_log").insert({
    actor_profile_id: profile.id,
    facilitator_id: facilitatorProfile.id,
    event_id: event.id,
    action: "event_published_by_facilitator",
    new_value: "active",
    reason: "draft_publish",
  });

  await notifySubscribersWithoutBlockingPublication(event.id);

  revalidatePath("/facilitator");
  revalidatePath("/facilitator/events");
  facilitatorOverviewRedirect("Eventet er offentliggjort.");
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
  const copiedDateTimes = copiedEventDateTimes(sourceEvent.starts_at, sourceEvent.ends_at);
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
      starts_at: copiedDateTimes.startsAt,
      ends_at: copiedDateTimes.endsAt,
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
  await copyEventGalleryImages(supabase, { sourceEventId, targetEventId: copiedEvent.id });

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

export async function cancelCoOrganizerInvitationAction(formData: FormData) {
  const profile = await requireRole("facilitator");
  const invitationId = getString(formData, "invitation_id");
  const eventId = getString(formData, "event_id");

  if (!invitationId || !eventId) {
    eventsRedirect("Medarrangøren kunne ikke opdateres.");
  }

  const supabase = createAdminClient();
  const { data: facilitatorProfile } = await supabase
    .from("facilitator_profiles")
    .select("id")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!facilitatorProfile) {
    eventsRedirect("Arrangørprofilen mangler.");
  }

  const { data: invitation, error: invitationError } = await supabase
    .from("event_co_organizers")
    .select("id, event_id, status, co_organizer_profile_id, events(title, facilitator_id), facilitator_profiles!event_co_organizers_co_organizer_profile_id_fkey(company_name, profiles!facilitator_profiles_profile_id_fkey(email, full_name))")
    .eq("id", invitationId)
    .eq("event_id", eventId)
    .maybeSingle();

  const event = firstRelation(invitation?.events);

  if (invitationError || !invitation || event?.facilitator_id !== facilitatorProfile.id) {
    eventFormRedirect("Medarrangøren kunne ikke findes.", { eventId });
  }

  const nextStatus = invitation.status === "pending" ? "cancelled" : "cancelled";
  const { error: updateError } = await supabase
    .from("event_co_organizers")
    .update({ cancelled_at: new Date().toISOString(), status: nextStatus })
    .eq("id", invitationId)
    .eq("event_id", eventId);

  if (updateError) {
    console.error("Co-organizer cancellation failed", {
      eventId,
      invitationId,
      message: updateError.message,
    });
    eventFormRedirect("Medarrangøren kunne ikke fjernes.", { eventId });
  }

  const coOrganizerProfile = firstRelation(invitation.facilitator_profiles);
  const coOrganizerUser = firstRelation(coOrganizerProfile?.profiles);
  const recipientEmail = coOrganizerUser?.email;

  if (recipientEmail && event?.title) {
    const mailSent = await sendCoOrganizerRemovedEmail({
      coOrganizerEmail: recipientEmail,
      coOrganizerName: coOrganizerDisplayName(coOrganizerProfile ?? {}),
      eventId,
      eventTitle: event.title,
      primaryOrganizerName: profile.full_name || "Arrangør",
    });

    if (!mailSent) {
      console.error("Co-organizer cancellation mail failed", { eventId, invitationId });
    }
  }

  revalidatePath("/facilitator/events");
  revalidatePath("/events/" + eventId);
  redirect("/facilitator/events?draft=" + eventId + "&message=" + encodeURIComponent("Medarrangøren er fjernet fra eventet."));
}

export async function resendCoOrganizerInvitationAction(formData: FormData) {
  const profile = await requireRole("facilitator");
  const invitationId = getString(formData, "invitation_id");
  const eventId = getString(formData, "event_id");

  if (!invitationId || !eventId) {
    eventsRedirect("Invitationen kunne ikke sendes igen.");
  }

  const supabase = createAdminClient();
  const { data: facilitatorProfile } = await supabase
    .from("facilitator_profiles")
    .select("id, company_name, profiles!facilitator_profiles_profile_id_fkey(full_name)")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!facilitatorProfile) {
    eventsRedirect("Arrangørprofilen mangler.");
  }

  const { data: invitation, error: invitationError } = await supabase
    .from("event_co_organizers")
    .select(
      "id, event_id, status, response_token, events(title, starts_at, facilitator_id), facilitator_profiles!event_co_organizers_co_organizer_profile_id_fkey(company_name, profiles!facilitator_profiles_profile_id_fkey(email, full_name))",
    )
    .eq("id", invitationId)
    .eq("event_id", eventId)
    .maybeSingle();

  const event = firstRelation(invitation?.events);

  if (invitationError || !invitation || event?.facilitator_id !== facilitatorProfile.id) {
    eventFormRedirect("Invitationen kunne ikke findes.", { eventId });
  }

  if (invitation.status !== "pending") {
    eventFormRedirect("Kun afventende invitationer kan sendes igen.", { eventId });
  }

  const coOrganizerProfile = firstRelation(invitation.facilitator_profiles);
  const coOrganizerUser = firstRelation(coOrganizerProfile?.profiles);
  const recipientEmail = coOrganizerUser?.email;

  if (!recipientEmail || !event?.title || !event.starts_at || !invitation.response_token) {
    eventFormRedirect("Invitationen kunne ikke sendes igen, fordi modtageroplysninger mangler.", { eventId });
  }

  const mailSent = await sendCoOrganizerInvitationEmail({
    eventId,
    eventStartsAt: event.starts_at,
    eventTitle: event.title,
    invitationUrl: coOrganizerInvitationUrl(invitation.response_token),
    primaryOrganizerName: coOrganizerDisplayName(facilitatorProfile),
    recipientEmail,
    recipientName: coOrganizerDisplayName(coOrganizerProfile ?? {}),
  });

  if (!mailSent) {
    console.error("Co-organizer invitation resend mail failed", { eventId, invitationId });
    eventFormRedirect("Invitationen kunne ikke sendes igen lige nu.", { eventId });
  }

  revalidatePath("/facilitator/events");
  redirect("/facilitator/events?draft=" + eventId + "&message=" + encodeURIComponent("Invitationen er sendt igen."));
}

export async function respondToCoOrganizerInvitationAction(formData: FormData) {
  const profile = await requireRole("facilitator");
  const invitationId = getString(formData, "invitation_id");
  const token = getString(formData, "token");
  const response = getString(formData, "response");

  if (!invitationId || !token || !["accepted", "declined", "withdrawn"].includes(response)) {
    redirect("/facilitator?message=" + encodeURIComponent("Invitationen kunne ikke opdateres."));
  }

  const supabase = createAdminClient();
  const { data: facilitatorProfile } = await supabase
    .from("facilitator_profiles")
    .select("id, company_name, profiles!facilitator_profiles_profile_id_fkey(full_name)")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!facilitatorProfile) {
    redirect("/facilitator?message=" + encodeURIComponent("Arrangørprofilen mangler."));
  }

  const { data: invitation, error: invitationError } = await supabase
    .from("event_co_organizers")
    .select("id, event_id, primary_organizer_profile_id, co_organizer_profile_id, status, response_token, events(title, starts_at, ends_at, status, facilitator_profiles!events_facilitator_id_fkey(status, is_paused, is_disabled)), facilitator_profiles!event_co_organizers_primary_organizer_profile_id_fkey(company_name, profiles!facilitator_profiles_profile_id_fkey(email, full_name))")
    .eq("id", invitationId)
    .eq("response_token", token)
    .maybeSingle();

  if (invitationError || !invitation || invitation.co_organizer_profile_id !== facilitatorProfile.id) {
    redirect("/facilitator?message=" + encodeURIComponent("Invitationen kunne ikke findes."));
  }

  if (response === "accepted" && invitation.status !== "pending") {
    redirect("/facilitator?message=" + encodeURIComponent("Invitationen er allerede behandlet."));
  }

  if (response === "declined" && invitation.status !== "pending") {
    redirect("/facilitator?message=" + encodeURIComponent("Invitationen er allerede behandlet."));
  }

  if (response === "withdrawn" && invitation.status !== "accepted") {
    redirect("/facilitator?message=" + encodeURIComponent("Du kan kun trække dig fra events, hvor du står som medarrangør."));
  }

  const event = firstRelation(invitation.events);
  const primaryEventOwner = firstRelation(event?.facilitator_profiles);
  const eventStatus = event?.status
    ? getUserFacingEventStatus(
        {
          ends_at: event.ends_at,
          starts_at: event.starts_at,
          status: event.status,
        },
        new Date(),
      )
    : null;
  const eventCanAcceptCoOrganizer =
    Boolean(event?.title) &&
    (eventStatus === "active" || eventStatus === "sold_out") &&
    primaryEventOwner?.status === "approved" &&
    !primaryEventOwner.is_paused &&
    !primaryEventOwner.is_disabled;

  if (response === "accepted" && !eventCanAcceptCoOrganizer) {
    redirect("/facilitator?message=" + encodeURIComponent("Eventet findes ikke længere eller er blevet fjernet."));
  }

  const { error: updateError } = await supabase
    .from("event_co_organizers")
    .update({ responded_at: new Date().toISOString(), status: response })
    .eq("id", invitationId)
    .eq("co_organizer_profile_id", facilitatorProfile.id);

  if (updateError) {
    console.error("Co-organizer response failed", {
      invitationId,
      message: updateError.message,
      response,
    });
    redirect("/facilitator?message=" + encodeURIComponent("Invitationen kunne ikke opdateres."));
  }

  const primaryOrganizer = firstRelation(invitation.facilitator_profiles);
  const primaryOrganizerUser = firstRelation(primaryOrganizer?.profiles);

  if (primaryOrganizerUser?.email && event?.title) {
    const mailSent = await sendCoOrganizerStatusEmail({
      coOrganizerName: coOrganizerDisplayName(facilitatorProfile),
      eventId: invitation.event_id,
      eventTitle: event.title,
      primaryOrganizerEmail: primaryOrganizerUser.email,
      primaryOrganizerName: coOrganizerDisplayName(primaryOrganizer ?? {}),
      status: response as "accepted" | "declined" | "withdrawn",
    });

    if (!mailSent) {
      console.error("Co-organizer response notification failed", {
        invitationId,
        response,
      });
    }
  }

  revalidatePath("/facilitator");
  revalidatePath("/events/" + invitation.event_id);
  redirect(
    "/facilitator?message=" +
      encodeURIComponent(response === "accepted" ? "Invitationen er bekræftet." : response === "withdrawn" ? "Du er trukket som medarrangør." : "Du har sagt nej tak til invitationen."),
  );
}
