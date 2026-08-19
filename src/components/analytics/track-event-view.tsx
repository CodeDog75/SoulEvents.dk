"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics/client";

type TrackEventViewProps = {
  eventId: string;
};

export function TrackEventView({ eventId }: TrackEventViewProps) {
  const searchParams = useSearchParams();
  const didTrack = useRef(false);

  useEffect(() => {
    const returnTo = searchParams.get("return_to");
    if (returnTo?.startsWith("/admin") || returnTo?.startsWith("/facilitator")) {
      return;
    }

    if (didTrack.current) return;
    didTrack.current = true;
    trackAnalyticsEvent({ eventId, type: "event_view" });
  }, [eventId, searchParams]);

  return null;
}
