import { formatCapacityLabel, getCapacityTone } from "@/lib/events/capacity-display";

type CapacityBadgeProps = {
  availableSeats?: number | null;
  capacity?: number | null;
  className?: string;
  compact?: boolean;
};

export const capacityToneClasses = {
  available: "bg-[#EDF3EA] text-[#4F6849]",
  low: "bg-[#F7EEDB] text-[#6F5A35]",
  sold_out: "bg-[#EADADB] text-[#75404A]",
};

export function CapacityBadge({ availableSeats, capacity, className = "", compact = false }: CapacityBadgeProps) {
  const label = formatCapacityLabel(availableSeats, capacity);
  const tone = getCapacityTone(availableSeats, capacity);

  if (!label || !tone) {
    return null;
  }

  return (
    <span
      className={
        "inline-flex w-fit items-center rounded-full font-semibold leading-tight " +
        (compact ? "min-h-6 px-2.5 py-0.5 text-[0.68rem] " : "min-h-7 px-3 py-1 text-xs ") +
        capacityToneClasses[tone] +
        (className ? " " + className : "")
      }
    >
      {label}
    </span>
  );
}
