import Image from "next/image";
import type { ReactNode } from "react";
import { MapPin, UserRound } from "lucide-react";
import { FacilitatorStatusBadge } from "@/components/admin/facilitator-status-badge";
import { cn } from "@/lib/utils";
import type { AppRole, FacilitatorStatus } from "@/types/database";

type FacilitatorAdminCardSource = {
  city?: string | null;
  company_name?: string | null;
  created_at?: string | null;
  email?: string | null;
  full_name?: string | null;
  host_reference_id?: string | null;
  id: string;
  is_disabled?: boolean | null;
  is_paused?: boolean | null;
  pending_bookings?: number | null;
  postal_code?: string | null;
  profile_image_url?: string | null;
  role?: AppRole | null;
  status: FacilitatorStatus;
};

type FacilitatorAdminMetric = {
  label: string;
  tone?: "attention" | "neutral";
  value: number | string;
};

export type FacilitatorAdminTask = {
  description?: string;
  title: string;
  tone: "attention" | "good" | "info" | "warning";
};

type FacilitatorAdminCardProps = {
  actions: ReactNode;
  badges?: ReactNode;
  chips?: string[];
  contactLine?: string | null;
  description?: string | null;
  facilitator: FacilitatorAdminCardSource;
  footer?: ReactNode;
  imagePriority?: boolean;
  isHighlighted?: boolean;
  loginActivityLine?: string | null;
  metrics?: FacilitatorAdminMetric[];
  metaLine?: string | null;
  mode?: "compact" | "full";
  specialty?: string | null;
  task?: FacilitatorAdminTask | null;
};

const taskStyles: Record<FacilitatorAdminTask["tone"], string> = {
  attention: "border-[#D06B1E]/35 bg-[#FFF1DB] text-[#7A3F11]",
  good: "border-[#8CB77E]/40 bg-[#F1F7ED] text-[#3F6838]",
  info: "border-[#9BAFC3]/40 bg-[#F2F6F8] text-[#405565]",
  warning: "border-[#E2A447]/40 bg-[#FFF7E6] text-[#76520F]",
};

export function getFacilitatorAdminTask({
  facilitator,
}: {
  facilitator: Pick<FacilitatorAdminCardSource, "id" | "is_disabled" | "is_paused" | "pending_bookings" | "status">;
}): FacilitatorAdminTask {
  const pendingBookings = facilitator.pending_bookings ?? 0;

  if (facilitator.is_disabled) {
    return {
      description: "Profilen er deaktiveret og ligger uden for det normale godkendelsesflow.",
      title: "Information",
      tone: "info",
    };
  }

  if (facilitator.status === "pending" && !facilitator.is_paused) {
    return {
      description: "Profilen afventer din godkendelse. Godkend eller anmod om ændringer.",
      title: "Næste handling",
      tone: "warning",
    };
  }

  if (facilitator.status === "changes_requested") {
    return {
      description: "Afventer arrangørens rettelser og ny indsendelse.",
      title: "Næste handling",
      tone: "attention",
    };
  }

  if (facilitator.is_paused) {
    return {
      description: "Profilen er sat på pause.",
      title: "Information",
      tone: "info",
    };
  }

  if (pendingBookings > 0) {
    return {
      description: `${pendingBookings} ${pendingBookings === 1 ? "deltager afventer arrangørens svar" : "deltagere afventer arrangørens svar"}.`,
      title: "Næste handling for arrangøren",
      tone: "attention",
    };
  }

  return {
    description: "Ingen handling nødvendig.",
    title: "Ingen handling nødvendig",
    tone: "good",
  };
}

export function FacilitatorAdminCard({
  actions,
  badges,
  chips = [],
  contactLine,
  description,
  facilitator,
  footer,
  imagePriority = false,
  isHighlighted = false,
  loginActivityLine,
  metrics = [],
  metaLine,
  mode = "full",
  specialty,
  task,
}: FacilitatorAdminCardProps) {
  const displayName = facilitator.company_name || facilitator.full_name || "Uden navn";
  const location = [facilitator.postal_code, facilitator.city].filter(Boolean).join(" ");
  const isCompact = mode === "compact";
  const specialtyText = specialty?.replace(/\s+/g, " ").trim() ?? "";

  return (
    <article
      id={"facilitator-" + facilitator.id}
      className={cn(
        "scroll-mt-24 overflow-visible rounded-[22px] border border-midnight/10 bg-white shadow-soft transition duration-200 hover:border-sage-700/35 hover:shadow-lift",
        isHighlighted && "border-[#D06B1E]/45 bg-[#FFFDF7] ring-2 ring-[#D06B1E]/30",
        isCompact ? "p-3" : "p-4 sm:p-5",
      )}
    >
      <div className={cn("grid gap-4", isCompact ? "grid-cols-[4.5rem_minmax(0,1fr)]" : "lg:grid-cols-[5.5rem_minmax(0,1fr)_auto]")}>
        <div
          className={cn(
            "relative overflow-hidden rounded-[16px] border border-midnight/10 bg-[#F4F0EA]",
            isCompact ? "size-[4.5rem]" : "size-[5.5rem]",
          )}
        >
          {facilitator.profile_image_url ? (
            <Image
              alt=""
              className="object-cover"
              fill
              priority={imagePriority}
              sizes={isCompact ? "72px" : "88px"}
              src={facilitator.profile_image_url}
            />
          ) : (
            <div className="grid size-full place-items-center text-sage-700">
              <UserRound className={isCompact ? "size-7" : "size-8"} aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <FacilitatorStatusBadge facilitator={facilitator} emphasis={isCompact ? "normal" : "strong"} />
            {facilitator.host_reference_id ? (
              <span className="rounded-full bg-midnight/5 px-3 py-1 text-xs font-semibold text-ink/64">{facilitator.host_reference_id}</span>
            ) : null}
            {badges}
          </div>

          <h3 className={cn("mt-3 break-words font-semibold leading-tight text-midnight", isCompact ? "text-base" : "text-xl")}>{displayName}</h3>

          {contactLine ? <p className="mt-1 break-words text-sm font-medium leading-5 text-ink/62">{contactLine}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-ink/50">
            {location ? (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{location}</span>
              </span>
            ) : (
              <span>Lokation mangler</span>
            )}
            {metaLine ? <span>{metaLine}</span> : null}
          </div>

          {description ? <p className="mt-3 line-clamp-2 max-w-3xl text-sm leading-6 text-ink/68">{description}</p> : null}
          {!isCompact && loginActivityLine ? (
            <p className="mt-3 text-sm font-semibold leading-5 text-[#6E5A86]">{loginActivityLine}</p>
          ) : null}

          {chips.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {chips.slice(0, isCompact ? 3 : 8).map((label) => (
                <span className="rounded-full bg-sand px-2.5 py-1 text-xs font-semibold text-ink/68" key={label}>
                  {label}
                </span>
              ))}
              {chips.length > (isCompact ? 3 : 8) ? (
                <span className="rounded-full bg-midnight/5 px-2.5 py-1 text-xs font-semibold text-ink/56">+{chips.length - (isCompact ? 3 : 8)}</span>
              ) : null}
            </div>
          ) : null}

          {specialtyText ? (
            <div className="mt-4 grid gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-[#7A5D91]">Mit speciale</p>
              <p className="h-auto max-w-3xl rounded-[18px] border border-[#D8CBE4] bg-[#F1EAF5] px-3.5 py-3 text-sm font-medium leading-5 text-midnight [overflow-wrap:anywhere] break-words">
                {specialtyText}
              </p>
            </div>
          ) : null}
        </div>

        <div className={cn("flex flex-wrap content-start gap-2", isCompact ? "col-span-2" : "lg:justify-end")}>{actions}</div>
      </div>

      {metrics.length > 0 ? (
        <div className={cn("mt-4 grid gap-2", isCompact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6")}>
          {metrics.map((metric) => (
            <div
              className={cn(
                "rounded-[14px] border px-3 py-2",
                metric.tone === "attention"
                  ? "border-[#D06B1E]/35 bg-[#FFE2BD] text-[#7A3F11]"
                  : "border-midnight/5 bg-[#F7F5F0] text-ink/70",
              )}
              key={metric.label}
            >
              <p className="text-lg font-semibold leading-none">{metric.value}</p>
              <p className="mt-1 text-xs">{metric.label}</p>
            </div>
          ))}
        </div>
      ) : null}

      {task ? (
        <div className={cn("mt-4 rounded-[18px] border px-4 py-3", taskStyles[task.tone])}>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide">{task.title}</p>
            {task.description ? <p className="mt-1 text-sm leading-5">{task.description}</p> : null}
          </div>
        </div>
      ) : null}

      {footer ? <div className="mt-4">{footer}</div> : null}
    </article>
  );
}
