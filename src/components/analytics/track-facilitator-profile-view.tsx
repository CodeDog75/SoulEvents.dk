"use client";

import { useEffect, useRef } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics/client";

type TrackFacilitatorProfileViewProps = {
  facilitatorId: string;
};

export function TrackFacilitatorProfileView({ facilitatorId }: TrackFacilitatorProfileViewProps) {
  const didTrack = useRef(false);

  useEffect(() => {
    if (didTrack.current) return;
    didTrack.current = true;
    trackAnalyticsEvent({ facilitatorId, type: "facilitator_profile_view" });
  }, [facilitatorId]);

  return null;
}
