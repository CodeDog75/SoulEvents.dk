import { capacityToneClasses } from "@/components/events/capacity-badge";
import { getCapacityTone } from "@/lib/events/capacity-display";

type EventDateBoxProps = {
  startsAt: string;
};

type EventImageStatusTagProps = {
  availableSeats?: number | null;
  capacity?: number | null;
  status?: string | null;
};

const eventDateFormatter = new Intl.DateTimeFormat("da-DK", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Copenhagen",
  weekday: "long",
  year: "numeric",
});
const eventTimeFormatter = new Intl.DateTimeFormat("da-DK", {
  timeStyle: "short",
  timeZone: "Europe/Copenhagen",
});

function eventDateParts(value: string) {
  const parts = eventDateFormatter.formatToParts(new Date(value));
  return {
    day: parts.find((part) => part.type === "day")?.value ?? "",
    month: parts.find((part) => part.type === "month")?.value ?? "",
    weekday: parts.find((part) => part.type === "weekday")?.value ?? "",
    year: parts.find((part) => part.type === "year")?.value ?? "",
  };
}

export function formatEventTime(value: string) {
  return eventTimeFormatter.format(new Date(value));
}

export function EventDateBox({ startsAt }: EventDateBoxProps) {
  const { day, month, weekday, year } = eventDateParts(startsAt);

  return (
    <time
      className="pointer-events-none grid min-w-[4.45rem] max-w-[4.9rem] justify-items-center rounded-[18px] bg-white/95 px-2.5 py-2 text-center text-[#2F2633] shadow-[0_10px_24px_rgba(47,38,51,0.13)] backdrop-blur-[5px] sm:min-w-[4.8rem] sm:px-3 sm:py-2.5"
      dateTime={startsAt}
    >
      <span className="max-w-full truncate text-[0.6rem] font-semibold uppercase leading-none tracking-wide text-[#6E6475]">
        {weekday}
      </span>
      <span className="mt-1 text-2xl font-semibold leading-none text-[#2F2633] sm:text-[1.7rem]">
        {day}
      </span>
      <span className="mt-0.5 max-w-full truncate text-xs font-semibold capitalize leading-none text-[#4F6849]">
        {month}
      </span>
      <span className="mt-1 text-[0.65rem] font-semibold leading-none text-[#6E6475]">
        {year}
      </span>
    </time>
  );
}

export function EventImageStatusTag({ availableSeats, capacity, status }: EventImageStatusTagProps) {
  const tone = getCapacityTone(availableSeats, capacity, status);

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
