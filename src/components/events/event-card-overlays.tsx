import { capacityToneClasses } from "@/components/events/capacity-badge";
import { getCapacityTone } from "@/lib/events/capacity-display";

type EventDateBoxProps = {
  startsAt: string;
};

type EventImageStatusTagProps = {
  availableSeats?: number | null;
  capacity?: number | null;
};

const weekdayFormatter = new Intl.DateTimeFormat("da-DK", { weekday: "long" });
const monthFormatter = new Intl.DateTimeFormat("da-DK", { month: "long" });

export function formatEventTime(value: string) {
  return new Intl.DateTimeFormat("da-DK", { timeStyle: "short" }).format(new Date(value));
}

export function EventDateBox({ startsAt }: EventDateBoxProps) {
  const date = new Date(startsAt);
  const weekday = weekdayFormatter.format(date);
  const month = monthFormatter.format(date);

  return (
    <time
      className="pointer-events-none grid min-w-[4.45rem] max-w-[4.9rem] justify-items-center rounded-[18px] bg-white/95 px-2.5 py-2 text-center text-[#2F2633] shadow-[0_10px_24px_rgba(47,38,51,0.13)] backdrop-blur-[5px] sm:min-w-[4.8rem] sm:px-3 sm:py-2.5"
      dateTime={startsAt}
    >
      <span className="max-w-full truncate text-[0.6rem] font-semibold uppercase leading-none tracking-wide text-[#6E6475]">
        {weekday}
      </span>
      <span className="mt-1 text-2xl font-semibold leading-none text-[#2F2633] sm:text-[1.7rem]">
        {date.getDate()}
      </span>
      <span className="mt-0.5 max-w-full truncate text-xs font-semibold capitalize leading-none text-[#4F6849]">
        {month}
      </span>
      <span className="mt-1 text-[0.65rem] font-semibold leading-none text-[#6E6475]">
        {date.getFullYear()}
      </span>
    </time>
  );
}

export function EventImageStatusTag({ availableSeats, capacity }: EventImageStatusTagProps) {
  const tone = getCapacityTone(availableSeats, capacity);

  if (tone === "available" || !tone) {
    return null;
  }

  return (
    <span
      className={
        "pointer-events-none inline-flex min-h-7 max-w-[8.2rem] items-center justify-center rounded-full px-3 py-1 text-center text-[0.68rem] font-semibold leading-tight shadow-[0_8px_18px_rgba(47,38,51,0.10)] backdrop-blur-[5px] " +
        capacityToneClasses[tone]
      }
    >
      {tone === "low" ? "Få ledige pladser" : "Udsolgt"}
    </span>
  );
}
