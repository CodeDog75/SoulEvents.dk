import { createHash, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const analyticsCookieName = "se_analytics_session";
const analyticsCookieMaxAge = 60 * 60 * 24;
const validEventTypes = new Set(["event_view", "event_share", "facilitator_profile_view"]);
const validShareMethods = new Set(["native_share", "copy_link", "email", "sms", "messenger", "facebook", "other"]);

type AnalyticsPayload = {
  type?: unknown;
  eventId?: unknown;
  facilitatorId?: unknown;
  shareMethod?: unknown;
};

function okResponse(request: NextRequest, sessionId: string, shouldSetCookie: boolean) {
  const response = NextResponse.json({ ok: true }, { status: 202 });

  if (shouldSetCookie) {
    response.cookies.set(analyticsCookieName, sessionId, {
      httpOnly: true,
      maxAge: analyticsCookieMaxAge,
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
  }

  return response;
}

function sessionForRequest(request: NextRequest) {
  const existing = request.cookies.get(analyticsCookieName)?.value;

  if (existing && /^[a-zA-Z0-9-]{20,80}$/.test(existing)) {
    return { sessionId: existing, shouldSetCookie: false };
  }

  return { sessionId: randomUUID(), shouldSetCookie: true };
}

function hashSession(sessionId: string) {
  return createHash("sha256").update("soulevents-analytics-v1:").update(sessionId).digest("hex");
}

function dedupeBucket() {
  return new Date().toISOString().slice(0, 10);
}

function referrerCategory(request: NextRequest) {
  const referrer = request.headers.get("referer");
  if (!referrer) return "direct";

  try {
    const referrerUrl = new URL(referrer);
    if (referrerUrl.origin === request.nextUrl.origin) return "internal";

    const hostname = referrerUrl.hostname.replace(/^www\./, "");
    if (hostname.includes("google.") || hostname.includes("bing.") || hostname.includes("duckduckgo.")) return "search";
    if (["facebook.com", "instagram.com", "linkedin.com", "tiktok.com"].some((domain) => hostname === domain || hostname.endsWith("." + domain))) {
      return "social";
    }

    return "external";
  } catch {
    return "unknown";
  }
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function isRecentDuplicate(input: {
  anonymousSessionHash: string;
  eventId: string | null;
  eventType: string;
  facilitatorId: string | null;
  shareMethod: string | null;
}) {
  const supabase = createAdminClient();
  const recentCutoff = new Date(Date.now() - (input.eventType === "event_share" ? 30 * 1000 : 10 * 60 * 1000)).toISOString();

  let query = supabase
    .from("analytics_events")
    .select("id")
    .eq("event_type", input.eventType)
    .eq("anonymous_session_hash", input.anonymousSessionHash)
    .gte("occurred_at", recentCutoff)
    .limit(1);

  if (input.eventId) {
    query = query.eq("event_id", input.eventId);
  }

  if (input.facilitatorId) {
    query = query.eq("facilitator_id", input.facilitatorId);
  }

  if (input.shareMethod) {
    query = query.eq("share_method", input.shareMethod);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[analytics] duplicate lookup failed", { code: error.code, message: error.message });
    return false;
  }

  return Boolean(data?.length);
}

async function targetIsPublic(type: string, eventId: string | null, facilitatorId: string | null) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  if ((type === "event_view" || type === "event_share") && eventId) {
    const { data, error } = await supabase
      .from("events")
      .select("id, facilitator_id, status, ends_at, facilitator_profiles!inner(status, is_paused, is_disabled)")
      .eq("id", eventId)
      .maybeSingle();

    if (error) {
      console.error("[analytics] event target lookup failed", { code: error.code, eventId, message: error.message });
      return null;
    }

    const facilitator = Array.isArray(data?.facilitator_profiles) ? data?.facilitator_profiles[0] : data?.facilitator_profiles;
    const isPublic =
      data &&
      ["active", "sold_out"].includes(data.status) &&
      data.ends_at >= now &&
      facilitator?.status === "approved" &&
      !facilitator?.is_paused &&
      !facilitator?.is_disabled;

    return isPublic ? { eventId: data.id, facilitatorId: data.facilitator_id } : null;
  }

  if (type === "facilitator_profile_view" && facilitatorId) {
    const { data, error } = await supabase
      .from("facilitator_profiles")
      .select("id, status, is_paused, is_disabled")
      .eq("id", facilitatorId)
      .maybeSingle();

    if (error) {
      console.error("[analytics] facilitator target lookup failed", { code: error.code, facilitatorId, message: error.message });
      return null;
    }

    return data?.status === "approved" && !data.is_paused && !data.is_disabled ? { eventId: null, facilitatorId: data.id } : null;
  }

  return null;
}

async function hasUniqueViewToday(input: {
  anonymousSessionHash: string;
  eventId: string | null;
  eventType: string;
  facilitatorId: string | null;
}) {
  if (input.eventType === "event_share") return false;

  const supabase = createAdminClient();
  let query = supabase
    .from("analytics_events")
    .select("id")
    .eq("event_type", input.eventType)
    .eq("anonymous_session_hash", input.anonymousSessionHash)
    .eq("dedupe_bucket", dedupeBucket())
    .eq("is_unique", true)
    .limit(1);

  if (input.eventId) query = query.eq("event_id", input.eventId);
  if (input.facilitatorId) query = query.eq("facilitator_id", input.facilitatorId);

  const { data, error } = await query;

  if (error) {
    console.error("[analytics] unique lookup failed", { code: error.code, message: error.message });
    return false;
  }

  return Boolean(data?.length);
}

export async function POST(request: NextRequest) {
  const { sessionId, shouldSetCookie } = sessionForRequest(request);
  const response = okResponse(request, sessionId, shouldSetCookie);

  let payload: AnalyticsPayload;
  try {
    payload = await request.json();
  } catch {
    return response;
  }

  const type = typeof payload.type === "string" ? payload.type : "";
  if (!validEventTypes.has(type)) return response;

  const eventId = isUuid(payload.eventId) ? payload.eventId : null;
  const facilitatorId = isUuid(payload.facilitatorId) ? payload.facilitatorId : null;
  const shareMethod = typeof payload.shareMethod === "string" && validShareMethods.has(payload.shareMethod) ? payload.shareMethod : null;

  if (type === "event_share" && !shareMethod) return response;

  const publicTarget = await targetIsPublic(type, eventId, facilitatorId);
  if (!publicTarget) return response;

  const anonymousSessionHash = hashSession(sessionId);
  const recentDuplicate = await isRecentDuplicate({
    anonymousSessionHash,
    eventId: publicTarget.eventId,
    eventType: type,
    facilitatorId: publicTarget.facilitatorId,
    shareMethod,
  });

  if (recentDuplicate) return response;

  const uniqueAlreadySeen = await hasUniqueViewToday({
    anonymousSessionHash,
    eventId: publicTarget.eventId,
    eventType: type,
    facilitatorId: publicTarget.facilitatorId,
  });

  const { error } = await createAdminClient().from("analytics_events").insert({
    anonymous_session_hash: anonymousSessionHash,
    dedupe_bucket: dedupeBucket(),
    event_id: publicTarget.eventId,
    event_type: type,
    facilitator_id: publicTarget.facilitatorId,
    is_unique: type === "event_share" ? true : !uniqueAlreadySeen,
    metadata: {},
    referrer_category: referrerCategory(request),
    share_method: type === "event_share" ? shareMethod : null,
  });

  if (error && error.code !== "23505") {
    console.error("[analytics] insert failed", { code: error.code, details: error.details, hint: error.hint, message: error.message, type });
  }

  return response;
}
