"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendBookingNotification } from "@/lib/email/booking-notification";
import { sendParticipantBookingReceipt } from "@/lib/email/participant-booking-receipt";
import { getAppUrl } from "@/lib/app-url";
import { maxSeatsPerBooking } from "@/lib/bookings/limits";
import { env } from "@/lib/env";
import { getAvailableEventSeats, syncEventCapacityStatus } from "@/lib/events/capacity";
import { getOptionalString, getString } from "@/lib/forms/form-data";
import { bookingAcceptanceTypes, getCurrentLegalDocumentVersions } from "@/lib/legal/documents";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function bookingRedirect(eventId: string, message: string): never {
  redirect("/events/" + eventId + "?message=" + encodeURIComponent(message) + "#booking-response");
}

function getSeats(formData: FormData) {
  const raw = getString(formData, "seats");
  const seats = Number(raw);
  return Number.isInteger(seats) ? seats : 0;
}

function wordCount(value: string) {
  return value.split(/\s+/).filter(Boolean).length;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function validPhone(value: string) {
  return /^[\d\s]+$/.test(value) && normalizePhone(value).length === 8;
}

function bookingAdminAppUrl(origin: string | null) {
  if (env.appUrl) {
    return env.appUrl.trim().replace(/\/$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    return "https://www.soulevents.dk";
  }

  return getAppUrl(origin ?? undefined);
}

const eventSelect = [
  "id,",
  "status,",
  "title,",
  "starts_at,",
  "ends_at,",
  "price_cents,",
  "practical_information,",
  "capacity,",
  "facilitator_id,",
  "facilitator_profiles!inner(",
  "status,",
  "company_name,",
  "profiles(full_name, email)",
  "),",
  "event_categories(categories(name))",
].join("\n");

type BookingEventResult = {
  capacity: number;
  event_categories?: Array<{ categories?: { name: string } | { name: string }[] | null }> | null;
  facilitator_id: string;
  facilitator_profiles:
    | {
        company_name: string | null;
        profiles?: { email: string | null; full_name: string | null } | { email: string | null; full_name: string | null }[] | null;
      }
    | Array<{
        company_name: string | null;
        profiles?: { email: string | null; full_name: string | null } | { email: string | null; full_name: string | null }[] | null;
      }>;
  id: string;
  price_cents: number;
  practical_information?: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  title: string;
};

type CreatedBookingResult = {
  booking_value_cents: number;
  id: string;
};

function mailErrorDetails(result: PromiseSettledResult<boolean>) {
  if (result.status === "fulfilled") {
    return null;
  }

  const reason = result.reason as { code?: unknown; message?: unknown; stack?: unknown; status?: unknown; statusCode?: unknown };
  return {
    code: typeof reason?.code === "string" ? reason.code : null,
    message: result.reason instanceof Error ? result.reason.message : typeof reason?.message === "string" ? reason.message : "Ukendt mailfejl.",
    stack: result.reason instanceof Error ? result.reason.stack : typeof reason?.stack === "string" ? reason.stack : null,
    status:
      typeof reason?.statusCode === "number"
        ? reason.statusCode
        : typeof reason?.status === "number"
          ? reason.status
          : null,
  };
}

export async function createBookingAction(formData: FormData) {
  const eventId = getString(formData, "event_id");
  const participantName = getString(formData, "participant_name");
  const participantEmail = getString(formData, "participant_email").toLowerCase();
  const rawParticipantPhone = getString(formData, "participant_phone");
  const participantPhone = normalizePhone(rawParticipantPhone);
  const seats = getSeats(formData);
  const message = getOptionalString(formData, "message");
  const acceptedGuidelines = getOptionalString(formData, "accepted_guidelines");

  if (!eventId) {
    redirect("/events");
  }

  if (!participantName) {
    bookingRedirect(eventId, "Navn er påkrævet.");
  }

  if (!participantEmail) {
    bookingRedirect(eventId, "E-mail er påkrævet.");
  }

  if (!validEmail(participantEmail)) {
    bookingRedirect(eventId, "Indtast en gyldig e-mailadresse.");
  }

  if (!validPhone(rawParticipantPhone)) {
    bookingRedirect(eventId, "Indtast et gyldigt telefonnummer på 8 cifre.");
  }

  if (seats <= 0) {
    bookingRedirect(eventId, "Antal pladser skal være mindst 1.");
  }

  if (seats > maxSeatsPerBooking) {
    bookingRedirect(eventId, "Du kan højst tilmelde 10 personer ad gangen. Kontakt arrangøren ved større grupper.");
  }

  if (message && wordCount(message) > 200) {
    bookingRedirect(eventId, "Beskeden må højst være 200 ord.");
  }

  if (acceptedGuidelines !== "yes") {
    bookingRedirect(eventId, "Du skal acceptere eventets betingelser og SoulEvents’ brugervilkår før tilmelding.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: eventResult } = await supabase
    .from("events")
    .select(eventSelect)
    .eq("id", eventId)
    .in("status", ["active", "sold_out"])
    .eq("facilitator_profiles.status", "approved")
    .gte("ends_at", new Date().toISOString())
    .single();

  const event = eventResult as BookingEventResult | null;

  if (!event) {
    bookingRedirect(eventId, "Eventet kunne ikke findes eller er ikke aktivt.");
  }

  const adminSupabase = createAdminClient();
  const legalVersions = await getCurrentLegalDocumentVersions(adminSupabase, bookingAcceptanceTypes);
  const availableSeats = await getAvailableEventSeats(adminSupabase, eventId, event.capacity);

  if (availableSeats <= 0) {
    await syncEventCapacityStatus(adminSupabase, event.id);
    bookingRedirect(eventId, "Eventet er udsolgt.");
  }

  if (seats > availableSeats) {
    bookingRedirect(eventId, "Der er kun " + availableSeats + " ledige pladser.");
  }

  const facilitatorProfile = Array.isArray(event.facilitator_profiles)
    ? event.facilitator_profiles[0]
    : event.facilitator_profiles;
  const facilitatorUser = Array.isArray(facilitatorProfile?.profiles)
    ? facilitatorProfile?.profiles[0]
    : facilitatorProfile?.profiles;
  const primaryCategoryRow = event.event_categories?.[0];
  const primaryCategory = Array.isArray(primaryCategoryRow?.categories)
    ? primaryCategoryRow?.categories[0]
    : primaryCategoryRow?.categories;

  const facilitatorName = facilitatorProfile?.company_name || facilitatorUser?.full_name || "Arrangør";
  const { data: bookingResult, error } = await adminSupabase
    .from("bookings")
    .insert({
      event_id: event.id,
      facilitator_id: event.facilitator_id,
      status: "pending",
      participant_name: participantName,
      participant_email: participantEmail,
      participant_phone: participantPhone,
      seats,
      message,
      event_title_snapshot: event.title,
      event_starts_at_snapshot: event.starts_at,
      facilitator_name_snapshot: facilitatorName,
      primary_category_snapshot: primaryCategory?.name ?? null,
      price_per_seat_cents: event.price_cents,
      commission_rate_bps: 0,
    })
    .select("id, booking_value_cents")
    .single();

  const booking = bookingResult as CreatedBookingResult | null;

  if (error || !booking) {
    const overCapacity = error?.code === "23514";
    bookingRedirect(
      eventId,
      overCapacity
        ? "Der er desværre ikke nok ledige pladser tilbage."
        : error?.message ? "Tilmeldingen kunne ikke gemmes: " + error.message : "Tilmeldingen kunne ikke gemmes. Prøv igen.",
    );
  }

  await syncEventCapacityStatus(adminSupabase, event.id);

  const { error: bookingAcceptanceError } = await adminSupabase.from("booking_legal_acceptances").insert({
    booking_id: booking.id,
    event_terms_snapshot: event.practical_information ?? null,
    guidelines_document_version_id: legalVersions.get("guidelines")?.id ?? null,
    participant_email: participantEmail,
    privacy_document_version_id: legalVersions.get("privacy")?.id ?? null,
    terms_document_version_id: legalVersions.get("terms")?.id ?? null,
    user_id: user?.id ?? null,
  });

  if (bookingAcceptanceError) {
    console.error("Booking legal acceptance could not be saved", {
      bookingId: booking.id,
      error: bookingAcceptanceError.message,
      eventId: event.id,
    });
    await adminSupabase.from("bookings").delete().eq("id", booking.id);
    await syncEventCapacityStatus(adminSupabase, event.id);
    bookingRedirect(eventId, "Accepten af vilkår kunne ikke gemmes. Prøv igen.");
  }

  const requestHeaders = await headers();
  const appUrl = bookingAdminAppUrl(requestHeaders.get("origin"));
  const bookingsUrl = appUrl + "/facilitator/bookings?event=" + encodeURIComponent(event.id);
  const { data: facilitatorContact, error: facilitatorContactError } = await adminSupabase
    .from("facilitator_profiles")
    .select("profiles(email)")
    .eq("id", event.facilitator_id)
    .maybeSingle();

  if (facilitatorContactError) {
    console.error("Booking facilitator email lookup failed", {
      bookingId: booking.id,
      eventId: event.id,
      error: facilitatorContactError.message,
      facilitatorId: event.facilitator_id,
    });
  }

  const facilitatorContactProfile = Array.isArray(facilitatorContact?.profiles)
    ? facilitatorContact?.profiles[0]
    : facilitatorContact?.profiles;
  const facilitatorEmail = facilitatorContactProfile?.email ?? facilitatorUser?.email ?? null;

  const [facilitatorMailResult, participantMailResult] = await Promise.allSettled([
    sendBookingNotification({
      bookingId: booking.id,
      eventId: event.id,
      eventTitle: event.title,
      eventStartsAt: event.starts_at,
      facilitatorEmail,
      facilitatorName,
      bookingsUrl,
      participantName,
      participantEmail,
      participantPhone,
      seats,
    }),
    sendParticipantBookingReceipt({
      bookingId: booking.id,
      eventId: event.id,
      eventTitle: event.title,
      eventStartsAt: event.starts_at,
      facilitatorName,
      participantName,
      participantEmail,
      seats,
    }),
  ]);
  const facilitatorMailSent = facilitatorMailResult.status === "fulfilled" && facilitatorMailResult.value;
  const participantMailSent = participantMailResult.status === "fulfilled" && participantMailResult.value;

  if (!facilitatorMailSent || !participantMailSent) {
    console.error("Booking mail delivery failed", {
      bookingId: booking.id,
      eventId: event.id,
      facilitatorEmail,
      facilitatorMailError: mailErrorDetails(facilitatorMailResult),
      facilitatorMailSent,
      participantEmail,
      participantMailError: mailErrorDetails(participantMailResult),
      participantMailSent,
      sequence: "facilitator and participant mails attempted in parallel with Promise.allSettled",
    });
  }

  const successMessage =
    facilitatorMailSent && participantMailSent
      ? "Tak. Din tilmelding er registreret. Du modtager en mailkvittering, og arrangøren har fået besked."
      : "Tak. Din tilmelding er registreret. Mailen kunne ikke sendes lige nu, men tilmeldingen er gemt.";

  revalidatePath("/events/" + eventId);
  redirect(
    "/events/" +
      eventId +
      "?booking=sent&message=" +
      encodeURIComponent(successMessage) +
      "#booking-response",
  );
}
