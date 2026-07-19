import type { SupabaseClient } from "@supabase/supabase-js";

export const defaultCommissionThresholdCents = 1_000_000;
export const defaultCommissionRateBps = 600;
export const defaultCommissionCurrency = "DKK";
export const billableBookingStatuses = ["confirmed", "completed", "invoiced", "paid"] as const;

export type CommissionSource = "individual" | "legacy" | "standard";

export type EffectiveCommissionTerms = {
  commissionRateBps: number;
  currency: string;
  minimumCommissionCents: number;
  source: Exclude<CommissionSource, "legacy">;
  termsId: string | null;
  thresholdCents: number;
};

type CommissionSettingRow = {
  commission_rate_bps: number | null;
  currency: string | null;
  id: string;
  minimum_commission_cents: number | null;
  threshold_cents: number | null;
};

type FacilitatorCommissionTermsRow = {
  commission_rate_bps: number | null;
  currency: string | null;
  id: string;
  minimum_commission_cents: number | null;
  threshold_cents: number | null;
};

function safeInteger(value: number | null | undefined, fallback: number) {
  return Number.isInteger(value) && (value ?? 0) >= 0 ? Number(value) : fallback;
}

function normalizeCurrency(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();
  return normalized && /^[A-Z]{3}$/.test(normalized) ? normalized : defaultCommissionCurrency;
}

export function reportingMonthFromEventEnd(eventEndsAt: string | null | undefined) {
  const sourceDate = eventEndsAt ? new Date(eventEndsAt) : new Date();
  const date = Number.isFinite(sourceDate.getTime()) ? sourceDate : new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export function calculateEffectiveCommissionRate(pricePerSeatCents: number, thresholdCents: number, rateBps: number) {
  if (pricePerSeatCents <= 0 || pricePerSeatCents <= thresholdCents) {
    return 0;
  }

  return rateBps;
}

export function calculateCommissionCents(bookingValueCents: number, effectiveRateBps: number, minimumCommissionCents = 0) {
  if (bookingValueCents <= 0 || effectiveRateBps <= 0) {
    return 0;
  }

  return Math.max(Math.round((bookingValueCents * effectiveRateBps) / 10_000), minimumCommissionCents);
}

export function bookingCommissionSnapshot(input: {
  eventEndsAt: string | null;
  pricePerSeatCents: number;
  seats: number;
  terms: EffectiveCommissionTerms;
}) {
  const effectiveRateBps = calculateEffectiveCommissionRate(
    input.pricePerSeatCents,
    input.terms.thresholdCents,
    input.terms.commissionRateBps,
  );
  const bookingValueCents = input.pricePerSeatCents * input.seats;
  const calculatedAt = new Date().toISOString();

  return {
    commission_calculated_at: calculatedAt,
    commission_currency: input.terms.currency,
    commission_rate_bps: effectiveRateBps,
    commission_source: input.terms.source,
    commission_terms_snapshot: {
      calculated_at: calculatedAt,
      commission_rate_bps: input.terms.commissionRateBps,
      effective_rate_bps: effectiveRateBps,
      minimum_commission_cents: input.terms.minimumCommissionCents,
      source: input.terms.source,
      terms_id: input.terms.termsId,
      threshold_cents: input.terms.thresholdCents,
    },
    commission_threshold_cents: input.terms.thresholdCents,
    expected_commission_cents: calculateCommissionCents(bookingValueCents, effectiveRateBps, input.terms.minimumCommissionCents),
    reporting_month: reportingMonthFromEventEnd(input.eventEndsAt),
    reporting_month_locked_at: calculatedAt,
  };
}

export async function getEffectiveCommissionTerms(
  supabase: SupabaseClient,
  facilitatorId: string,
): Promise<EffectiveCommissionTerms> {
  const [{ data: settings }, { data: individualTerms }] = await Promise.all([
    supabase
      .from("commission_settings")
      .select("id, threshold_cents, commission_rate_bps, minimum_commission_cents, currency")
      .eq("is_active", true)
      .lte("effective_from", new Date().toISOString())
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("facilitator_commission_terms")
      .select("id, threshold_cents, commission_rate_bps, minimum_commission_cents, currency")
      .eq("facilitator_id", facilitatorId)
      .eq("is_active", true)
      .lte("effective_from", new Date().toISOString())
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const base = (settings as CommissionSettingRow | null) ?? null;
  const individual = (individualTerms as FacilitatorCommissionTermsRow | null) ?? null;
  const thresholdCents = safeInteger(individual?.threshold_cents ?? base?.threshold_cents, defaultCommissionThresholdCents);
  const commissionRateBps = safeInteger(individual?.commission_rate_bps ?? base?.commission_rate_bps, defaultCommissionRateBps);
  const minimumCommissionCents = safeInteger(individual?.minimum_commission_cents ?? base?.minimum_commission_cents, 0);

  return {
    commissionRateBps,
    currency: normalizeCurrency(individual?.currency ?? base?.currency),
    minimumCommissionCents,
    source: individual ? "individual" : "standard",
    termsId: individual?.id ?? base?.id ?? null,
    thresholdCents,
  };
}
