"use client";

export type AnalyticsEventType = "event_view" | "event_share" | "facilitator_profile_view";
export type AnalyticsShareMethod = "native_share" | "copy_link" | "email" | "sms" | "messenger" | "facebook" | "other";

type TrackAnalyticsInput = {
  type: AnalyticsEventType;
  eventId?: string;
  facilitatorId?: string;
  shareMethod?: AnalyticsShareMethod;
};

export function trackAnalyticsEvent(input: TrackAnalyticsInput) {
  if (typeof window === "undefined") return;

  const payload = JSON.stringify(input);

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/analytics", blob);
      return;
    }
  } catch {
    // Fall back to fetch below.
  }

  void fetch("/api/analytics", {
    body: payload,
    cache: "no-store",
    headers: { "content-type": "application/json" },
    keepalive: true,
    method: "POST",
  }).catch(() => {
    // Analytics must never disturb the public user flow.
  });
}
