"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import {
  calculateEventRevenueBracketCommission,
  eventSettlementBillableStatuses,
  getEventCommissionPlan,
  type EventSettlementStatus,
} from "@/lib/commission/event-settlements";
import { defaultCommissionCurrency } from "@/lib/commission/terms";
import { getOptionalString, getString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";

function redirectWithMessage(tab: string, message: string): never {
  redirect(`/admin/commission?tab=${encodeURIComponent(tab)}&message=${encodeURIComponent(message)}`);
}

function parseKronerToCents(value: string | null | undefined, label: string) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || !/^\d+$/.test(trimmed)) {
    throw new Error(`${label} skal være et heltal i kroner.`);
  }

  const kroner = Number(trimmed);
  if (!Number.isSafeInteger(kroner) || kroner < 0) {
    throw new Error(`${label} skal være mindst 0 kr.`);
  }

  return kroner * 100;
}

function parseBps(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || !/^\d+([,.]\d{1,2})?$/.test(trimmed)) {
    throw new Error("Kommissionssatsen skal angives som procent, fx 10 eller 12,5.");
  }

  const percent = Number(trimmed.replace(",", "."));
  const bps = Math.round(percent * 100);
  if (!Number.isSafeInteger(bps) || bps < 0 || bps > 10000) {
    throw new Error("Kommissionssatsen skal være mellem 0 og 100 %.");
  }

  return bps;
}

function normalizeCurrency(value: string | null | undefined) {
  const currency = (value || defaultCommissionCurrency).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Valuta skal være en ISO-kode på 3 bogstaver.");
  }

  return currency;
}

function parseFinancialStatus(value: string): EventSettlementStatus | null {
  return ["selected_for_invoice", "invoiced", "settled", "waived"].includes(value)
    ? (value as EventSettlementStatus)
    : null;
}

export async function createCommissionSettingAction(formData: FormData) {
  const adminProfile = await requireRole("admin");
  let payload: {
    commission_rate_bps: number;
    created_by: string;
    currency: string;
    effective_from: string;
    minimum_commission_cents: number;
    reason: string | null;
    threshold_cents: number;
    tier_one_limit_cents: number;
    tier_three_rate_bps: number;
    tier_two_limit_cents: number;
    tier_two_rate_bps: number;
  };

  try {
    const thresholdCents = parseKronerToCents(getString(formData, "threshold_kr"), "Første omsætningsgrænse");
    const tierOneLimitCents = parseKronerToCents(getString(formData, "tier_one_limit_kr"), "Anden omsætningsgrænse");
    const tierTwoLimitCents = parseKronerToCents(getString(formData, "tier_two_limit_kr"), "Tredje omsætningsgrænse");

    if (tierOneLimitCents <= thresholdCents || tierTwoLimitCents <= tierOneLimitCents) {
      throw new Error("Omsætningsgrænserne skal stå i stigende rækkefølge.");
    }

    payload = {
      commission_rate_bps: parseBps(getString(formData, "tier_one_rate_percent")),
      created_by: adminProfile.id,
      currency: normalizeCurrency(getOptionalString(formData, "currency")),
      effective_from: getOptionalString(formData, "effective_from") || new Date().toISOString(),
      minimum_commission_cents: parseKronerToCents(getOptionalString(formData, "minimum_commission_kr") || "0", "Minimumskommission"),
      reason: getOptionalString(formData, "reason"),
      threshold_cents: thresholdCents,
      tier_one_limit_cents: tierOneLimitCents,
      tier_three_rate_bps: parseBps(getString(formData, "tier_three_rate_percent")),
      tier_two_limit_cents: tierTwoLimitCents,
      tier_two_rate_bps: parseBps(getString(formData, "tier_two_rate_percent")),
    };
  } catch (error) {
    redirectWithMessage("settings", error instanceof Error ? error.message : "Indstillingerne kunne ikke valideres.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("commission_settings").insert(payload);

  if (error) {
    console.error("[admin-commission] commission setting insert failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
    });
    redirectWithMessage(
      "settings",
      error.code === "PGRST205"
        ? "Kommissionstabellen mangler i databasen. Kør migration 077 og prøv igen."
        : error.code === "42703" || error.code === "PGRST204"
          ? "Omsætningstrappen mangler i databasen. Kør migration 080 og prøv igen."
        : "Kommissionsindstillingerne kunne ikke gemmes.",
    );
  }

  await supabase.from("admin_audit_log").insert({
    action: "commission_settings_created",
    actor_profile_id: adminProfile.id,
    new_value: JSON.stringify(payload),
    reason: payload.reason,
  });

  revalidatePath("/admin/commission");
  redirectWithMessage("settings", "Kommissionsindstillingerne er gemt.");
}

export async function syncCompletedEventFinancialRecordsAction() {
  const adminProfile = await requireRole("admin");
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const planCache = new Map<string, Awaited<ReturnType<typeof getEventCommissionPlan>>>();

  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, facilitator_id, ends_at, status, published_at")
    .not("published_at", "is", null)
    .not("status", "in", "(draft,pending_review,rejected,cancelled)")
    .lte("ends_at", now)
    .order("ends_at", { ascending: false })
    .limit(250);

  if (eventsError) {
    console.error("[admin-commission] completed event lookup failed", eventsError);
    redirectWithMessage("event-settlements", "Afsluttede events kunne ikke hentes.");
  }

  let created = 0;
  let updated = 0;

  for (const event of events ?? []) {
    const { data: existingRecord } = await supabase
      .from("event_financial_records")
      .select("id, status")
      .eq("event_id", event.id)
      .maybeSingle();

    if (existingRecord && !["no_revenue", "below_threshold", "ready_for_review"].includes(existingRecord.status ?? "")) {
      continue;
    }

    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, status, seats, price_per_seat_cents, booking_value_cents")
      .eq("event_id", event.id);

    const bookingRows = bookings ?? [];
    const includedRows = bookingRows.filter((booking) =>
      eventSettlementBillableStatuses.includes(booking.status as (typeof eventSettlementBillableStatuses)[number]),
    );
    const excludedRows = bookingRows.length - includedRows.length;
    const grossRevenueCents = includedRows.reduce((sum, booking) => sum + (booking.booking_value_cents ?? 0), 0);
    const includedSeats = includedRows.reduce((sum, booking) => sum + (booking.seats ?? 0), 0);
    let plan = planCache.get(event.facilitator_id);
    if (!plan) {
      plan = await getEventCommissionPlan(supabase, event.facilitator_id);
      planCache.set(event.facilitator_id, plan);
    }
    const calculation = calculateEventRevenueBracketCommission(grossRevenueCents, plan);

    const payload = {
      calculated_at: new Date().toISOString(),
      calculated_commission_cents: calculation.calculatedCommissionCents,
      classification: calculation.classification,
      commission_plan_id: plan.planId,
      currency: plan.currency,
      event_ends_at: event.ends_at,
      event_id: event.id,
      excluded_booking_count: excludedRows,
      final_commission_cents: calculation.finalCommissionCents,
      free_revenue_cents: calculation.freeRevenueCents,
      free_threshold_cents: plan.freeThresholdCents,
      gross_revenue_cents: calculation.grossRevenueCents,
      included_booking_count: includedRows.length,
      included_seats: includedSeats,
      primary_facilitator_id: event.facilitator_id,
      status: calculation.status,
      tier_one_limit_cents: plan.tierOneLimitCents,
      tier_one_rate_bps: plan.tierOneRateBps,
      tier_one_revenue_cents: calculation.tierOneRevenueCents,
      tier_three_rate_bps: plan.tierThreeRateBps,
      tier_three_revenue_cents: calculation.tierThreeRevenueCents,
      tier_two_limit_cents: plan.tierTwoLimitCents,
      tier_two_rate_bps: plan.tierTwoRateBps,
      tier_two_revenue_cents: calculation.tierTwoRevenueCents,
    };

    const { data: record, error: upsertError } = await supabase
      .from("event_financial_records")
      .upsert(payload, { onConflict: "event_id" })
      .select("id")
      .single();

    if (upsertError || !record) {
      console.error("[admin-commission] event financial record upsert failed", {
        error: upsertError,
        eventId: event.id,
      });
      if (upsertError?.code === "PGRST205" || upsertError?.code === "42P01" || upsertError?.code === "42703") {
        redirectWithMessage("event-settlements", "Eventafregningstabellerne mangler i databasen. Kør migration 078 og prøv igen.");
      }
      continue;
    }

    await supabase
      .from("event_financial_record_booking_lines")
      .delete()
      .eq("financial_record_id", record.id);

    if (bookingRows.length > 0) {
      await supabase.from("event_financial_record_booking_lines").insert(
        bookingRows.map((booking) => {
          const included = eventSettlementBillableStatuses.includes(booking.status as (typeof eventSettlementBillableStatuses)[number]);
          return {
            booking_id: booking.id,
            booking_status_snapshot: booking.status,
            booking_value_cents_snapshot: booking.booking_value_cents ?? 0,
            exclusion_reason: included ? null : booking.status,
            financial_record_id: record.id,
            included_in_financial_record: included,
            price_per_seat_cents_snapshot: booking.price_per_seat_cents ?? 0,
            seats_snapshot: booking.seats ?? 0,
          };
        }),
      );
    }

    if (existingRecord) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  await supabase.from("admin_audit_log").insert({
    action: "event_financial_records_synced",
    actor_profile_id: adminProfile.id,
    new_value: JSON.stringify({ created, updated }),
  });

  revalidatePath("/admin/commission");
  redirectWithMessage("event-settlements", `Økonomisk registrering er opdateret. ${created} oprettet, ${updated} opdateret.`);
}

export async function updateEventFinancialRecordStatusAction(formData: FormData) {
  const adminProfile = await requireRole("admin");
  const recordId = getString(formData, "financial_record_id");
  const nextStatus = parseFinancialStatus(getString(formData, "status"));
  const internalNote = getOptionalString(formData, "internal_note");

  if (!recordId || !nextStatus) {
    redirectWithMessage("event-settlements", "Ugyldig afregningshandling.");
  }

  const now = new Date().toISOString();
  const patch: Record<string, string | null> = {
    status: nextStatus,
  };

  if (internalNote) {
    patch.internal_note = internalNote;
  }

  if (nextStatus === "selected_for_invoice") {
    patch.reviewed_at = now;
    patch.reviewed_by = adminProfile.id;
  } else if (nextStatus === "invoiced") {
    patch.invoiced_at = now;
  } else if (nextStatus === "settled" || nextStatus === "waived") {
    patch.settled_at = now;
  }

  const supabase = createAdminClient();
  const { data: current } = await supabase
    .from("event_financial_records")
    .select("id, status, final_commission_cents")
    .eq("id", recordId)
    .maybeSingle();

  if (!current) {
    redirectWithMessage("event-settlements", "Afregningsgrundlaget kunne ikke findes.");
  }

  if (current.final_commission_cents <= 0 && !["settled", "waived"].includes(nextStatus)) {
    redirectWithMessage("event-settlements", "0 kr.-events kan kun markeres som afregnet eller eftergivet.");
  }

  const { error } = await supabase.from("event_financial_records").update(patch).eq("id", recordId);

  if (error) {
    console.error("[admin-commission] event financial status update failed", error);
    redirectWithMessage(
      "event-settlements",
      error.code === "PGRST205" || error.code === "42P01" || error.code === "42703"
        ? "Eventafregningstabellerne mangler i databasen. Kør migration 078 og prøv igen."
        : "Afregningsstatus kunne ikke opdateres.",
    );
  }

  await supabase.from("admin_audit_log").insert({
    action: "event_financial_record_status_changed",
    actor_profile_id: adminProfile.id,
    new_value: nextStatus,
    old_value: current.status,
    reason: internalNote,
  });

  revalidatePath("/admin/commission");
  redirectWithMessage("event-settlements", "Afregningsstatus er opdateret.");
}

export async function createFacilitatorCommissionTermsAction(formData: FormData) {
  const adminProfile = await requireRole("admin");
  const facilitatorId = getString(formData, "facilitator_id");

  if (!facilitatorId) {
    redirectWithMessage("facilitators", "Vælg en arrangør.");
  }

  let payload: {
    commission_rate_bps: number;
    created_by: string;
    currency: string;
    effective_from: string;
    facilitator_id: string;
    minimum_commission_cents: number;
    reason: string | null;
    threshold_cents: number;
    tier_one_limit_cents: number;
    tier_three_rate_bps: number;
    tier_two_limit_cents: number;
    tier_two_rate_bps: number;
  };

  try {
    const thresholdCents = parseKronerToCents(getString(formData, "threshold_kr"), "Første individuelle omsætningsgrænse");
    const tierOneLimitCents = parseKronerToCents(getString(formData, "tier_one_limit_kr"), "Anden individuelle omsætningsgrænse");
    const tierTwoLimitCents = parseKronerToCents(getString(formData, "tier_two_limit_kr"), "Tredje individuelle omsætningsgrænse");

    if (tierOneLimitCents <= thresholdCents || tierTwoLimitCents <= tierOneLimitCents) {
      throw new Error("Omsætningsgrænserne skal stå i stigende rækkefølge.");
    }

    payload = {
      commission_rate_bps: parseBps(getString(formData, "tier_one_rate_percent")),
      created_by: adminProfile.id,
      currency: normalizeCurrency(getOptionalString(formData, "currency")),
      effective_from: getOptionalString(formData, "effective_from") || new Date().toISOString(),
      facilitator_id: facilitatorId,
      minimum_commission_cents: parseKronerToCents(getOptionalString(formData, "minimum_commission_kr") || "0", "Minimumskommission"),
      reason: getOptionalString(formData, "reason"),
      threshold_cents: thresholdCents,
      tier_one_limit_cents: tierOneLimitCents,
      tier_three_rate_bps: parseBps(getString(formData, "tier_three_rate_percent")),
      tier_two_limit_cents: tierTwoLimitCents,
      tier_two_rate_bps: parseBps(getString(formData, "tier_two_rate_percent")),
    };
  } catch (error) {
    redirectWithMessage("facilitators", error instanceof Error ? error.message : "Arrangørvilkårene kunne ikke valideres.");
  }

  const supabase = createAdminClient();
  await supabase
    .from("facilitator_commission_terms")
    .update({ is_active: false })
    .eq("facilitator_id", facilitatorId)
    .eq("is_active", true);

  const { error } = await supabase.from("facilitator_commission_terms").insert(payload);

  if (error) {
    console.error("[admin-commission] facilitator terms insert failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
    });
    redirectWithMessage(
      "facilitators",
      error.code === "PGRST205"
        ? "Tabellen til arrangørvilkår mangler i databasen. Kør migration 077 og prøv igen."
        : error.code === "42703" || error.code === "PGRST204"
          ? "Omsætningstrappen for arrangørvilkår mangler i databasen. Kør migration 080 og prøv igen."
        : "Arrangørvilkårene kunne ikke gemmes.",
    );
  }

  await supabase.from("admin_audit_log").insert({
    action: "facilitator_commission_terms_created",
    actor_profile_id: adminProfile.id,
    facilitator_id: facilitatorId,
    new_value: JSON.stringify(payload),
    reason: payload.reason,
  });

  revalidatePath("/admin/commission");
  redirectWithMessage("facilitators", "Arrangørvilkårene er gemt.");
}

export async function resetFacilitatorCommissionTermsAction(formData: FormData) {
  const adminProfile = await requireRole("admin");
  const facilitatorId = getString(formData, "facilitator_id");

  if (!facilitatorId) {
    redirectWithMessage("facilitators", "Arrangøren kunne ikke findes.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("facilitator_commission_terms")
    .update({ is_active: false })
    .eq("facilitator_id", facilitatorId)
    .eq("is_active", true);

  if (error) {
    console.error("[admin-commission] facilitator terms reset failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
    });
    redirectWithMessage(
      "facilitators",
      error.code === "PGRST205"
        ? "Tabellen til arrangørvilkår mangler i databasen. Kør migration 077 og prøv igen."
        : "Arrangørvilkårene kunne ikke nulstilles.",
    );
  }

  await supabase.from("admin_audit_log").insert({
    action: "facilitator_commission_terms_reset",
    actor_profile_id: adminProfile.id,
    facilitator_id: facilitatorId,
    new_value: "standard_terms",
  });

  revalidatePath("/admin/commission");
  redirectWithMessage("facilitators", "Arrangøren bruger nu standardvilkår.");
}
