import type { EventStatus } from "@/types/database";

export type UserFacingEventStatus = "draft" | "active" | "held" | "cancelled" | "sold_out" | "rejected" | "archived";

export function isEventPastEnd(
  event: {
    ends_at?: string | null;
    starts_at?: string | null;
  },
  now = new Date(),
) {
  const endValue = event.ends_at ?? event.starts_at;
  if (!endValue) return false;
  return new Date(endValue) < now;
}

export function getUserFacingEventStatus(
  event: {
    ends_at?: string | null;
    starts_at?: string | null;
    status: EventStatus | string;
  },
  now = new Date(),
): UserFacingEventStatus {
  if (event.status === "draft" || event.status === "pending_review") return "draft";
  if (event.status === "cancelled") return "cancelled";
  if (event.status === "rejected") return "rejected";
  if (event.status === "archived") return "archived";
  if (event.status === "completed") return "held";
  if ((event.status === "active" || event.status === "sold_out") && isEventPastEnd(event, now)) return "held";
  if (event.status === "sold_out") return "sold_out";
  return "active";
}

export function getUserFacingEventStatusLabel(status: UserFacingEventStatus) {
  const labels: Record<UserFacingEventStatus, string> = {
    active: "Aktiv",
    archived: "Arkiveret",
    cancelled: "Aflyst",
    draft: "Kladde",
    held: "Afholdt",
    rejected: "Afvist",
    sold_out: "Udsolgt",
  };

  return labels[status];
}
