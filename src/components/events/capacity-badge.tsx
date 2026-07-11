import { formatCapacityLabel, getCapacityTone } from "@/lib/events/capacity-display";

type CapacityBadgeProps = {
  availableSeats?: number | null;
  capacity?: number | null;
  className?: string;
};

const toneClasses = {
  available: "bg-[#35D06F] text-[#053B20]",
  low: "bg-[#FFD43B] text-[#2D2400]",
  sold_out: "bg-[#D92D20] text-white",
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
