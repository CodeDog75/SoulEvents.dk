import type { SupabaseClient } from "@supabase/supabase-js";

const defaultDraftLimit = 5;
const defaultActiveLimit = 10;

type LimitKey = "max_draft_events_per_facilitator" | "max_active_events_per_facilitator";

function parseLimit(value: string | null | undefined, fallback: number) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : fallback;
}

async function getSetting(supabase: SupabaseClient, key: LimitKey, fallback: number) {
  const { data } = await supabase.from("site_settings").select("value").eq("key", key).maybeSingle();
  return parseLimit(data?.value, fallback);
}

export async function getEventLimits(supabase: SupabaseClient) {
  const [maxDraftEvents, maxActiveEvents] = await Promise.all([
    getSetting(supabase, "max_draft_events_per_facilitator", defaultDraftLimit),
    getSetting(supabase, "max_active_events_per_facilitator", defaultActiveLimit),
  ]);

  return {
    maxActiveEvents,
    maxDraftEvents,
  };
}

export async function getFacilitatorEventLimitStatus(
  supabase: SupabaseClient,
  facilitatorId: string,
  options: { excludeEventId?: string | null } = {},
) {
  const limits = await getEventLimits(supabase);

  let draftQuery = supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("facilitator_id", facilitatorId)
    .eq("status", "draft");

  let activeQuery = supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("facilitator_id", facilitatorId)
    .in("status", ["active", "sold_out"])
    .gte("ends_at", new Date().toISOString());

  if (options.excludeEventId) {
    draftQuery = draftQuery.neq("id", options.excludeEventId);
    activeQuery = activeQuery.neq("id", options.excludeEventId);
  }

  const [{ count: draftCount }, { count: activeCount }] = await Promise.all([draftQuery, activeQuery]);

  return {
    ...limits,
    activeCount: activeCount ?? 0,
    draftCount: draftCount ?? 0,
  };
}

export function draftLimitMessage(limit: number) {
  return "Du har nået grænsen på " + limit + " kladder. Slet eller færdiggør en kladde, før du opretter en ny.";
}

export function activeLimitMessage(limit: number) {
  return "Arrangøren har nået grænsen på " + limit + " aktive events. Arkivér eller afslut et aktivt event, før der kan publiceres flere.";
}
