import type { FacilitatorStatus } from "@/types/database";
import { AlertTriangle, CheckCircle2, CirclePause, CircleSlash2, Clock3, PencilLine } from "lucide-react";

type FacilitatorStatusSource = {
  is_disabled?: boolean | null;
  is_paused?: boolean | null;
  status: FacilitatorStatus;
};

export type FacilitatorAdminStatus = "active" | "changes_requested" | "disabled" | "draft" | "paused" | "pending";

const statusLabels: Record<FacilitatorAdminStatus, string> = {
  active: "Aktiv",
  changes_requested: "Kræver ændringer",
  disabled: "Deaktiveret",
  draft: "Under udarbejdelse",
  paused: "På pause",
  pending: "Afventer godkendelse",
};

const statusClasses: Record<FacilitatorAdminStatus, string> = {
  active: "bg-[#DDEED6] text-[#275B2D] ring-[#4F7A45]/45",
  changes_requested: "bg-[#FFE2BD] text-[#7A3F11] ring-[#D06B1E]/45",
  disabled: "bg-[#F8D6D6] text-[#8A1F28] ring-[#C8444E]/40",
  draft: "bg-midnight/5 text-ink/62 ring-midnight/15",
  paused: "bg-[#DDE6EF] text-[#254A62] ring-[#587A92]/40",
  pending: "bg-[#FFE9AE] text-[#76520F] ring-[#D49513]/45",
};

const statusIcons = {
  active: CheckCircle2,
  changes_requested: AlertTriangle,
  disabled: CircleSlash2,
  draft: PencilLine,
  paused: CirclePause,
  pending: Clock3,
} satisfies Record<FacilitatorAdminStatus, typeof CheckCircle2>;

export function getFacilitatorAdminStatus(facilitator: FacilitatorStatusSource): FacilitatorAdminStatus {
  if (facilitator.is_disabled) return "disabled";
  if (facilitator.is_paused) return "paused";
  if (facilitator.status === "approved") return "active";
  if (facilitator.status === "changes_requested") return "changes_requested";
  if (facilitator.status === "pending_review") return "pending";
  return "draft";
}

export function facilitatorAdminStatusLabel(status: FacilitatorAdminStatus) {
  return statusLabels[status];
}

export function FacilitatorStatusBadge({
  emphasis = "normal",
  facilitator,
}: {
  emphasis?: "normal" | "strong";
  facilitator: FacilitatorStatusSource;
}) {
  const status = getFacilitatorAdminStatus(facilitator);
  const Icon = statusIcons[status];

  return (
    <span className={(emphasis === "strong" ? "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ring-1 " : "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ") + statusClasses[status]}>
      <Icon className={emphasis === "strong" ? "size-4" : "size-3.5"} aria-hidden="true" />
      {statusLabels[status]}
    </span>
  );
}
