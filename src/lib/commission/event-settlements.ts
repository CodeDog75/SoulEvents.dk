import type { SupabaseClient } from "@supabase/supabase-js";

export const eventSettlementBillableStatuses = ["confirmed", "completed", "invoiced", "paid"] as const;

export type EventFinancialClassification = "below_threshold" | "no_revenue" | "ready_for_review";
export type EventSettlementStatus =
  | "below_threshold"
  | "invoiced"
  | "no_revenue"
  | "ready_for_review"
  | "selected_for_invoice"
  | "settled"
  | "waived";

export type EventCommissionPlan = {
  currency: string;
  freeThresholdCents: number;
  planId: string | null;
  tierOneLimitCents: number;
  tierOneRateBps: number;
  tierThreeRateBps: number;
  tierTwoLimitCents: number;
  tierTwoRateBps: number;
};

export type EventSettlementCalculation = {
  calculatedCommissionCents: number;
  classification: EventFinancialClassification;
  finalCommissionCents: number;
  freeRevenueCents: number;
  grossRevenueCents: number;
  status: EventSettlementStatus;
  tierOneRevenueCents: number;
  tierThreeRevenueCents: number;
  tierTwoRevenueCents: number;
};

type CommissionSettingRow = {
  commission_rate_bps: number | null;
  currency: string | null;
  id: string;
  minimum_commission_cents?: number | null;
  threshold_cents: number | null;
  tier_one_limit_cents?: number | null;
  tier_three_rate_bps?: number | null;
  tier_two_limit_cents?: number | null;
  tier_two_rate_bps?: number | null;
};

const defaultFreeThresholdCents = 1_000_000;
const defaultTierOneLimitCents = 2_000_000;
const defaultTierTwoLimitCents = 3_000_000;
const defaultTierOneRateBps = 600;
const defaultTierTwoRateBps = 500;
const defaultTierThreeRateBps = 400;

function safeInteger(value: number | null | undefined, fallback: number) {
  return Number.isInteger(value) && (value ?? 0) >= 0 ? Number(value) : fallback;
}

function normalizeCurrency(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();
  return normalized && /^[A-Z]{3}$/.test(normalized) ? normalized : "DKK";
}

export function calculateEventRevenueBracketCommission(grossRevenueCents: number, plan: EventCommissionPlan): EventSettlementCalculation {
  const revenue = Math.max(0, Math.round(grossRevenueCents));
  const freeThreshold = Math.max(0, plan.freeThresholdCents);
  const tierOneLimit = Math.max(freeThreshold, plan.tierOneLimitCents);
  const tierTwoLimit = Math.max(tierOneLimit, plan.tierTwoLimitCents);
  const freeRevenueCents = revenue < freeThreshold ? revenue : 0;
  const tierOneRevenueCents = revenue >= freeThreshold && revenue < tierOneLimit ? revenue : 0;
  const tierTwoRevenueCents = revenue >= tierOneLimit && revenue < tierTwoLimit ? revenue : 0;
  const tierThreeRevenueCents = revenue >= tierTwoLimit ? revenue : 0;
  const applicableRateBps =
    tierOneRevenueCents > 0
      ? plan.tierOneRateBps
      : tierTwoRevenueCents > 0
        ? plan.tierTwoRateBps
        : tierThreeRevenueCents > 0
          ? plan.tierThreeRateBps
          : 0;
  const calculatedCommissionCents = Math.round((revenue * applicableRateBps) / 10_000);
  const classification =
    revenue === 0 ? "no_revenue" : calculatedCommissionCents <= 0 ? "below_threshold" : "ready_for_review";

  return {
    calculatedCommissionCents,
    classification,
    finalCommissionCents: calculatedCommissionCents,
    freeRevenueCents,
    grossRevenueCents: revenue,
    status: classification,
    tierOneRevenueCents,
    tierThreeRevenueCents,
    tierTwoRevenueCents,
  };
}

function planFromRows(base: CommissionSettingRow | null, individual: CommissionSettingRow | null): EventCommissionPlan {
  const freeThresholdCents = safeInteger(individual?.threshold_cents ?? base?.threshold_cents, defaultFreeThresholdCents);
  const tierOneLimitCents = Math.max(
    freeThresholdCents,
    safeInteger(individual?.tier_one_limit_cents ?? base?.tier_one_limit_cents, defaultTierOneLimitCents),
  );

  return {
    currency: normalizeCurrency(individual?.currency ?? base?.currency),
    freeThresholdCents,
    planId: individual?.id ?? base?.id ?? null,
    tierOneLimitCents,
    tierOneRateBps: safeInteger(individual?.commission_rate_bps ?? base?.commission_rate_bps, defaultTierOneRateBps),
    tierThreeRateBps: safeInteger(individual?.tier_three_rate_bps ?? base?.tier_three_rate_bps, defaultTierThreeRateBps),
    tierTwoLimitCents: Math.max(
      tierOneLimitCents,
      safeInteger(individual?.tier_two_limit_cents ?? base?.tier_two_limit_cents, defaultTierTwoLimitCents),
    ),
    tierTwoRateBps: safeInteger(individual?.tier_two_rate_bps ?? base?.tier_two_rate_bps, defaultTierTwoRateBps),
  };
}

export async function getEventCommissionPlan(supabase: SupabaseClient, facilitatorId?: string | null): Promise<EventCommissionPlan> {
  const now = new Date().toISOString();
  const [{ data: base }, { data: individual }] = await Promise.all([
    supabase
      .from("commission_settings")
      .select("id, threshold_cents, commission_rate_bps, currency, tier_one_limit_cents, tier_two_limit_cents, tier_two_rate_bps, tier_three_rate_bps")
      .eq("is_active", true)
      .lte("effective_from", now)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
    facilitatorId
      ? supabase
          .from("facilitator_commission_terms")
          .select("id, threshold_cents, commission_rate_bps, currency, tier_one_limit_cents, tier_two_limit_cents, tier_two_rate_bps, tier_three_rate_bps")
          .eq("facilitator_id", facilitatorId)
          .eq("is_active", true)
          .lte("effective_from", now)
          .order("effective_from", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return planFromRows((base as CommissionSettingRow | null) ?? null, (individual as CommissionSettingRow | null) ?? null);
}

export async function getCurrentEventCommissionPlan(supabase: SupabaseClient): Promise<EventCommissionPlan> {
  return getEventCommissionPlan(supabase);
}
