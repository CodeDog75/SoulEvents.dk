"use client";

import { useEffect, useRef } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics/client";

type TrackEventViewProps = {
  eventId: string;
};

export function TrackEventView({ eventId }: TrackEventViewProps) {
  const didTrack = useRef(false);

  useEffect(() => {
    if (didTrack.current) return;
    didTrack.current = true;
    trackAnalyticsEvent({ eventId, type: "event_view" });
  }, [eventId]);

  return null;
}
