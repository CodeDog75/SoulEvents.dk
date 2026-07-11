import { formatCapacityLabel, getCapacityTone } from "@/lib/events/capacity-display";

type CapacityBadgeProps = {
  availableSeats?: number | null;
  capacity?: number | null;
  className?: string;
};

const toneClasses = {
  available: "bg-[#EDF3EA] text-[#4F6849]",
  low: "bg-[#F7EEDB] text-[#6F5A35]",
  sold_out: "bg-[#EADADB] text-[#75404A]",
};

export function CapacityBadge({ availableSeats, capacity, className = "" }: CapacityBadgeProps) {
  const label = formatCapacityLabel(availableSeats, capacity);
  const tone = getCapacityTone(availableSeats, capacity);

  if (!label || !tone) {
    return null;
  }

  return (
    <span
      className={
        "inline-flex min-h-7 w-fit items-center rounded-full px-3 py-1 text-xs font-semibold leading-tight " +
        toneClasses[tone] +
        (className ? " " + className : "")
      }
    >
      {label}
    </span>
  );
}
